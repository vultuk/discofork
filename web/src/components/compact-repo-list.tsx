"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BookmarkCheck, GitFork, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { RepoRowActions } from "@/components/repo-row-actions"
import { getViewMode, type ViewMode } from "@/components/repo-view-toggle"
import type { RepoListItem } from "@/lib/repository-list"
import { cn } from "@/lib/utils"

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

export function CompactRepoList({ items }: { items: RepoListItem[] }) {
  const [mode, setMode] = useState<ViewMode>(getViewMode())

  useEffect(() => {
    setMode(getViewMode())

    const handler = (e: Event) => {
      setMode((e as CustomEvent).detail as ViewMode)
    }
    window.addEventListener("repo-view-mode-change", handler)
    return () => window.removeEventListener("repo-view-mode-change", handler)
  }, [])

  if (mode !== "compact") return null

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Repository</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Status</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Stars</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Forks</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Cached</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Summary</th>
            <th className="w-1 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.fullName}
              className="border-b border-border last:border-b-0 hover:bg-muted/70"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/${item.owner}/${item.repo}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {item.fullName}
                </Link>
                {/* Show status/stats on mobile when columns are hidden */}
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                  <Badge variant={statusVariant(item)}>{statusLabel(item)}</Badge>
                  {typeof item.stars === "number" && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3" />{item.stars.toLocaleString()}
                    </span>
                  )}
                  {typeof item.forks === "number" && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <GitFork className="h-3 w-3" />{item.forks.toLocaleString()}
                    </span>
                  )}
                </div>
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <Badge variant={statusVariant(item)}>{statusLabel(item)}</Badge>
              </td>
              <td className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                {typeof item.stars === "number" ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    {item.stars.toLocaleString()}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">
                {typeof item.forks === "number" ? (
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="h-3.5 w-3.5" />
                    {item.forks.toLocaleString()}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-muted-foreground md:table-cell">
                {formatDate(item.cachedAt)}
              </td>
              <td className="hidden max-w-xs px-3 py-2 md:table-cell">
                <p className="line-clamp-1 truncate text-xs text-muted-foreground">
                  {item.upstreamSummary ?? "—"}
                </p>
              </td>
              <td className="px-3 py-2">
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.preventDefault()}>
                  <RepoRowActions owner={item.owner} repo={item.repo} fullName={item.fullName} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
