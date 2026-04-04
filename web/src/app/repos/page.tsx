import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Database, GitFork, Star } from "lucide-react"

import { RepoOrderSelect } from "@/components/repo-order-select"
import { RepoStatusFilter } from "@/components/repo-status-filter"
import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { REPO_LIST_PAGE_SIZE, type RepoListItem, type RepoListOrder, type RepoListStatusFilter, type RepoListView } from "@/lib/repository-list"
import { databaseConfigured } from "@/lib/server/database"
import { queueConfigured } from "@/lib/server/queue"
import { listRepoRecords } from "@/lib/server/reports"
import { cn } from "@/lib/utils"

type RepoIndexPageProps = {
  searchParams?: Promise<{
    page?: string
    order?: string
    status?: string
  }>
}

export const metadata: Metadata = {
  title: "Repository Index · Discofork",
  description: "Browse cached and queued Discofork repository briefs.",
}

function parsePage(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseOrder(rawValue: string | undefined): RepoListOrder {
  switch (rawValue) {
    case "forks":
    case "stars":
      return rawValue
    default:
      return "updated"
  }
}

function parseStatusFilter(rawValue: string | undefined): RepoListStatusFilter {
  switch (rawValue) {
    case "queued":
    case "ready":
    case "processing":
    case "failed":
      return rawValue
    default:
      return "all"
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not yet"
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10)
}

function statusVariant(item: RepoListItem): "muted" | "success" | "warning" {
  if (item.status === "ready") {
    return "success"
  }

  if (item.retryState === "retrying" || item.retryState === "terminal" || item.status === "failed") {
    return "warning"
  }

  return "muted"
}

function statusLabel(item: RepoListItem): string {
  if (item.status === "processing" && item.retryState === "retrying") {
    return "retrying"
  }

  if (item.status === "failed" && item.retryState === "terminal") {
    return "terminal failure"
  }

  return item.status
}

function statusTimestampLabel(item: RepoListItem): string {
  if (item.status === "processing" && item.retryState === "retrying") {
    return item.nextRetryAt ? `Retry ${item.retryCount} scheduled for ${formatDate(item.nextRetryAt)}` : `Retry ${item.retryCount} is pending`
  }

  switch (item.status) {
    case "ready":
      return `Cached ${formatDate(item.cachedAt)}`
    case "processing":
      return `Processing since ${formatDate(item.processingStartedAt ?? item.updatedAt)}`
    case "failed":
      return item.retryState === "terminal" && item.lastFailedAt
        ? `Retry budget exhausted ${formatDate(item.lastFailedAt)}`
        : `Failed ${formatDate(item.updatedAt)}`
    default:
      return `Queued ${formatDate(item.queuedAt)}`
  }
}

async function loadRepositoryListView(page: number, order: RepoListOrder, statusFilter: RepoListStatusFilter): Promise<RepoListView> {
  if (!databaseConfigured()) {
    return {
      items: [],
      stats: {
        total: 0,
        queued: 0,
        processing: 0,
        pending: 0,
        cached: 0,
        failed: 0,
      },
      order,
      statusFilter,
      page,
      pageSize: REPO_LIST_PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasPrevious: page > 1,
      hasNext: false,
      databaseEnabled: false,
      queueEnabled: queueConfigured(),
    }
  }

  const { items, stats, total } = await listRepoRecords(page, REPO_LIST_PAGE_SIZE, order, statusFilter)
  const totalPages = total === 0 ? 0 : Math.ceil(total / REPO_LIST_PAGE_SIZE)

  return {
    items: items.map((item) => ({
      fullName: item.full_name,
      owner: item.owner,
      repo: item.repo,
      githubUrl: item.github_url,
      status: item.status,
      queuedAt: item.queued_at,
      processingStartedAt: item.processing_started_at,
      cachedAt: item.cached_at,
      updatedAt: item.updated_at,
      retryCount: item.retry_count,
      retryState: item.retry_state,
      nextRetryAt: item.next_retry_at,
      lastFailedAt: item.last_failed_at,
      stars: item.stars,
      forks: item.forks,
      defaultBranch: item.default_branch,
      lastPushedAt: item.last_pushed_at,
      upstreamSummary: item.upstream_summary,
      forkBriefCount: item.fork_brief_count,
    })),
    stats,
    order,
    statusFilter,
    page,
    pageSize: REPO_LIST_PAGE_SIZE,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    databaseEnabled: true,
    queueEnabled: queueConfigured(),
  }
}

export default async function ReposPage({ searchParams }: RepoIndexPageProps) {
  const resolvedSearchParams = await searchParams
  const page = parsePage(resolvedSearchParams?.page)
  const order = parseOrder(resolvedSearchParams?.order)
  const statusFilter = parseStatusFilter(resolvedSearchParams?.status)
  const view = await loadRepositoryListView(page, order, statusFilter)
  const previousHref = view.hasPrevious
    ? `/repos?page=${view.page - 1}&order=${view.order}&status=${view.statusFilter}`
    : `/repos?order=${view.order}&status=${view.statusFilter}`
  const nextHref = view.hasNext
    ? `/repos?page=${view.page + 1}&order=${view.order}&status=${view.statusFilter}`
    : `/repos?page=${view.page}&order=${view.order}&status=${view.statusFilter}`

  return (
    <RepoShell
      eyebrow="Repository index"
      title="Everything currently stored by the Discofork backend."
      description="Browse cached briefs and queued lookups in one place. Open any row to read the repository summary and fork comparisons."
      compact
    >
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span>{view.total.toLocaleString()} repos</span>
            </div>
            <div>Page {view.totalPages === 0 ? 0 : view.page} of {view.totalPages}</div>
            <div>{view.pageSize} repos per page</div>
            {view.stats.failed > 0 ? <div>{view.stats.failed.toLocaleString()} failed</div> : null}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <RepoOrderSelect value={view.order} />
            <RepoStatusFilter value={view.statusFilter} />
            <Link
              href={previousHref}
              aria-disabled={!view.hasPrevious}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-md px-4",
                !view.hasPrevious && "pointer-events-none opacity-50",
              )}
            >
              Previous
            </Link>
            <Link
              href={nextHref}
              aria-disabled={!view.hasNext}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "rounded-md px-4",
                !view.hasNext && "pointer-events-none opacity-50",
              )}
            >
              Next
            </Link>
          </div>
        </div>

        {!view.databaseEnabled ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            `DATABASE_URL` is not configured for the web backend yet, so the repository index is unavailable.
          </div>
        ) : view.items.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            No repositories have been indexed yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {view.items.map((item) => (
              <Link
                key={item.fullName}
                href={`/${item.owner}/${item.repo}`}
                className="block border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="truncate text-sm font-semibold text-foreground">{item.fullName}</div>
                      <Badge variant={statusVariant(item)}>{statusLabel(item)}</Badge>
                      {item.status === "ready" ? <Badge variant="muted">{item.forkBriefCount} fork briefs</Badge> : null}
                    </div>
                    <p className="max-w-[120ch] text-sm leading-6 text-muted-foreground">
                      {item.upstreamSummary ?? "No cached upstream summary is available yet."}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span>{statusTimestampLabel(item)}</span>
                      {item.defaultBranch ? <span>Default branch {item.defaultBranch}</span> : null}
                      {item.lastPushedAt ? <span>Last pushed {formatDate(item.lastPushedAt)}</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    {typeof item.stars === "number" ? (
                      <span className="flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5" />
                        {item.stars.toLocaleString()}
                      </span>
                    ) : null}
                    {typeof item.forks === "number" ? (
                      <span className="flex items-center gap-1.5">
                        <GitFork className="h-3.5 w-3.5" />
                        {item.forks.toLocaleString()}
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </RepoShell>
  )
}
