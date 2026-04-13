"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, GitFork, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { RepoRowActions } from "@/components/repo-row-actions"
import { TagDisplay } from "@/components/tag-manager"
import { CompactRepoList } from "@/components/compact-repo-list"
import { getViewMode, type ViewMode } from "@/components/repo-view-toggle"
import type { RepoListItem } from "@/lib/repository-list"
import { formatRelativeTime, cn } from "@/lib/utils"

function formatDate(value: string | null): string {
  if (!value) return "Not yet"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10)
}

function statusVariant(item: RepoListItem): "muted" | "success" | "warning" {
  if (item.status === "ready") return "success"
  if (item.retryState === "retrying" || item.retryState === "terminal" || item.status === "failed") return "warning"
  return "muted"
}

function statusLabel(item: RepoListItem): string {
  if (item.status === "processing" && item.retryState === "retrying") return "retrying"
  if (item.status === "failed" && item.retryState === "terminal") return "terminal failure"
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

function CardRepoList({ items }: { items: RepoListItem[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card" data-repo-list>
      {items.map((item) => (
        <Link
          key={item.fullName}
          href={`/${item.owner}/${item.repo}`}
          data-repo-item
          data-full-name={item.fullName}
          className="block border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/70 sm:px-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-sm font-semibold text-foreground">{item.fullName}</div>
                <Badge variant={statusVariant(item)}>{statusLabel(item)}</Badge>
                {item.status === "ready" ? <Badge variant="muted">{item.forkBriefCount} forks</Badge> : null}
              </div>
              <TagDisplay fullName={item.fullName} />
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {item.upstreamSummary ?? "No cached upstream summary is available yet."}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{statusTimestampLabel(item)}</span>
                {item.status === "ready" ? (() => {
                  const freshness = formatRelativeTime(item.cachedAt)
                  if (!freshness) return null
                  return (
                    <span title={freshness.exactDate}>
                      <Badge variant={freshness.variant} className="cursor-default">{freshness.label}</Badge>
                    </span>
                  )
                })() : null}
                {item.defaultBranch ? <span>{item.defaultBranch}</span> : null}
                {item.lastPushedAt ? <span>Pushed {formatDate(item.lastPushedAt)}</span> : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              {typeof item.stars === "number" ? (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />
                  {item.stars.toLocaleString()}
                </span>
              ) : null}
              {typeof item.forks === "number" ? (
                <span className="flex items-center gap-1">
                  <GitFork className="h-3.5 w-3.5" />
                  {item.forks.toLocaleString()}
                </span>
              ) : null}
              <RepoRowActions owner={item.owner} repo={item.repo} fullName={item.fullName} />
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function RepoListView({ items }: { items: RepoListItem[] }) {
  const [mode, setMode] = useState<ViewMode>(getViewMode())

  useEffect(() => {
    setMode(getViewMode())

    const handler = (e: Event) => {
      setMode((e as CustomEvent).detail as ViewMode)
    }
    window.addEventListener("repo-view-mode-change", handler)
    return () => window.removeEventListener("repo-view-mode-change", handler)
  }, [])

  return (
    <>
      {mode === "compact" ? (
        <CompactRepoList items={items} />
      ) : (
        <CardRepoList items={items} />
      )}
    </>
  )
}
