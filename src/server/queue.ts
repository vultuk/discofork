import { createClient, type RedisClientType } from "redis"

import { REPO_PROCESSING_QUEUE_KEY, REPO_QUEUE_DEDUPE_PREFIX, REPO_QUEUE_DEDUPE_TTL_SECONDS, REPO_QUEUE_KEY } from "./constants.ts"

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
  return `${REPO_QUEUE_DEDUPE_PREFIX}${fullName}`
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

async function repoJobAlreadyTracked(redis: RedisClientType, fullName: string): Promise<boolean> {
  const [queuedIndex, processingIndex] = await Promise.all([
    redis.sendCommand<number | null>(["LPOS", REPO_QUEUE_KEY, fullName]),
    redis.sendCommand<number | null>(["LPOS", REPO_PROCESSING_QUEUE_KEY, fullName]),
  ])

  return typeof queuedIndex === "number" || typeof processingIndex === "number"
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

  if (await repoJobAlreadyTracked(redis, fullName)) {
    await restoreQueueDedupe(redis, fullName)
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
  await redis.multi().lRem(REPO_PROCESSING_QUEUE_KEY, 1, fullName).del(queueDedupeKey(fullName)).exec()
}

export async function requeueProcessingJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  await redis.multi().lRem(REPO_PROCESSING_QUEUE_KEY, 1, fullName).lPush(REPO_QUEUE_KEY, fullName).exec()
}

export type QueueRecoveryRedisClient = Pick<RedisClientType, "lRange" | "multi">

export async function recoverProcessingRepoJobsWithClient(redis: QueueRecoveryRedisClient): Promise<string[]> {
  const processing = await redis.lRange(REPO_PROCESSING_QUEUE_KEY, 0, -1)
  const recoveredJobs = Array.from(new Set(processing))

  if (recoveredJobs.length === 0) {
    return []
  }

  const multi = redis.multi()
  for (const fullName of recoveredJobs) {
    multi.rPush(REPO_QUEUE_KEY, fullName)
    multi.set(queueDedupeKey(fullName), "1", {
      EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
    })
  }
  multi.del(REPO_PROCESSING_QUEUE_KEY)
  await multi.exec()

  return recoveredJobs
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

  return Array.from(new Set([...queued, ...processing]))
}

export async function dropRepoJob(fullName: string): Promise<void> {
  const redis = await getRedisClient()
  await redis.multi().lRem(REPO_QUEUE_KEY, 0, fullName).lRem(REPO_PROCESSING_QUEUE_KEY, 0, fullName).del(queueDedupeKey(fullName)).exec()
}
