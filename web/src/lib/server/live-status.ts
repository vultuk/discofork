import { REPO_PROGRESS_PREFIX } from "./constants"
import { query } from "./database"
import { canonicalizeRepoFullName, repoIdentifierAliases } from "./repo-key"
import { getRedisClient, getRepoQueueState, queueConfigured } from "./queue"

export type RepoProgressSnapshot = {
  phase: string | null
  detail: string | null
  current: number | null
  total: number | null
  updatedAt: string | null
}

export type RepoStatusSnapshot = {
  status: "queued" | "processing" | "ready" | "failed"
  queuePosition: number | null
  progress: RepoProgressSnapshot | null
  errorMessage: string | null
  queuedAt: string | null
  processingStartedAt: string | null
  cachedAt: string | null
  retryCount: number
  retryState: "none" | "retrying" | "terminal"
  nextRetryAt: string | null
  lastFailedAt: string | null
}

type ProgressPayload = {
  status: "queued" | "processing" | "ready" | "failed"
  phase: string | null
  detail: string | null
  current: number | null
  total: number | null
  updatedAt: string
}

function progressKey(fullName: string): string {
  return `${REPO_PROGRESS_PREFIX}${canonicalizeRepoFullName(fullName)}`
}

function legacyProgressKey(fullName: string): string {
  return `${REPO_PROGRESS_PREFIX}${fullName.trim()}`
}

async function getRedisProgress(fullName: string): Promise<ProgressPayload | null> {
  if (!queueConfigured()) {
    return null
  }

  const client = await getRedisClient()
  const canonicalFullName = canonicalizeRepoFullName(fullName)

  try {
    const canonicalRaw = await client.get(progressKey(canonicalFullName))
    if (canonicalRaw) {
      return JSON.parse(canonicalRaw) as ProgressPayload
    }

    for (const alias of repoIdentifierAliases(fullName)) {
      const legacyRaw = await client.get(legacyProgressKey(alias))
      if (legacyRaw) {
        return JSON.parse(legacyRaw) as ProgressPayload
      }
    }
  } catch {
    return null
  }

  return null
}

export async function getRepoStatusSnapshot(fullName: string): Promise<RepoStatusSnapshot | null> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const rows = await query<{
    status: "queued" | "processing" | "ready" | "failed"
    error_message: string | null
    queued_at: string | null
    processing_started_at: string | null
    cached_at: string | null
    retry_count: number
    retry_state: "none" | "retrying" | "terminal"
    next_retry_at: string | null
    last_failed_at: string | null
  }>(
    `select
      status,
      error_message,
      queued_at,
      processing_started_at,
      cached_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at
    from repo_reports
    where lower(full_name) = lower($1)
    order by case when full_name = $1 then 0 else 1 end, updated_at desc
    limit 1`,
    [canonicalFullName],
  )

  const row = rows[0]
  if (!row) {
    return null
  }

  const [queueState, liveProgress] = await Promise.all([
    queueConfigured() ? getRepoQueueState(canonicalFullName) : Promise.resolve({ queuePosition: null, processing: false }),
    getRedisProgress(fullName),
  ])

  const status =
    row.status === "ready"
      ? "ready"
      : liveProgress?.status === "processing" || queueState.processing || row.status === "processing"
        ? "processing"
        : row.status

  return {
    status,
    queuePosition: status === "queued" ? queueState.queuePosition : null,
    progress:
      liveProgress && (liveProgress.phase || liveProgress.detail || liveProgress.current !== null || liveProgress.total !== null)
        ? {
            phase: liveProgress.phase,
            detail: liveProgress.detail,
            current: liveProgress.current,
            total: liveProgress.total,
            updatedAt: liveProgress.updatedAt,
          }
        : null,
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    processingStartedAt: row.processing_started_at,
    cachedAt: row.cached_at,
    retryCount: row.retry_count ?? 0,
    retryState: row.retry_state ?? "none",
    nextRetryAt: row.next_retry_at,
    lastFailedAt: row.last_failed_at,
  }
}
