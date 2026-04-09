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

async function findStoredRepoEntries(redis: RedisClientType, fullName: string): Promise<string[]> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const [queued, processing] = await Promise.all([
    redis.lRange(REPO_QUEUE_KEY, 0, -1),
    redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1),
  ])

  return Array.from(
    new Set([
      ...queued.filter((entry) => canonicalizeRepoFullName(entry) === canonicalFullName),
      ...processing.filter((entry) => canonicalizeRepoFullName(entry) === canonicalFullName),
    ]),
  )
}

async function loadStoredRepoAliases(redis: RedisClientType, fullName: string): Promise<string[]> {
  return Array.from(new Set([...repoIdentifierAliases(fullName), ...(await findStoredRepoEntries(redis, fullName))]))
}

export async function enqueueRepoJob(fullName: string): Promise<boolean> {
  const redis = await getRedisClient()
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const existingEntries = await findStoredRepoEntries(redis, canonicalFullName)

  if (existingEntries.length > 0) {
    await redis.set(queueDedupeKey(canonicalFullName), "1", {
      EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
    })
    return false
  }

  const key = queueDedupeKey(canonicalFullName)
  const wasQueued = await redis.set(key, "1", {
    NX: true,
    EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
  })

  if (!wasQueued) {
    return false
  }

  await redis.lPush(REPO_QUEUE_KEY, canonicalFullName)
  return true
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

export async function listQueuedRepoJobs(): Promise<string[]> {
  const redis = await getRedisClient()
  const [queued, processing] = await Promise.all([
    redis.lRange(REPO_QUEUE_KEY, 0, -1),
    redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1),
  ])

  return Array.from(new Set([...queued, ...processing].map((fullName) => canonicalizeRepoFullName(fullName))))
}

export async function dropRepoJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  const aliases = await loadStoredRepoAliases(redis, fullName)
  const tx = redis.multi()

  for (const alias of aliases) {
    tx.lRem(REPO_QUEUE_KEY, 0, alias)
    tx.lRem(REPO_PROCESSING_QUEUE_KEY, 0, alias)
    tx.del(queueDedupeKey(alias))
  }

  await tx.exec()
}
