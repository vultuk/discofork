"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock, Trash2 } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { buttonVariants } from "@/components/ui/button"
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

  useEffect(() => {
    setMounted(true)
    setHistory(getHistory())
  }, [])

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
      description="Repositories you have recently visited. History is stored locally in your browser."
      compact
    >
      <section className="space-y-6">
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {history.length} recent {history.length === 1 ? "repository" : "repositories"}
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
            <div className="overflow-hidden rounded-md border border-border bg-card">
              {history.map((entry) => (
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
                      Viewed {formatRelativeTime(entry.visitedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
          </>
        )}
      </section>
    </RepoShell>
  )
}
