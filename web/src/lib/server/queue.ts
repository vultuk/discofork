import { createClient, type RedisClientType } from "redis"

import { REPO_PROCESSING_QUEUE_KEY, REPO_QUEUE_DEDUPE_PREFIX, REPO_QUEUE_DEDUPE_TTL_SECONDS, REPO_QUEUE_KEY } from "./constants"

import { canonicalizeRepoFullName } from "./repo-key"

let client: RedisClientType | null = null

export function queueConfigured(): boolean {
  return Boolean(process.env.REDIS_URL)
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required.")
  }

  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL,
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

function queueDedupeKey(fullName: string): string {
  return `${REPO_QUEUE_DEDUPE_PREFIX}${canonicalizeRepoFullName(fullName)}`
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

async function repoJobAlreadyTracked(redis: RedisClientType, fullName: string): Promise<boolean> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const [queuedIndex, processingIndex] = await Promise.all([
    redis.sendCommand<number | null>(["LPOS", REPO_QUEUE_KEY, canonicalFullName]),
    redis.sendCommand<number | null>(["LPOS", REPO_PROCESSING_QUEUE_KEY, canonicalFullName]),
  ])
  if (typeof queuedIndex === "number" || typeof processingIndex === "number") {
    return true
  }
  return (await findStoredRepoEntries(redis, canonicalFullName)).length > 0
}

async function restoreQueueDedupe(redis: RedisClientType, fullName: string): Promise<void> {
  await redis.set(queueDedupeKey(fullName), "1", {
    EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
  })
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

  if (await repoJobAlreadyTracked(redis, fullName)) {
    await restoreQueueDedupe(redis, fullName)
    return false
  }

  return enqueueRepoJobAtomically(redis, fullName)
}

export async function getRepoQueueState(fullName: string): Promise<{
  queuePosition: number | null
  processing: boolean
}> {
  const redis = await getRedisClient()
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const [queueIndex, queueLength, processingIndex] = await Promise.all([
    redis.sendCommand<number | null>(["LPOS", REPO_QUEUE_KEY, canonicalFullName]),
    redis.lLen(REPO_QUEUE_KEY),
    redis.sendCommand<number | null>(["LPOS", REPO_PROCESSING_QUEUE_KEY, canonicalFullName]),
  ])

  if (typeof queueIndex === "number" || typeof processingIndex === "number") {
    return {
      queuePosition:
        typeof queueIndex === "number" && queueLength > 0
          ? Math.max(1, queueLength - queueIndex)
          : null,
      processing: typeof processingIndex === "number",
    }
  }

  const [queuedEntries, processingEntries] = await Promise.all([
    redis.lRange(REPO_QUEUE_KEY, 0, -1),
    redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1),
  ])
  const legacyQueueIndex = queuedEntries.findIndex((entry) => canonicalizeRepoFullName(entry) === canonicalFullName)

  return {
    queuePosition: legacyQueueIndex >= 0 ? Math.max(1, queuedEntries.length - legacyQueueIndex) : null,
    processing: processingEntries.some((entry) => canonicalizeRepoFullName(entry) === canonicalFullName),
  }
}
