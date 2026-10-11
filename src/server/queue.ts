import { createClient, type RedisClientType } from "redis"

import { REPO_PROCESSING_QUEUE_KEY, REPO_QUEUE_DEDUPE_PREFIX, REPO_QUEUE_DEDUPE_TTL_SECONDS, REPO_QUEUE_KEY } from "./constants.ts"
import { canonicalizeRepoFullName, repoIdentifierAliases } from "./repo-key.ts"

let client: RedisClientType | null = null

function requireRedisUrl(): string {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error("REDIS_URL is required.")
  }

  return url
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: requireRedisUrl(),
    })
    client.on("error", (error) => {
      console.error("Redis error:", error)
    })
  }

  if (!client.isOpen) {
    await client.connect()
  }

  return client
}

export function queueDedupeKey(fullName: string): string {
  return `${REPO_QUEUE_DEDUPE_PREFIX}${canonicalizeRepoFullName(fullName)}`
}

function legacyQueueDedupeKey(fullName: string): string {
  return `${REPO_QUEUE_DEDUPE_PREFIX}${fullName.trim()}`
}

async function loadStoredRepoAliases(redis: RedisClientType, fullName: string): Promise<string[]> {
  return Array.from(new Set([...repoIdentifierAliases(fullName), ...(await findStoredRepoEntries(redis, fullName))]))
}

const ATOMIC_ENQUEUE_REPO_JOB_SCRIPT = `
local dedupeKey = KEYS[1]
local queueKey = KEYS[2]
local fullName = ARGV[1]
local ttlSeconds = ARGV[2]

if redis.call("SET", dedupeKey, "1", "NX", "EX", ttlSeconds) then
  redis.call("LPUSH", queueKey, fullName)
  return 1
end

return 0
`

async function findStoredRepoEntries(redis: Pick<RedisClientType, "lRange">, fullName: string): Promise<string[]> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const [queued, processing] = await Promise.all([
    redis.lRange(REPO_QUEUE_KEY, 0, -1),
    redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1),
  ])
  return [...queued, ...processing].filter((entry) => canonicalizeRepoFullName(entry) === canonicalFullName)
}

async function trackedRepoEntries(redis: RedisClientType, fullName: string): Promise<string[]> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const [queuedIndex, processingIndex] = await Promise.all([
    redis.sendCommand<number | null>(["LPOS", REPO_QUEUE_KEY, canonicalFullName]),
    redis.sendCommand<number | null>(["LPOS", REPO_PROCESSING_QUEUE_KEY, canonicalFullName]),
  ])
  if (typeof queuedIndex === "number" || typeof processingIndex === "number") {
    return [canonicalFullName]
  }
  return findStoredRepoEntries(redis, canonicalFullName)
}

async function restoreQueueDedupe(redis: RedisClientType, storedEntries: string[]): Promise<void> {
  // Legacy workers acknowledge their exact stored spelling. Refresh that key
  // rather than creating a canonical key they cannot clear on completion.
  for (const storedFullName of new Set(storedEntries)) {
    await redis.set(`${REPO_QUEUE_DEDUPE_PREFIX}${storedFullName}`, "1", {
      EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
    })
  }
}

async function enqueueRepoJobAtomically(redis: RedisClientType, fullName: string): Promise<boolean> {
  const result = await redis.sendCommand<number | string>([
    "EVAL",
    ATOMIC_ENQUEUE_REPO_JOB_SCRIPT,
    "2",
    queueDedupeKey(fullName),
    REPO_QUEUE_KEY,
    fullName,
    String(REPO_QUEUE_DEDUPE_TTL_SECONDS),
  ])

  return Number(result) === 1
}

export async function enqueueRepoJob(fullName: string): Promise<boolean> {
  const redis = await getRedisClient()
  fullName = canonicalizeRepoFullName(fullName)

  const trackedEntries = await trackedRepoEntries(redis, fullName)
  if (trackedEntries.length > 0) {
    await restoreQueueDedupe(redis, trackedEntries)
    return false
  }

  return enqueueRepoJobAtomically(redis, fullName)
}

export async function dequeueRepoJob(timeoutSeconds: number): Promise<string | null> {
  const redis = await getRedisClient()
  const timeout = String(timeoutSeconds)
  const result = await redis.sendCommand<string | null>(["BRPOPLPUSH", REPO_QUEUE_KEY, REPO_PROCESSING_QUEUE_KEY, timeout])
  return result ?? null
}

