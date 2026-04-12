"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Eye, Trash2 } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type WatchEntry, getWatches, removeWatch } from "@/lib/watches"

export default function WatchedPage() {
  const [watches, setWatches] = useState<WatchEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setWatches(getWatches())
  }, [])

  const handleRemove = (fullName: string) => {
    removeWatch(fullName)
    setWatches(getWatches())
  }

  return (
    <RepoShell
      eyebrow="Watched"
      title="Repositories you are watching."
      description="Repositories you are watching for updates. When cached data changes after your last visit, a badge will indicate new activity. Watches are stored locally in your browser."
      compact
    >
      <section className="space-y-6">
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
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {watches.map((watch) => (
              <div
                key={watch.fullName}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/${watch.owner}/${watch.repo}`}
                    className="block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {watch.fullName}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Watching since {new Date(watch.watchedAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>Last visited {new Date(watch.lastVisitedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
            ))}
          </div>
        )}
      </section>
    </RepoShell>
  )
}
