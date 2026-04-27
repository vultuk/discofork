import type { Metadata } from "next"
import Link from "next/link"
import { Database, GitFork, Search, Sparkles, Star, Wrench } from "lucide-react"

import { CompareBar } from "@/components/compare-toggle"
import { LocalWorkspacePanel } from "@/components/local-workspace-panel"
import { QueueInput } from "@/components/queue-input"
import { RepoOrderSelect } from "@/components/repo-order-select"
import { RepoLanguageFilter } from "@/components/repo-language-filter"
import { RepoStatusFilter } from "@/components/repo-status-filter"
import { RepoShell } from "@/components/repo-shell"
import { RepoTagFilter } from "@/components/repo-tag-filter"
import { RepoListKeyboardProvider } from "@/components/repo-keyboard-provider"
import { RepoViewToggle } from "@/components/repo-view-toggle"
import { RepoListView } from "@/components/repo-list-view"
import { SavedRepoViews } from "@/components/saved-repo-views"
import { StarterRepoGrid } from "@/components/starter-repo-grid"
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
    language?: string
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

function statLabel(value: number, fallback = "0"): string {
  return value > 0 ? value.toLocaleString() : fallback
}

export default async function ReposPage({ searchParams }: RepoIndexPageProps) {
  const resolvedSearchParams = await searchParams
  const page = parseRepoListPage(resolvedSearchParams?.page)
  const order = parseRepoListOrder(resolvedSearchParams?.order)
  const statusFilter = parseRepoListStatusFilter(resolvedSearchParams?.status)
  const query = normalizeRepoListQuery(resolvedSearchParams?.query)
  const language = resolvedSearchParams?.language?.trim() ?? ""
  const view = await loadRepositoryListView(page, order, statusFilter, query)

  // Client-side language filter on upstreamSummary
  const filteredItems = language
    ? view.items.filter((item) => {
        const summary = (item.upstreamSummary ?? "").toLowerCase()
        const langLower = language.toLowerCase()
        // Match exact language name or common aliases
        const aliases: Record<string, string[]> = {
          "c++": ["c++", "cpp", "c plus plus"],
          "c#": ["c#", "csharp", "c sharp"],
        }
        const matchTerms = aliases[langLower] ?? [langLower]
        return matchTerms.some((term) => summary.includes(term))
      })
    : view.items
  const displayView = language ? { ...view, items: filteredItems, total: filteredItems.length } : view
  const previousHref = view.hasPrevious
    ? buildRepoListHref(view.page - 1, view.order, view.statusFilter, view.query, language)
    : buildRepoListHref(1, view.order, view.statusFilter, view.query, language)
  const nextHref = view.hasNext
    ? buildRepoListHref(view.page + 1, view.order, view.statusFilter, view.query, language)
    : buildRepoListHref(view.page, view.order, view.statusFilter, view.query, language)
  const clearSearchHref = buildRepoListHref(1, view.order, view.statusFilter, "", language)
  const readyHref = buildRepoListHref(1, view.order, "ready", view.query, language)
  const queuedHref = buildRepoListHref(1, view.order, "queued", view.query, language)
  const processingHref = buildRepoListHref(1, view.order, "processing", view.query, language)
  const failedHref = buildRepoListHref(1, view.order, "failed", view.query, language)
  const allHref = buildRepoListHref(1, view.order, "all", view.query, language)
  const highSignalHref = buildRepoListHref(1, "stars", "ready", view.query, language)
  const forkNetworkHref = buildRepoListHref(1, "forks", "ready", view.query, language)
  const freshReadyHref = buildRepoListHref(1, "updated", "ready", view.query, language)
  const currentHref = buildRepoListHref(view.page, view.order, view.statusFilter, view.query, language)
  const readyShare = view.stats.total > 0 ? Math.round((view.stats.cached / view.stats.total) * 100) : 0
  const activeQueueCount = view.stats.pending

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
        <div className="grid gap-3 lg:grid-cols-4">
          <Link
            href={freshReadyHref}
            className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="mt-3 text-sm font-semibold text-foreground">Fresh ready briefs</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Start with cached analyses that changed most recently.</p>
          </Link>
          <Link
            href={highSignalHref}
            className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <Star className="h-4 w-4 text-primary" />
            <div className="mt-3 text-sm font-semibold text-foreground">Popular upstreams</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Prioritize repos with stronger community signal.</p>
          </Link>
          <Link
            href={forkNetworkHref}
            className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <GitFork className="h-4 w-4 text-primary" />
            <div className="mt-3 text-sm font-semibold text-foreground">Largest fork networks</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Find repositories where fork choice matters most.</p>
          </Link>
          <Link
            href={failedHref}
            className="group rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <Wrench className="h-4 w-4 text-primary" />
            <div className="mt-3 text-sm font-semibold text-foreground">Needs attention</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Review failed analyses that may need a requeue.</p>
          </Link>
        </div>
        <SavedRepoViews currentHref={currentHref} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Link
            href={allHref}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50",
              view.statusFilter === "all" && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Indexed repos</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{statLabel(view.stats.total)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{readyShare}% ready</div>
          </Link>
          <Link
            href={readyHref}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50",
              view.statusFilter === "ready" && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Ready briefs</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{statLabel(view.stats.cached)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Open immediately</div>
          </Link>
          <Link
            href={queuedHref}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50",
              view.statusFilter === "queued" && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Waiting</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{statLabel(activeQueueCount)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Queued or pending</div>
          </Link>
          <Link
            href={processingHref}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50",
              view.statusFilter === "processing" && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Processing</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{statLabel(view.stats.processing)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Worker active</div>
          </Link>
          <Link
            href={failedHref}
            className={cn(
              "rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/50",
              view.statusFilter === "failed" && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Needs attention</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{statLabel(view.stats.failed)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Failed analyses</div>
          </Link>
        </div>
        <div className="space-y-4 rounded-md border border-border bg-card px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>
                  {view.total.toLocaleString()} {view.query ? "matching repos" : "repos"}
                  {language ? ` · ${language}` : ""}
                </span>
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
              {language ? <input type="hidden" name="language" value={language} /> : null}
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
              <RepoLanguageFilter />
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
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
              `DATABASE_URL` is not configured for the web backend yet, so the repository index is unavailable.
            </div>
            <LocalWorkspacePanel
              title="Keep exploring from local context"
              description="Discofork can still help you bounce between repositories you already viewed, bookmarked, or watched in this browser while the shared backend cache is unavailable."
            />
            <StarterRepoGrid
              title="No shared cache yet? Start with familiar repos."
              description="These starter routes give first-time visitors something concrete to open, queue, and add to compare while the backend index is unavailable."
            />
          </div>
        ) : displayView.items.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              {language ? (
                <>
                  No repositories match the language filter <span className="font-medium text-foreground">"{language}"</span>. Try a different language or clear the filter.
                </>
              ) : view.query ? (
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
                <QueueInput placeholder="owner/repo or GitHub URL" />
              </div>
            ) : null}
            {!language && !view.query ? (
              <StarterRepoGrid
                title="Start browsing with a few strong examples"
                description="Open or compare these recognizable repositories while you wait for the first cached reports to land."
              />
            ) : null}
          </div>
        ) : (
            <RepoListKeyboardProvider>
            <RepoListView items={displayView.items} />
          </RepoListKeyboardProvider>
        )}
      </section>
    </RepoShell>
  )
}
