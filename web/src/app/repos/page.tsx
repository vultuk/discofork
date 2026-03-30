import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Database, GitFork, HardDriveDownload, LoaderCircle, Star } from "lucide-react"

import { RepoOrderSelect } from "@/components/repo-order-select"
import { RepoStatusFilter } from "@/components/repo-status-filter"
import { RequeueFailedButton } from "@/components/requeue-failed-button"
import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { fetchRepositoryList } from "@/lib/repository-list-api"
import type { RepoListItem, RepoListOrder, RepoListStatusFilter } from "@/lib/repository-list"
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

function statusVariant(status: RepoListItem["status"]): "muted" | "success" | "warning" {
  switch (status) {
    case "ready":
      return "success"
    case "failed":
      return "warning"
    default:
      return "muted"
  }
}

function statusTimestampLabel(item: RepoListItem): string {
  switch (item.status) {
    case "ready":
      return `Cached ${formatDate(item.cachedAt)}`
    case "processing":
      return `Processing since ${formatDate(item.processingStartedAt ?? item.updatedAt)}`
    case "failed":
      return `Failed ${formatDate(item.updatedAt)}`
    default:
      return `Queued ${formatDate(item.queuedAt)}`
  }
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%"
  }

  return `${Math.round(value)}%`
}

export default async function ReposPage({ searchParams }: RepoIndexPageProps) {
  const resolvedSearchParams = await searchParams
  const page = parsePage(resolvedSearchParams?.page)
  const order = parseOrder(resolvedSearchParams?.order)
  const statusFilter = parseStatusFilter(resolvedSearchParams?.status)
  const view = await fetchRepositoryList(page, order, statusFilter)
  const cachedCoverage = view.stats.total === 0 ? 0 : (view.stats.cached / view.stats.total) * 100
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
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Repos Added</div>
                <div className="text-3xl font-semibold tracking-tight text-slate-950">{view.stats.total.toLocaleString()}</div>
              </div>
              <Database className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              All repository records currently stored by the backend.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">In Queue</div>
                <div className="text-3xl font-semibold tracking-tight text-slate-950">{view.stats.pending.toLocaleString()}</div>
              </div>
              <LoaderCircle className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {view.stats.queued.toLocaleString()} queued and {view.stats.processing.toLocaleString()} currently processing.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-white px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Cached</div>
                <div className="text-3xl font-semibold tracking-tight text-slate-950">{view.stats.cached.toLocaleString()}</div>
              </div>
              <HardDriveDownload className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {formatPercent(cachedCoverage)} of indexed repos are ready to open as cached briefs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-white px-5 py-4">
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              <span>{view.total.toLocaleString()} repos indexed</span>
            </div>
            <div>Page {view.totalPages === 0 ? 0 : view.page} of {view.totalPages}</div>
            <div>{view.pageSize} repos per page</div>
            {view.stats.failed > 0 ? <div>{view.stats.failed.toLocaleString()} failed</div> : null}
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <RepoOrderSelect value={view.order} />
            <RepoStatusFilter value={view.statusFilter} />
            <RequeueFailedButton failedCount={view.stats.failed} queueEnabled={view.queueEnabled} />
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
          <div className="rounded-md border border-border bg-white p-6 text-sm leading-7 text-slate-700">
            `DATABASE_URL` is not configured for the web backend yet, so the repository index is unavailable.
          </div>
        ) : view.items.length === 0 ? (
          <div className="rounded-md border border-border bg-white p-6 text-sm leading-7 text-slate-700">
            No repositories have been indexed yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-white">
            {view.items.map((item) => (
              <Link
                key={item.fullName}
                href={`/${item.owner}/${item.repo}`}
                className="block border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="truncate text-sm font-semibold text-slate-950">{item.fullName}</div>
                      <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      {item.status === "ready" ? <Badge variant="muted">{item.forkBriefCount} fork briefs</Badge> : null}
                    </div>
                    <p className="max-w-[120ch] text-sm leading-6 text-slate-600">
                      {item.upstreamSummary ?? "No cached upstream summary is available yet."}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span>{statusTimestampLabel(item)}</span>
                      {item.defaultBranch ? <span>Default branch {item.defaultBranch}</span> : null}
                      {item.lastPushedAt ? <span>Last pushed {formatDate(item.lastPushedAt)}</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4 text-xs text-slate-500">
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
                    <span className="flex items-center gap-1.5 text-slate-700">
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
