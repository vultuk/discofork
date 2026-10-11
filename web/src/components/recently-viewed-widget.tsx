"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"

import { type HistoryEntry, getHistory } from "@/lib/history"

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

export function RecentlyViewedWidget() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setEntries(getHistory().slice(0, 5))
  }, [])

  if (!mounted || entries.length === 0) return null

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Recently Viewed
        </div>
        <p className="text-sm text-muted-foreground">
          Repos you have recently visited.{" "}
          <Link href="/recent" className="text-primary transition-colors hover:underline">
            View all
          </Link>
        </p>
      </div>
      <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        {entries.map((entry, index) => (
          <Link
            key={entry.fullName}
            href={`/${entry.owner}/${entry.repo}`}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/70 ${
              index < entries.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {entry.fullName}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(entry.visitedAt)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
