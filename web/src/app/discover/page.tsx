"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Calendar, Clock, GitFork, Shuffle, Star } from "lucide-react"

import { BookmarkButton } from "@/components/bookmark-button"
import { CompareToggle } from "@/components/compare-toggle"
import { RepoShell } from "@/components/repo-shell"
import { StarterRepoGrid } from "@/components/starter-repo-grid"
import { WatchButton } from "@/components/watch-button"
import { Badge } from "@/components/ui/badge"
import { BOOKMARKS_CHANGE_EVENT } from "@/lib/bookmarks"
import { buildDiscoverFallbackEntries } from "@/lib/discover-fallback"
import { HISTORY_CHANGE_EVENT } from "@/lib/history"
import { REPO_LAUNCHER_SUGGESTION_LABELS, getRepoLauncherSuggestions, type RepoLauncherSuggestion } from "@/lib/repo-launcher"
import type { RepoListItem, RepoListView } from "@/lib/repository-list"
import { WATCHES_CHANGE_EVENT } from "@/lib/watches"

function formatCount(value: number | null): string {
  if (value == null) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toString()
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function DiscoverCard({ item }: { item: RepoListItem }) {
  return (
    <div className="group rounded-[1.25rem] border border-border bg-card/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-colors hover:border-primary/40">
      <Link
        href={`/${item.owner}/${item.repo}`}
        className="block space-y-3 px-4 py-5 sm:px-5"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
            {item.fullName}
          </h3>
        </div>
        {item.upstreamSummary ? (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.upstreamSummary}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted" className="gap-1">
            <Star className="h-3 w-3" />
            {formatCount(item.stars)}
          </Badge>
          <Badge variant="muted" className="gap-1">
            <GitFork className="h-3 w-3" />
            {formatCount(item.forks)}
          </Badge>
          <Badge variant="muted" className="gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(item.lastPushedAt)}
          </Badge>
        </div>
      </Link>

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 pb-5 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Triage in place
        </span>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={`${item.fullName} quick actions`}
        >
          <CompareToggle fullName={item.fullName} showLabel compact />
          <BookmarkButton owner={item.owner} repo={item.repo} variant="button" compact />
          <WatchButton owner={item.owner} repo={item.repo} variant="button" compact />
        </div>
      </div>
    </div>
  )
}

function LocalDiscoverCard({ suggestion }: { suggestion: RepoLauncherSuggestion }) {
  return (
    <div className="group rounded-[1.25rem] border border-border bg-card/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-colors hover:border-primary/40">
      <Link href={suggestion.canonicalPath} className="block space-y-3 px-4 py-5 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">{suggestion.fullName}</h3>
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          Reopen this repo from your recent, bookmarked, or watched browser workspace even when the shared cache is empty.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {suggestion.sources.map((source) => (
            <Badge key={`${suggestion.fullName}-${source}`} variant="muted">
              {REPO_LAUNCHER_SUGGESTION_LABELS[source]}
            </Badge>
          ))}
          <Badge variant="muted" className="gap-1">
            <Clock className="h-3 w-3" />
            {suggestion.lastTouchedAt ? formatDate(suggestion.lastTouchedAt) : "Recently touched"}
          </Badge>
        </div>
      </Link>

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 pb-5 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Local workspace fallback
        </span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${suggestion.fullName} local quick actions`}>
          <CompareToggle fullName={suggestion.fullName} showLabel compact />
          <BookmarkButton owner={suggestion.owner} repo={suggestion.repo} variant="button" compact />
          <WatchButton owner={suggestion.owner} repo={suggestion.repo} variant="button" compact />
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-[1.25rem] border border-border bg-card/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const [items, setItems] = useState<RepoListItem[] | null>(null)
  const [error, setError] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)
  const [recentItems, setRecentItems] = useState<RepoListItem[] | null>(null)
  const [recentError, setRecentError] = useState(false)
  const [localSuggestions, setLocalSuggestions] = useState<RepoLauncherSuggestion[]>([])

  const load = useCallback(async () => {
    let cancelled = false
    setItems(null)
    setError(false)

    try {
      // First fetch to get total ready repos and page count
      const initRes = await fetch("/api/repos?order=updated&status=ready&page=1")
      if (!initRes.ok) throw new Error(`HTTP ${initRes.status}`)
      const initData: RepoListView = await initRes.json()

      if (cancelled) return

      if (initData.total === 0) {
        setItems([])
        return
      }

      // Pick a random page
      const totalPages = Math.max(initData.totalPages, 1)
      const randomPage = Math.floor(Math.random() * totalPages) + 1

      // Fetch the random page (skip re-fetch if page 1)
      let data = initData
      if (randomPage !== 1) {
        const pageRes = await fetch(
          `/api/repos?order=updated&status=ready&page=${randomPage}`
        )
        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
        data = await pageRes.json()
        if (cancelled) return
      }

      // Shuffle and take 6
      const shuffled = shuffleArray(data.items)
      setItems(shuffled.slice(0, 6))
    } catch {
      if (!cancelled) setError(true)
    }

    return () => {
      cancelled = true
    }
  }, [shuffleKey])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refreshLocalSuggestions = () => {
      setLocalSuggestions(buildDiscoverFallbackEntries(getRepoLauncherSuggestions(6), 6))
    }

    refreshLocalSuggestions()
    window.addEventListener("storage", refreshLocalSuggestions)
    window.addEventListener(BOOKMARKS_CHANGE_EVENT, refreshLocalSuggestions)
    window.addEventListener(HISTORY_CHANGE_EVENT, refreshLocalSuggestions)
    window.addEventListener(WATCHES_CHANGE_EVENT, refreshLocalSuggestions)

    return () => {
      window.removeEventListener("storage", refreshLocalSuggestions)
      window.removeEventListener(BOOKMARKS_CHANGE_EVENT, refreshLocalSuggestions)
      window.removeEventListener(HISTORY_CHANGE_EVENT, refreshLocalSuggestions)
      window.removeEventListener(WATCHES_CHANGE_EVENT, refreshLocalSuggestions)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setRecentItems(null)
    setRecentError(false)

    fetch("/api/repos?order=updated&status=ready&page=1")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: RepoListView) => {
        if (cancelled) return
        setRecentItems(data.items.slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) setRecentError(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const showLocalFallback =
    localSuggestions.length > 0 &&
    ((items !== null && items.length === 0) || error) &&
    ((recentItems !== null && recentItems.length === 0) || recentError)

  return (
    <RepoShell
      eyebrow="Discover"
      title="Explore random cached repositories."
      description="Six random repos from the cache, reshuffled on each visit or click. Discover something unexpected."
      compact
    >
      <section className="space-y-6">
        <button
          type="button"
          onClick={() => setShuffleKey((k) => k + 1)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Shuffle className="h-4 w-4" />
          Shuffle
        </button>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {error ? (
            <p className="col-span-full text-sm text-muted-foreground">
              Could not load repositories. Try again later.
            </p>
          ) : items == null
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : items.length === 0
              ? (
                <div className="col-span-full space-y-4">
                  <p className="text-sm text-muted-foreground">
                    No cached repositories found. Queue some repos first.
                  </p>
                  <StarterRepoGrid
                    title="Nothing cached yet? Start with these repos."
                    description="Open a few recognizable repository routes now, then come back here once your own queue and local workspace start filling in."
                  />
                </div>
              )
              : items.map((item) => (
                <DiscoverCard key={item.fullName} item={item} />
              ))}
        </div>
      </section>

      <section className="mt-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recently Cached
            </span>
          </h2>
          <Link
            href="/repos"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Browse all repos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {recentError ? (
            <p className="col-span-full text-sm text-muted-foreground">
              Could not load recently cached repositories. Try again later.
            </p>
          ) : recentItems == null
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : recentItems.length === 0
              ? (
                <p className="col-span-full text-sm text-muted-foreground">
                  No cached repositories found. Queue some repos first.
                </p>
              )
              : recentItems.map((item) => (
                <DiscoverCard key={item.fullName} item={item} />
              ))}
        </div>
      </section>

      {showLocalFallback ? (
        <section className="mt-10 space-y-6">
          <div className="space-y-2">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Local workspace fallback</div>
            <h2 className="text-lg font-semibold text-foreground">Keep exploring from this browser.</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              The shared cache is empty right now, but you can still jump back into repositories you recently viewed,
              bookmarked, or watched from this device.
            </p>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {localSuggestions.map((suggestion) => (
              <LocalDiscoverCard key={suggestion.fullName} suggestion={suggestion} />
            ))}
          </div>
        </section>
      ) : null}
    </RepoShell>
  )
}
