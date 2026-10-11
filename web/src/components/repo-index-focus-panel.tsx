import Link from "next/link"
import { Activity, ArrowRight, GitFork, Search, Sparkles, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { RepoListItem, RepoListStats } from "@/lib/repository-list"
import { cn } from "@/lib/utils"

type RepoIndexFocusPanelProps = {
  items: RepoListItem[]
  stats: RepoListStats
  query: string
  language: string
  readyHref: string
  failedHref: string
  activeReadyHref: string
  forkNetworkHref: string
}

function formatDate(value: string | null): string {
  if (!value) return "No date"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10)
}

function pickMostForked(items: RepoListItem[]): RepoListItem | null {
  return items.reduce<RepoListItem | null>((best, item) => {
    if (item.status !== "ready" || typeof item.forks !== "number") return best
    if (!best || (item.forks ?? 0) > (best.forks ?? 0)) return item
    return best
  }, null)
}

function pickFreshest(items: RepoListItem[]): RepoListItem | null {
  return items.reduce<RepoListItem | null>((best, item) => {
    if (item.status !== "ready" || !item.cachedAt) return best
    if (!best?.cachedAt || new Date(item.cachedAt).getTime() > new Date(best.cachedAt).getTime()) return item
    return best
  }, null)
}

export function RepoIndexFocusPanel({
  items,
  stats,
  query,
  language,
  readyHref,
  failedHref,
  activeReadyHref,
  forkNetworkHref,
}: RepoIndexFocusPanelProps) {
  const readyShare = stats.total > 0 ? Math.round((stats.cached / stats.total) * 100) : 0
  const freshest = pickFreshest(items)
  const mostForked = pickMostForked(items)
  const activeFilterLabel = [query ? `matching "${query}"` : null, language ? `language ${language}` : null].filter(Boolean).join(" and ")

  return (
    <div className="rounded-md border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={readyShare >= 70 ? "success" : "muted"}>{readyShare}% ready</Badge>
            {stats.pending > 0 ? <Badge variant="muted">{stats.pending.toLocaleString()} queued</Badge> : null}
            {stats.failed > 0 ? <Badge variant="warning">{stats.failed.toLocaleString()} failed</Badge> : null}
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Best next move</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {stats.cached > 0
                ? `Start with ready briefs${activeFilterLabel ? ` ${activeFilterLabel}` : ""}, then compare the largest fork networks before adopting one.`
                : "Queue a repository first; Discofork will turn it into a fork brief once the worker has processed it."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={readyHref} className={cn(buttonVariants({ variant: "default" }), "rounded-md px-4")}>
            Ready briefs
            <ArrowRight className="h-4 w-4" />
          </Link>
          {stats.failed > 0 ? (
            <Link href={failedHref} className={cn(buttonVariants({ variant: "outline" }), "rounded-md px-4")}>
              Review failures
              <Wrench className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <Link
          href={freshest ? `/${freshest.owner}/${freshest.repo}` : activeReadyHref}
          className="group rounded-md border border-border bg-background/70 p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Open the freshest brief</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {freshest ? `${freshest.fullName} was cached ${formatDate(freshest.cachedAt)}.` : "Sort ready briefs by the newest Discofork cache update."}
          </p>
        </Link>
        <Link
          href={mostForked ? `/${mostForked.owner}/${mostForked.repo}` : forkNetworkHref}
          className="group rounded-md border border-border bg-background/70 p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <GitFork className="h-4 w-4 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Inspect the widest fork choice</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {mostForked ? `${mostForked.fullName} has ${mostForked.forks?.toLocaleString()} upstream forks.` : "Jump to ready repos with the largest fork networks."}
          </p>
        </Link>
        <Link
          href={stats.cached > 0 ? activeReadyHref : "/discover"}
          className="group rounded-md border border-border bg-background/70 p-4 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          {stats.cached > 0 ? <Activity className="h-4 w-4 text-primary" /> : <Search className="h-4 w-4 text-primary" />}
          <div className="mt-3 text-sm font-semibold text-foreground">{stats.cached > 0 ? "Track active upstreams" : "Find a repository"}</div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {stats.cached > 0
              ? "Use upstream activity order when you want recently moving projects."
              : "Use discovery when the shared cache has not filled this index yet."}
          </p>
        </Link>
      </div>
    </div>
  )
}
