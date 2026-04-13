import type { Metadata } from "next"
import Link from "next/link"
import { Database, Search } from "lucide-react"

import { CompareBar } from "@/components/compare-toggle"
import { QueueInput } from "@/components/queue-input"
import { RepoOrderSelect } from "@/components/repo-order-select"
import { RepoStatusFilter } from "@/components/repo-status-filter"
import { RepoShell } from "@/components/repo-shell"
import { RepoTagFilter } from "@/components/repo-tag-filter"
import { RepoListKeyboardProvider } from "@/components/repo-keyboard-provider"
import { RepoViewToggle } from "@/components/repo-view-toggle"
import { RepoListView } from "@/components/repo-list-view"
import { buttonVariants } from "@/components/ui/button"
import { REPO_LIST_PAGE_SIZE, type RepoListOrder, type RepoListStatusFilter, type RepoListView as RepoListViewType } from "@/lib/repository-list"
import { buildRepoListHref, normalizeRepoListQuery, parseRepoListOrder, parseRepoListPage, parseRepoListStatusFilter } from "@/lib/repository-list-query"
import { databaseConfigured } from "@/lib/server/database"
import { queueConfigured } from "@/lib/server/queue"
import { listRepoRecords } from "@/lib/server/reports"
import { cn } from "@/lib/utils"

type RepoIndexPageProps = {
  searchParams?: Promise<{
    page?: string
    order?: string
    status?: string
    query?: string
  }>
}

export const metadata: Metadata = {
  title: "Repository Index · Discofork",
  description: "Browse cached and queued Discofork repository briefs.",
}

async function loadRepositoryListView(
  page: number,
  order: RepoListOrder,
  statusFilter: RepoListStatusFilter,
  query: string,
): Promise<RepoListViewType> {
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
      query,
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

  const { items, stats, total } = await listRepoRecords(page, REPO_LIST_PAGE_SIZE, order, statusFilter, query)
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
    query,
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
  const page = parseRepoListPage(resolvedSearchParams?.page)
  const order = parseRepoListOrder(resolvedSearchParams?.order)
  const statusFilter = parseRepoListStatusFilter(resolvedSearchParams?.status)
  const query = normalizeRepoListQuery(resolvedSearchParams?.query)
  const view = await loadRepositoryListView(page, order, statusFilter, query)
  const previousHref = view.hasPrevious
    ? buildRepoListHref(view.page - 1, view.order, view.statusFilter, view.query)
    : buildRepoListHref(1, view.order, view.statusFilter, view.query)
  const nextHref = view.hasNext
    ? buildRepoListHref(view.page + 1, view.order, view.statusFilter, view.query)
    : buildRepoListHref(view.page, view.order, view.statusFilter, view.query)
  const clearSearchHref = buildRepoListHref(1, view.order, view.statusFilter, "")

  return (
    <RepoShell
      eyebrow="Repository index"
      title="Everything currently stored by the Discofork backend."
      description="Browse cached briefs and queued lookups in one place. Open any row to read the repository summary and fork comparisons."
      compact
    >
      <section className="space-y-6">
        <CompareBar />
        <RepoTagFilter />
        <div className="space-y-4 rounded-md border border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>{view.total.toLocaleString()} {view.query ? "matching repos" : "repos"}</span>
              </div>
              <div>Page {view.totalPages === 0 ? 0 : view.page} of {view.totalPages}</div>
              <div>{view.pageSize}/page</div>
              {view.stats.failed > 0 ? <div>{view.stats.failed.toLocaleString()} failed</div> : null}
            </div>

            {view.query ? (
              <div className="rounded-full border border-border bg-muted/70 px-3 py-1 text-xs text-muted-foreground">
                Matching "{view.query}"
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
            <form action="/repos" className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="repo-query"
                  type="search"
                  name="query"
                  defaultValue={view.query}
                  placeholder="Search owner/repo..."
                  autoComplete="off"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                />
              </div>
              <input type="hidden" name="order" value={view.order} />
              <input type="hidden" name="status" value={view.statusFilter} />
              <div className="flex items-center gap-2">
                <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "rounded-md px-4")}>
                  Search
                </button>
                {view.query ? (
                  <Link href={clearSearchHref} className={cn(buttonVariants({ variant: "ghost" }), "rounded-md px-3")}>
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <RepoOrderSelect value={view.order} />
              <RepoStatusFilter value={view.statusFilter} />
              <RepoViewToggle />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
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
          <div className="rounded-md border border-border bg-card p-6 space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              {view.query ? (
                <>
                  No repositories match <span className="font-medium text-foreground">"{view.query}"</span>. Try a broader owner or repo name, or clear the search.
                </>
              ) : (
                "No repositories have been indexed yet."
              )}
            </p>
            {view.queueEnabled ? (
              <div className="space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Queue a repository</div>
                <QueueInput placeholder="owner/repo to analyze" />
              </div>
            ) : null}
          </div>
        ) : (
          <RepoListKeyboardProvider>
            <RepoListView items={view.items} />
          </RepoListKeyboardProvider>
        )}
      </section>
    </RepoShell>
  )
}
