"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock, Search, Trash2, X } from "lucide-react"

import { CompareBar, CompareToggle } from "@/components/compare-toggle"
import { RepoShell } from "@/components/repo-shell"
import { buttonVariants } from "@/components/ui/button"
import { filterLocalRepoCollection, summarizeLocalRepoCollection } from "@/lib/local-repo-collection"
import { cn } from "@/lib/utils"
import { type HistoryEntry, getHistory, removeHistory, clearHistory } from "@/lib/history"

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
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

export default function RecentPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    setMounted(true)
    setHistory(getHistory())
  }, [])

  const filteredHistory = useMemo(
    () => filterLocalRepoCollection(history.map((entry) => ({ ...entry, savedAt: entry.visitedAt, secondaryLabel: entry.visitedAt })), query),
    [history, query],
  )

  const handleRemove = (fullName: string) => {
    removeHistory(fullName)
    setHistory(getHistory())
  }

  const handleClear = () => {
    clearHistory()
    setHistory([])
  }

  return (
    <RepoShell
      eyebrow="Recently Viewed"
      title="Your browsing history."
      description="Repositories you have recently visited. Search locally, add useful entries straight to compare, and keep the list tidy without leaving the page."
      compact
    >
      <section className="space-y-6">
        <CompareBar />
        {!mounted ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <Clock className="mt-1 h-5 w-5 text-muted-foreground" />
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-foreground">No recent history</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Repositories you visit will appear here for quick access.
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
                  {summarizeLocalRepoCollection(filteredHistory.length, history.length, query)}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs text-muted-foreground hover:text-rose-500")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear history
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter recent repositories..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear recent repository search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
                No recent repositories match <span className="font-medium text-foreground">“{query.trim()}”</span>.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                {filteredHistory.map((entry) => (
                  <div
                    key={entry.fullName}
                    className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/${entry.owner}/${entry.repo}`}
                        className="block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        {entry.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Viewed {formatRelativeTime(entry.savedAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 justify-end">
                      <CompareToggle fullName={entry.fullName} showLabel />
                      <Link
                        href={`/${entry.owner}/${entry.repo}`}
                        className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs")}
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.fullName)}
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:text-rose-500"
                        aria-label={`Remove ${entry.fullName} from history`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </RepoShell>
  )
}
