import { query } from "./database"

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
      created_at,
      updated_at
    from repo_reports
    where full_name = $1`,
    [fullName],
  )

  return rows[0] ?? null
}

export async function touchQueuedRepo(owner: string, repo: string, queuedNow: boolean): Promise<void> {
  const fullName = `${owner}/${repo}`
  const githubUrl = `https://github.com/${fullName}`

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
      updated_at = now()`,
    [fullName, owner, repo, githubUrl, queuedNow],
  )
}

export async function listRepoRecords(
  page: number,
  pageSize: number,
): Promise<{ items: StoredRepoListRecord[]; stats: RepoListStatsRecord }> {
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)
  const offset = (safePage - 1) * safePageSize

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
      nullif(report_json->'upstream'->'metadata'->>'stargazerCount', '')::int as stars,
      nullif(report_json->'upstream'->'metadata'->>'forkCount', '')::int as forks,
      report_json->'upstream'->'metadata'->>'defaultBranch' as default_branch,
      report_json->'upstream'->'metadata'->>'pushedAt' as last_pushed_at,
      report_json->'upstream'->'analysis'->>'summary' as upstream_summary,
      coalesce(jsonb_array_length(coalesce(report_json->'forks', '[]'::jsonb)), 0) as fork_brief_count
    from repo_reports
    order by coalesce(cached_at, queued_at, updated_at) desc, full_name asc
    limit $1
    offset $2`,
    [safePageSize, offset],
  )

  return { items, stats }
}
