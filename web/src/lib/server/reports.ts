import type { RepoListOrder, RepoListStatusFilter } from "../repository-list"
import { query } from "./database"
import { canonicalizeRepoFullName, canonicalizeRepoIdentity } from "./repo-key"

export type RepoRetryState = "none" | "retrying" | "terminal"

export type StoredReportRecord = {
  full_name: string
  owner: string
  repo: string
  github_url: string
  status: "queued" | "processing" | "ready" | "failed"
  report_json: Record<string, unknown> | null
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
  failure_history: Array<{ time: string; message: string; state: RepoRetryState }>
  created_at: string
  updated_at: string
}

export type StoredRepoListRecord = {
  full_name: string
  owner: string
  repo: string
  github_url: string
  status: "queued" | "processing" | "ready" | "failed"
  queued_at: string | null
  processing_started_at: string | null
  cached_at: string | null
  updated_at: string
  retry_count: number
  retry_state: RepoRetryState
  next_retry_at: string | null
  last_failed_at: string | null
  stars: number | null
  forks: number | null
  default_branch: string | null
  last_pushed_at: string | null
  upstream_summary: string | null
  fork_brief_count: number
}

export type RepoListStatsRecord = {
  total: number
  queued: number
  processing: number
  pending: number
  cached: number
  failed: number
}

export async function getRepoRecord(fullName: string): Promise<StoredReportRecord | null> {
  const canonicalFullName = canonicalizeRepoFullName(fullName)
  const rows = await query<StoredReportRecord>(
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

export async function listRepoRecords(
  page: number,
  pageSize: number,
  order: RepoListOrder,
  statusFilter: RepoListStatusFilter,
): Promise<{ items: StoredRepoListRecord[]; stats: RepoListStatsRecord; total: number }> {
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)
  const offset = (safePage - 1) * safePageSize
  const statusWhereClause = statusFilter === "all" ? "" : `where status = '${statusFilter}'`
  const orderByClause =
    order === "forks"
      ? "coalesce(nullif(report_json->'upstream'->'metadata'->>'forkCount', '')::int, -1) desc, updated_at desc, full_name asc"
      : order === "stars"
        ? "coalesce(nullif(report_json->'upstream'->'metadata'->>'stargazerCount', '')::int, -1) desc, updated_at desc, full_name asc"
        : "updated_at desc, full_name asc"

  const statRows = await query<RepoListStatsRecord>(
    `select
      count(*)::int as total,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status in ('queued', 'processing'))::int as pending,
      count(*) filter (where status = 'ready')::int as cached,
      count(*) filter (where status = 'failed')::int as failed
    from repo_reports`,
  )
  const stats = statRows[0] ?? {
    total: 0,
    queued: 0,
    processing: 0,
    pending: 0,
    cached: 0,
    failed: 0,
  }

  const totalRows = await query<{ count: string }>(
    `select count(*)::text as count
    from repo_reports
    ${statusWhereClause}`,
  )
  const total = Number.parseInt(totalRows[0]?.count ?? "0", 10)

  const items = await query<StoredRepoListRecord>(
    `select
      full_name,
      owner,
      repo,
      github_url,
      status,
      queued_at,
      processing_started_at,
      cached_at,
      updated_at,
      retry_count,
      retry_state,
      next_retry_at,
      last_failed_at,
      nullif(report_json->'upstream'->'metadata'->>'stargazerCount', '')::int as stars,
      nullif(report_json->'upstream'->'metadata'->>'forkCount', '')::int as forks,
      report_json->'upstream'->'metadata'->>'defaultBranch' as default_branch,
      report_json->'upstream'->'metadata'->>'pushedAt' as last_pushed_at,
      report_json->'upstream'->'analysis'->>'summary' as upstream_summary,
      coalesce(jsonb_array_length(coalesce(report_json->'forks', '[]'::jsonb)), 0) as fork_brief_count
    from repo_reports
    ${statusWhereClause}
    order by ${orderByClause}
    limit $1
    offset $2`,
    [safePageSize, offset],
  )

  return { items, stats, total }
}

export async function listFailedRepoNames(): Promise<string[]> {
  const rows = await query<{ full_name: string }>(
    `select full_name
    from repo_reports
    where status = 'failed'
    order by updated_at desc, full_name asc`,
  )

  return Array.from(new Set(rows.map((row) => canonicalizeRepoFullName(row.full_name))))
}

export async function markReposQueued(fullNames: string[]): Promise<void> {
  const canonicalFullNames = Array.from(new Set(fullNames.map((fullName) => canonicalizeRepoFullName(fullName))))
  if (canonicalFullNames.length === 0) {
    return
  }

  await query(
    `update repo_reports
    set status = 'queued',
        error_message = null,
        queued_at = now(),
        processing_started_at = null,
        retry_count = 0,
        retry_state = 'none',
        next_retry_at = null,
        last_failed_at = null,
        last_error_message = null,
        failure_history = '[]'::jsonb,
        updated_at = now(),
        last_requested_at = now()
    where lower(full_name) = any($1::text[])`,
    [canonicalFullNames],
  )
}