export async function acknowledgeRepoJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  const aliases = await loadStoredRepoAliases(redis, fullName)
  const tx = redis.multi()

  for (const alias of aliases) {
    tx.lRem(REPO_PROCESSING_QUEUE_KEY, 1, alias)
    tx.del(queueDedupeKey(alias))
    tx.del(legacyQueueDedupeKey(alias))
  }

  await tx.exec()
}

export async function requeueProcessingJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const aliases = await loadStoredRepoAliases(redis, fullName)
  const tx = redis.multi()

  for (const alias of aliases) {
    tx.lRem(REPO_PROCESSING_QUEUE_KEY, 1, alias)
  }

  tx.lPush(REPO_QUEUE_KEY, canonicalFullName)
  await tx.exec()
}

// Identity reconciliation is one Redis operation: enqueue/dequeue cannot
// interleave between reading the two lists and removing equivalent aliases.
// Choosing which processing jobs are abandoned remains the startup policy.
const ATOMIC_RECOVER_REPO_JOBS_SCRIPT = `
local queueKey = KEYS[1]
local processingKey = KEYS[2]
local dedupePrefix = ARGV[1]
local ttlSeconds = ARGV[2]
local processing = redis.call("LRANGE", processingKey, 0, -1)

local function trim(value)
  return (value:gsub("^%s+", ""):gsub("%s+$", ""))
end
local function canonical(value)
  local owner, repo = value:match("^([^/]+)/([^/]+)")
  if owner and repo then return string.lower(trim(owner) .. "/" .. trim(repo)) end
  return string.lower(trim(value))
end

local queued = redis.call("LRANGE", queueKey, 0, -1)
local seen = {}
local retainedReversed = {}
-- Keep the oldest position of duplicate queued identities (BRPOP reads right).
for index = #queued, 1, -1 do
  local name = canonical(queued[index])
  if not seen[name] then
    seen[name] = true
    table.insert(retainedReversed, name)
    redis.call("SET", dedupePrefix .. name, "1", "EX", ttlSeconds)
  end
  if trim(queued[index]) ~= name then redis.call("DEL", dedupePrefix .. trim(queued[index])) end
end
redis.call("DEL", queueKey)
for index = #retainedReversed, 1, -1 do redis.call("RPUSH", queueKey, retainedReversed[index]) end

local recovered = {}
local recoveredSeen = {}
for _, original in ipairs(processing) do
  local name = canonical(original)
  if trim(original) ~= name then redis.call("DEL", dedupePrefix .. trim(original)) end
  if not recoveredSeen[name] then
    recoveredSeen[name] = true
    table.insert(recovered, name)
    if not seen[name] then
      seen[name] = true
      redis.call("RPUSH", queueKey, name)
    end
    redis.call("SET", dedupePrefix .. name, "1", "EX", ttlSeconds)
  end
end
redis.call("DEL", processingKey)
return recovered
`

export type QueueRecoveryRedisClient = Pick<RedisClientType, "sendCommand">

export async function recoverProcessingRepoJobsWithClient(redis: QueueRecoveryRedisClient): Promise<string[]> {
  return redis.sendCommand<string[]>([
    "EVAL", ATOMIC_RECOVER_REPO_JOBS_SCRIPT, "2",
    REPO_QUEUE_KEY, REPO_PROCESSING_QUEUE_KEY,
    REPO_QUEUE_DEDUPE_PREFIX, String(REPO_QUEUE_DEDUPE_TTL_SECONDS),
  ])
}

export async function recoverProcessingRepoJobs(): Promise<string[]> {
  const redis = await getRedisClient()
  return recoverProcessingRepoJobsWithClient(redis)
}

export async function listQueuedRepoJobs(): Promise<string[]> {
  const redis = await getRedisClient()
  const [queued, processing] = await Promise.all([
    redis.lRange(REPO_QUEUE_KEY, 0, -1),
    redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1),
  ])

  return Array.from(new Set([...queued, ...processing].map(canonicalizeRepoFullName)))
}

export async function dropRepoJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  const aliases = await loadStoredRepoAliases(redis, fullName)
  const tx = redis.multi()

  for (const alias of aliases) {
    tx.lRem(REPO_QUEUE_KEY, 0, alias)
    tx.lRem(REPO_PROCESSING_QUEUE_KEY, 0, alias)
    tx.del(queueDedupeKey(alias))
    tx.del(legacyQueueDedupeKey(alias))
  }

  await tx.exec()
}
