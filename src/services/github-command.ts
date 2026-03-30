import { setTimeout as sleep } from "node:timers/promises"

import { AppError } from "../core/errors.ts"
import type { Logger } from "../core/logger.ts"
import type { CommandResult, CommandSpec } from "../core/types.ts"
import { GITHUB_API_BUDGET_KEY, GITHUB_API_PAUSE_UNTIL_KEY, GITHUB_RATE_LIMIT_SNAPSHOT_KEY } from "../server/constants.ts"
import { getRedisClient } from "../server/queue.ts"
import { parseTimeoutSetting, runCommand } from "./command.ts"

type RunGitHubCommandOptions = {
  logger?: Logger
  allowFailure?: boolean
  timeoutMs?: number
}

const DEFAULT_GITHUB_API_HOURLY_LIMIT = Number(process.env.DISCOFORK_GITHUB_API_HOURLY_LIMIT ?? "5000")
const DEFAULT_GITHUB_API_SOFT_LIMIT = Number(process.env.DISCOFORK_GITHUB_API_SOFT_LIMIT ?? "4500")
const DEFAULT_GITHUB_API_WINDOW_SECONDS = Number(process.env.DISCOFORK_GITHUB_API_WINDOW_SECONDS ?? "3600")
const DEFAULT_GITHUB_API_PAUSE_FALLBACK_SECONDS = Number(process.env.DISCOFORK_GITHUB_API_PAUSE_FALLBACK_SECONDS ?? "300")
const DEFAULT_GITHUB_API_PAUSE_POLL_MS = Number(process.env.DISCOFORK_GITHUB_API_PAUSE_POLL_MS ?? "30000")
const DEFAULT_GITHUB_COMMAND_TIMEOUT_MS = parseTimeoutSetting(process.env.DISCOFORK_GITHUB_COMMAND_TIMEOUT_MS, 120000)

type GitHubRateLimitBucket = {
  limit: number
  remaining: number
  used: number
  resetAt: string | null
}

type GitHubRateLimitSnapshot = {
  fetchedAt: string
  core: GitHubRateLimitBucket
  search: GitHubRateLimitBucket
  graphql: GitHubRateLimitBucket
}

type GitHubRateLimitApiResponse = {
  resources?: {
    core?: {
      limit?: number
      remaining?: number
      used?: number
      reset?: number
    }
    search?: {
      limit?: number
      remaining?: number
      used?: number
      reset?: number
    }
    graphql?: {
      limit?: number
      remaining?: number
      used?: number
      reset?: number
    }
  }
}

function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL)
}

function isGitHubRateLimited(result: CommandResult): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return (
    output.includes("rate limit") ||
    output.includes("secondary rate limit") ||
    output.includes("api rate limit exceeded")
  )
}

function commandFailure(spec: CommandSpec, result: CommandResult): AppError {
  const stderrTail = result.stderr.trim().split("\n").filter(Boolean).at(-1)
  return new AppError(
    "COMMAND_FAILED",
    `${spec.command} ${spec.args.join(" ")} failed with exit code ${result.exitCode}${stderrTail ? `: ${stderrTail}` : ""}`,
    result,
  )
}

function sanitizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function toFiniteNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function toBucket(bucket?: { limit?: number; remaining?: number; used?: number; reset?: number }): GitHubRateLimitBucket {
  const reset = toFiniteNumber(bucket?.reset)
  return {
    limit: toFiniteNumber(bucket?.limit),
    remaining: toFiniteNumber(bucket?.remaining),
    used: toFiniteNumber(bucket?.used),
    resetAt: reset > 0 ? new Date(reset * 1000).toISOString() : null,
  }
}

function parseGitHubRateLimitSnapshot(output: string): GitHubRateLimitSnapshot | null {
  const parsed = JSON.parse(output) as GitHubRateLimitApiResponse
  return {
    fetchedAt: new Date().toISOString(),
    core: toBucket(parsed.resources?.core),
    search: toBucket(parsed.resources?.search),
    graphql: toBucket(parsed.resources?.graphql),
  }
}

async function readCachedGitHubRateLimitSnapshot(): Promise<GitHubRateLimitSnapshot | null> {
  if (!redisConfigured()) {
    return null
  }

  try {
    const redis = await getRedisClient()
    const raw = await redis.get(GITHUB_RATE_LIMIT_SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as GitHubRateLimitSnapshot) : null
  } catch {
    return null
  }
}

async function writeCachedGitHubRateLimitSnapshot(snapshot: GitHubRateLimitSnapshot): Promise<void> {
  if (!redisConfigured()) {
    return
  }

  const redis = await getRedisClient()
  await redis.set(GITHUB_RATE_LIMIT_SNAPSHOT_KEY, JSON.stringify(snapshot))
}

