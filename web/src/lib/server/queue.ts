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

export async function enqueueRepoJob(fullName: string): Promise<boolean> {
  const redis = await getRedisClient()
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const queued = await redis.set(queueDedupeKey(canonicalFullName), "1", {
    NX: true,
    EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
  })

  if (!queued) {
    return false
  }

  await redis.lPush(REPO_QUEUE_KEY, canonicalFullName)
  return true
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
