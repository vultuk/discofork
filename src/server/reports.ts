import { AppError } from "../core/errors.ts"
import { serializeJsonSafely } from "../core/json.ts"
import type { FinalReport } from "../core/types.ts"
import { query } from "./database.ts"
import { canonicalizeRepoFullName, canonicalizeRepoIdentity } from "./repo-key.ts"

export type RepoRetryState = "none" | "retrying" | "terminal"

export type RepoFailureHistoryEntry = {
  time: string
  message: string
  state: RepoRetryState
}

export type RepoRecord = {
  full_name: string
  owner: string
  repo: string
  github_url: string
  status: "queued" | "processing" | "ready" | "failed"
  report_json: FinalReport | null
  error_message: string | null
  last_requested_at: string
  queued_at: string | null
  processing_started_at: string | null
  cached_at: string | null
  retry_count: number
  retry_state: RepoRetryState
  next_retry_at: string | null
  last_failed_at: string | null
  last_error_message: string | null
  failure_history: RepoFailureHistoryEntry[]
  created_at: string
  updated_at: string
}

function appendFailureHistorySql(state: RepoRetryState, messagePlaceholder: string): string {
  return `coalesce(repo_reports.failure_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('time', now(), 'message', ${messagePlaceholder}::text, 'state', '${state}'))`
}

export async function getRepoRecord(fullName: string): Promise<RepoRecord | null> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const rows = await query<RepoRecord>(
    `select
      full_name,
      owner,
      repo,
      github_url,
      status,
      report_json,
      error_message,
      last_requested_at,
      queued_at,
      processing_started_at,
      cached_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at,
      last_error_message,
      failure_history,
      created_at,
      updated_at
    from repo_reports
    where lower(full_name) = lower($1)
    order by case when full_name = $1 then 0 else 1 end, updated_at desc
    limit 1`,
    [canonicalFullName],
  )

  return rows[0] ?? null
}

export async function touchQueuedRepo(owner: string, repo: string, queuedNow: boolean): Promise<void> {
  const canonical = canonicalizeRepoIdentity(owner, repo)

  await query(
    `insert into repo_reports (
      full_name, owner, repo, github_url, status, last_requested_at, queued_at, updated_at
    ) values ($1, $2, $3, $4, 'queued', now(), now(), now())
    on conflict (full_name) do update
    set
      owner = excluded.owner,
      repo = excluded.repo,
      github_url = excluded.github_url,
      status = case
        when repo_reports.status = 'ready' and repo_reports.report_json is not null and $5 = false then repo_reports.status
        when repo_reports.status in ('queued', 'processing') and $5 = false then repo_reports.status
        else 'queued'
      end,
      error_message = case
        when (repo_reports.status = 'ready' and repo_reports.report_json is not null and $5 = false)
          or (repo_reports.status in ('queued', 'processing') and $5 = false)
          then repo_reports.error_message
        else null
      end,
      last_requested_at = now(),
      queued_at = case
        when $5 = true then now()
        else coalesce(repo_reports.queued_at, now())
      end,
      retry_count = case when $5 = true then 0 else repo_reports.retry_count end,
      retry_state = case when $5 = true then 'none' else repo_reports.retry_state end,
      next_retry_at = case when $5 = true then null else repo_reports.next_retry_at end,
      last_failed_at = case when $5 = true then null else repo_reports.last_failed_at end,
      last_error_message = case when $5 = true then null else repo_reports.last_error_message end,
      failure_history = case when $5 = true then '[]'::jsonb else repo_reports.failure_history end,
      updated_at = now()`,
    [canonical.fullName, canonical.owner, canonical.repo, canonical.githubUrl, queuedNow],
  )
}

export async function markRepoProcessing(fullName: string): Promise<void> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)

  await query(
    `update repo_reports
    set status = 'processing',
        processing_started_at = coalesce(processing_started_at, now()),
        error_message = null,
        updated_at = now()
    where lower(full_name) = lower($1)`,
    [canonicalFullName],
  )
}

export async function markRepoRetrying(fullName: string, retryCount: number, nextRetryAt: string, errorMessage: string): Promise<void> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)

  await query(
    `update repo_reports
    set status = 'processing',
        retry_count = $2,
        retry_state = 'retrying',
        next_retry_at = $3::timestamptz,
        last_failed_at = now(),
        last_error_message = $4,
        error_message = $4,
        failure_history = ${appendFailureHistorySql("retrying", "$4")},
        updated_at = now()
    where lower(full_name) = lower($1)`,
    [canonicalFullName, retryCount, nextRetryAt, errorMessage],
  )
}

export async function markRepoReady(report: FinalReport): Promise<void> {
  const canonicalFullName = canonicalizeRepoFullName(report.repository.fullName)
  const serialized = serializeJsonSafely(report)

  if (serialized.sanitizedPaths.length > 0) {
    console.warn(
      `Sanitized malformed Unicode before storing report_json for ${report.repository.fullName}: ${serialized.sanitizedPaths.join(", ")}`,
    )
  }

  try {
    await query(
      `update repo_reports
      set status = 'ready',
          report_json = $2::jsonb,
          error_message = null,
          cached_at = now(),
          retry_state = 'none',
          next_retry_at = null,
          last_error_message = null,
          updated_at = now()
      where lower(full_name) = lower($1)`,
      [canonicalFullName, serialized.json],
    )
  } catch (error) {
    if (error instanceof Error && /invalid input syntax for type json/i.test(error.message)) {
      throw new AppError(
        "INVALID_REPORT_JSON",
        `Could not persist report_json for ${report.repository.fullName}. Sanitized paths: ${serialized.sanitizedPaths.join(", ") || "none recorded"}.`,
        {
          fullName: report.repository.fullName,
          sanitizedPaths: serialized.sanitizedPaths,
        },
      )
    }

    throw error
  }
}

export async function markRepoFailedTerminal(fullName: string, retryCount: number, errorMessage: string): Promise<void> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)

  await query(
    `update repo_reports
    set status = 'failed',
        retry_count = $2,
        retry_state = 'terminal',
        next_retry_at = null,
        last_failed_at = now(),
        last_error_message = $3,
        error_message = $3,
        failure_history = ${appendFailureHistorySql("terminal", "$3")},
        updated_at = now()
    where lower(full_name) = lower($1)`,
    [canonicalFullName, retryCount, errorMessage],
  )
}

export async function markRepoQueued(fullName: string): Promise<void> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)

  await query(
    `update repo_reports
    set status = 'queued',
        error_message = null,
        processing_started_at = null,
        queued_at = now(),
        retry_count = 0,
        retry_state = 'none',
        next_retry_at = null,
        last_failed_at = null,
        last_error_message = null,
        failure_history = '[]'::jsonb,
        updated_at = now()
    where lower(full_name) = lower($1)`,
    [canonicalFullName],
  )
}