async function refreshGitHubRateLimitSnapshot(logger?: Logger): Promise<GitHubRateLimitSnapshot | null> {
  const result = await runCommand(
    {
      command: "gh",
      args: ["api", "rate_limit"],
    },
    { logger, allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return null
  }

  try {
    const snapshot = parseGitHubRateLimitSnapshot(result.stdout)
    if (!snapshot) {
      return null
    }
    await writeCachedGitHubRateLimitSnapshot(snapshot)
    return snapshot
  } catch {
    return null
  }
}

async function pauseFromSnapshot(snapshot: GitHubRateLimitSnapshot | null, logger?: Logger): Promise<boolean> {
  if (!redisConfigured() || !snapshot?.core.resetAt) {
    return false
  }

  const pauseUntil = Date.parse(snapshot.core.resetAt)
  if (!Number.isFinite(pauseUntil) || snapshot.core.remaining > 0 || pauseUntil <= Date.now()) {
    return false
  }

  const waitSeconds = Math.max(1, Math.ceil((pauseUntil - Date.now()) / 1000))
  const redis = await getRedisClient()
  await redis.set(GITHUB_API_PAUSE_UNTIL_KEY, String(pauseUntil), {
    EX: waitSeconds,
  })
  await logger?.warn("github_api:paused_from_snapshot", {
    remaining: snapshot.core.remaining,
    resumesAt: snapshot.core.resetAt,
  })
  return true
}

async function waitForSharedPause(logger?: Logger): Promise<void> {
  if (!redisConfigured()) {
    return
  }

  const pollMs = sanitizePositiveInteger(DEFAULT_GITHUB_API_PAUSE_POLL_MS, 30000)
  const redis = await getRedisClient()

  while (true) {
    const rawPauseUntil = await redis.get(GITHUB_API_PAUSE_UNTIL_KEY)
    const pauseUntil = Number(rawPauseUntil ?? "0")
    const waitMs = pauseUntil - Date.now()

    if (!Number.isFinite(pauseUntil) || waitMs <= 0) {
      if (rawPauseUntil) {
        await redis.del(GITHUB_API_PAUSE_UNTIL_KEY)
      }

      const snapshot = await readCachedGitHubRateLimitSnapshot()
      const paused = await pauseFromSnapshot(snapshot, logger)
      if (!paused) {
        return
      }
      continue
    }

    await logger?.info("github_api:paused", {
      waitMs,
      resumesAt: new Date(pauseUntil).toISOString(),
    })
    await sleep(Math.min(waitMs, pollMs))
  }
}

async function openSharedPause(logger?: Logger, snapshot?: GitHubRateLimitSnapshot | null): Promise<number> {
  const fallbackSeconds = sanitizePositiveInteger(DEFAULT_GITHUB_API_PAUSE_FALLBACK_SECONDS, 300)
  const snapshotPauseUntil = snapshot?.core.resetAt ? Date.parse(snapshot.core.resetAt) : Number.NaN

  if (!redisConfigured()) {
    const waitMs =
      Number.isFinite(snapshotPauseUntil) && snapshotPauseUntil > Date.now()
        ? snapshotPauseUntil - Date.now()
        : fallbackSeconds * 1000
    await logger?.warn("github_api:local_cooldown_opened", {
      waitSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
      resumesAt: new Date(Date.now() + waitMs).toISOString(),
    })
    return waitMs
  }

  const redis = await getRedisClient()
  const ttlSeconds = await redis.ttl(GITHUB_API_BUDGET_KEY)
  const pauseUntil =
    Number.isFinite(snapshotPauseUntil) && snapshotPauseUntil > Date.now()
      ? snapshotPauseUntil
      : Date.now() + Math.max(ttlSeconds > 0 ? ttlSeconds : 0, fallbackSeconds) * 1000
  const waitSeconds = Math.max(1, Math.ceil((pauseUntil - Date.now()) / 1000))
  await redis.set(GITHUB_API_PAUSE_UNTIL_KEY, String(pauseUntil), {
    EX: waitSeconds,
  })
  await logger?.warn("github_api:cooldown_opened", {
    waitSeconds,
    resumesAt: new Date(pauseUntil).toISOString(),
  })
  return waitSeconds * 1000
}

async function reserveSharedBudget(logger?: Logger): Promise<boolean> {
  if (!redisConfigured()) {
    return true
  }

  const cachedSnapshot = await readCachedGitHubRateLimitSnapshot()
  if (await pauseFromSnapshot(cachedSnapshot, logger)) {
    return false
  }

  const redis = await getRedisClient()
  const budgetLimit = sanitizePositiveInteger(DEFAULT_GITHUB_API_HOURLY_LIMIT, 5000)
  const softLimit = Math.min(
    sanitizePositiveInteger(DEFAULT_GITHUB_API_SOFT_LIMIT, 4500),
    budgetLimit,
  )
  const windowSeconds = sanitizePositiveInteger(DEFAULT_GITHUB_API_WINDOW_SECONDS, 3600)
  const count = await redis.incr(GITHUB_API_BUDGET_KEY)

  if (count === 1) {
    await redis.expire(GITHUB_API_BUDGET_KEY, windowSeconds)
  }

  if (count <= softLimit) {
    return true
  }

  await logger?.warn("github_api:soft_limit_reached", {
    count,
    softLimit,
    hardLimit: budgetLimit,
  })
  await openSharedPause(logger, cachedSnapshot)
  return false
}

export async function runGitHubCommand(
  spec: CommandSpec,
  options: RunGitHubCommandOptions = {},
): Promise<CommandResult> {
  while (true) {
    await waitForSharedPause(options.logger)

    const reserved = await reserveSharedBudget(options.logger)
    if (!reserved) {
      continue
    }

    const result = await runCommand(spec, {
      logger: options.logger,
      allowFailure: true,
      timeoutMs: options.timeoutMs ?? DEFAULT_GITHUB_COMMAND_TIMEOUT_MS,
    })

    if (result.exitCode === 0) {
      return result
    }

    if (isGitHubRateLimited(result)) {
      await options.logger?.warn("github_api:rate_limited", {
        command: spec.command,
        args: spec.args,
        stderr: result.stderr,
        stdout: result.stdout,
      })
      const snapshot = await refreshGitHubRateLimitSnapshot(options.logger)
      const waitMs = await openSharedPause(options.logger, snapshot)
      if (!redisConfigured()) {
        await sleep(waitMs)
      }
      continue
    }

    if (options.allowFailure) {
      return result
    }

    throw commandFailure(spec, result)
  }
}

export const __private__ = {
  isGitHubRateLimited,
  parseGitHubRateLimitSnapshot,
}
