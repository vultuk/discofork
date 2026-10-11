"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { GitFork, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { RepoListItem, RepoListView } from "@/lib/repository-list"

function formatCount(value: number | null): string {
  if (value == null) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toString()
}

function RepoCard({ item }: { item: RepoListItem }) {
  return (
    <Link
      href={`/${item.owner}/${item.repo}`}
      className="group block rounded-[1.25rem] border border-border bg-card/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition-colors hover:border-primary/40"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
            {item.fullName}
          </h3>
          <div className="flex shrink-0 gap-2">
            <Badge variant="muted" className="gap-1">
              <Star className="h-3 w-3" />
              {formatCount(item.stars)}
            </Badge>
            <Badge variant="muted" className="gap-1">
              <GitFork className="h-3 w-3" />
              {formatCount(item.forks)}
            </Badge>
          </div>
        </div>
        {item.upstreamSummary ? (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.upstreamSummary}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-[1.25rem] border border-border bg-card/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-10 animate-pulse rounded bg-muted" />
            <div className="h-5 w-10 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function TrendingRepos() {
  const [items, setItems] = useState<RepoListItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/repos?order=stars&status=ready&page=1")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: RepoListView = await res.json()
        if (!cancelled) {
          setItems(data.items.slice(0, 6))
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Trending Repositories
        </div>
        <p className="text-sm text-muted-foreground">
          Top cached repositories by star count.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {error ? (
          <p className="col-span-full text-sm text-muted-foreground">
            Could not load trending repositories.
          </p>
        ) : items == null
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item) => <RepoCard key={item.fullName} item={item} />)}
      </div>
    </section>
  )
}
