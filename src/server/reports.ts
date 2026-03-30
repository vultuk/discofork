import type { FinalReport } from "../core/types.ts"
import { query } from "./database.ts"

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
  created_at: string
  updated_at: string
}

export async function getRepoRecord(fullName: string): Promise<RepoRecord | null> {
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

export async function markRepoProcessing(fullName: string): Promise<void> {
  await query(
    `update repo_reports
    set status = 'processing',
        processing_started_at = now(),
        error_message = null,
        updated_at = now()
    where full_name = $1`,
    [fullName],
  )
}

export async function markRepoReady(report: FinalReport): Promise<void> {
  await query(
    `update repo_reports
    set status = 'ready',
        report_json = $2::jsonb,
        error_message = null,
        cached_at = now(),
        updated_at = now()
    where full_name = $1`,
    [report.repository.fullName, JSON.stringify(report)],
  )
}

export async function markRepoFailed(fullName: string, errorMessage: string): Promise<void> {
  await query(
    `update repo_reports
    set status = 'failed',
        error_message = $2,
        updated_at = now()
    where full_name = $1`,
    [fullName, errorMessage],
  )
}

export async function markRepoQueued(fullName: string): Promise<void> {
  await query(
    `update repo_reports
    set status = 'queued',
        error_message = null,
        processing_started_at = null,
        queued_at = now(),
        updated_at = now()
    where full_name = $1`,
    [fullName],
  )
}
