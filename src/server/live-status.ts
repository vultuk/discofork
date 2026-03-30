import type { Logger } from "../core/logger.ts"
import { REPO_PROGRESS_PREFIX, REPO_PROGRESS_TTL_SECONDS } from "./constants.ts"
import { getRedisClient } from "./queue.ts"

export type RepoLiveStatusPayload = {
  status: "queued" | "processing" | "ready" | "failed"
  phase: string | null
  detail: string | null
  current: number | null
  total: number | null
  updatedAt: string
}

function progressKey(fullName: string): string {
  return `${REPO_PROGRESS_PREFIX}${fullName}`
}

export async function writeRepoLiveStatus(
  fullName: string,
  payload: Omit<RepoLiveStatusPayload, "updatedAt">,
  logger?: Logger,
): Promise<void> {
  const redis = await getRedisClient()
  const value: RepoLiveStatusPayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
  }

  await redis.set(progressKey(fullName), JSON.stringify(value), {
    EX: REPO_PROGRESS_TTL_SECONDS,
  })
  await logger?.debug("repo_live_status:write", {
    repository: fullName,
    ...value,
  })
}
