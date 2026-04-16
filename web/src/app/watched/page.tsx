"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Eye, RefreshCw, Search, Trash2, X } from "lucide-react"

import { CompareBar, CompareToggle } from "@/components/compare-toggle"
import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { filterLocalRepoCollection, summarizeLocalRepoCollection } from "@/lib/local-repo-collection"
import {
  chunkWatchFullNames,
  getWatchActivity,
  type WatchActivitySource,
  type WatchEntry,
  getWatches,
  removeWatch,
  sortWatchesByActivity,
} from "@/lib/watches"
import { cn } from "@/lib/utils"

type WatchedActivityResponse = {
  activities?: Record<string, WatchActivitySource>
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString()
}

function formatRelativeTime(dateStr: string | null): string | null {
  if (!dateStr) {
    return null
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function buildUnknownActivityMap(watches: WatchEntry[]): Record<string, WatchActivitySource> {
  return Object.fromEntries(
    watches.map((watch) => [
      watch.fullName,
      {
        status: "unknown" as const,
        cachedAt: null,
      },
    ]),
  )
}

export default function WatchedPage() {
  const [watches, setWatches] = useState<WatchEntry[]>([])
  const [activityByFullName, setActivityByFullName] = useState<Record<string, WatchActivitySource>>({})
  const [activityLoaded, setActivityLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    setMounted(true)
    setWatches(getWatches())
  }, [])

  useEffect(() => {
    if (!mounted) {
      return
    }

    if (watches.length === 0) {
      setActivityByFullName({})
      setActivityLoaded(true)
      return
    }

    let cancelled = false
    setActivityLoaded(false)

    async function loadActivity() {
      const nextActivity = buildUnknownActivityMap(watches)
      const batches = chunkWatchFullNames(watches.map((watch) => watch.fullName))

      await Promise.all(
        batches.map(async (batch) => {
          try {
            const response = await fetch("/api/watched/activity", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ repos: batch }),
              cache: "no-store",
            })

            if (!response.ok) {
              return
            }

            const data = (await response.json()) as WatchedActivityResponse
            Object.assign(nextActivity, data.activities ?? {})
          } catch {
            // Leave this batch as unknown so partial failures stay visible.
          }
        }),
      )

      if (!cancelled) {
        setActivityByFullName(nextActivity)
        setActivityLoaded(true)
      }
    }

    void loadActivity()

    return () => {
      cancelled = true
    }
  }, [mounted, watches])

  const watchRows = useMemo(() => {
    const sortedWatches = sortWatchesByActivity(watches, activityByFullName)
    return sortedWatches.map((watch) => ({
      watch,
      activity: getWatchActivity(watch, activityByFullName[watch.fullName]),
    }))
  }, [watches, activityByFullName])

  const filteredRows = useMemo(
    () =>
      filterLocalRepoCollection(
        watchRows.map((row) => ({
          ...row,
          fullName: row.watch.fullName,
          owner: row.watch.owner,
          repo: row.watch.repo,
          savedAt: row.watch.watchedAt,
          secondaryLabel: row.watch.watchedAt,
        })),
        query,
      ),
    [query, watchRows],
  )

  const updatedCount = watchRows.filter((row) => row.activity.status === "updated").length

  const handleRemove = (fullName: string) => {
    removeWatch(fullName)
    setWatches(getWatches())
  }

  return (
    <RepoShell
      eyebrow="Watched"
      title="Repositories you are watching."
      description="Repositories you are watching for updates. Filter the list locally and add the most interesting repos straight into compare when fresh cache activity appears."
      compact
    >
      <section className="space-y-6">
        <CompareBar />
        {!mounted ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            Loading watched repositories...
          </div>
        ) : watches.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <Eye className="mt-1 h-5 w-5 text-muted-foreground" />
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-foreground">No watched repositories yet</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Visit any repository page and click the Watch button to start tracking it for updates.
                </p>
                <Link
                  href="/repos"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
                >
                  Browse repositories
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-md border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {query
                    ? summarizeLocalRepoCollection(filteredRows.length, watchRows.length, query)
                    : updatedCount > 0
                      ? `${updatedCount} watched ${updatedCount === 1 ? "repository has" : "repositories have"} fresh cache activity`
                      : summarizeLocalRepoCollection(filteredRows.length, watchRows.length, query)}
                </span>
                {!activityLoaded ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Checking cached activity…
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter watched repositories..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear watched repository search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
                No watched repositories match <span className="font-medium text-foreground">“{query.trim()}”</span>.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                {filteredRows.map(({ watch, activity }) => {
                  const cachedFreshness = formatRelativeTime(activity.cachedAt)

                  return (
                    <div
                      key={watch.fullName}
                      className={cn(
                        "flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0",
                        activity.status === "updated" && "bg-emerald-500/5",
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/${watch.owner}/${watch.repo}`}
                            className="block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {watch.fullName}
                          </Link>
                          {activity.status === "updated" ? <Badge variant="success">Updated</Badge> : null}
                          {activity.status === "cached" ? (
                            <Badge variant="muted">Cached {cachedFreshness ?? formatDate(activity.cachedAt ?? "")}</Badge>
                          ) : null}
                          {activity.status === "missing" && activityLoaded ? (
                            <Badge variant="muted">No cached snapshot yet</Badge>
                          ) : null}
                          {activity.status === "unknown" && activityLoaded ? (
                            <Badge variant="warning">Could not check cache activity</Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Watching since {formatDate(watch.watchedAt)}</span>
                          <span>·</span>
                          <span>Last visited {formatDate(watch.lastVisitedAt)}</span>
                          {activity.cachedAt ? (
                            <>
                              <span>·</span>
                              <span>
                                {activity.status === "updated" ? "Fresh cache activity" : "Latest cache"}{" "}
                                {cachedFreshness ?? formatDate(activity.cachedAt)}
                              </span>
                            </>
                          ) : activity.status === "missing" && activityLoaded ? (
                            <>
                              <span>·</span>
                              <span>No cached snapshot yet</span>
                            </>
                          ) : activity.status === "unknown" && activityLoaded ? (
                            <>
                              <span>·</span>
                              <span>Could not check cache activity right now</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 justify-end">
                        <CompareToggle fullName={watch.fullName} showLabel />
                        <Link
                          href={`/${watch.owner}/${watch.repo}`}
                          className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs")}
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemove(watch.fullName)}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:text-rose-500"
                          aria-label={`Stop watching ${watch.fullName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>
    </RepoShell>
  )
}
