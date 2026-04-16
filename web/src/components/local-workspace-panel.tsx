"use client"

import Link from "next/link"
import { ArrowRight, Bookmark, Clock3, Eye } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useRepoLauncherWorkspace } from "@/hooks/use-repo-launcher-workspace"
import { REPO_LAUNCHER_SUGGESTION_LABELS } from "@/lib/repo-launcher"
import { cn } from "@/lib/utils"

export function LocalWorkspacePanel({
  title = "Continue from your browser workspace",
  description = "Recent, bookmarked, and watched repositories stay in this browser so you can get back to work quickly even before the backend cache is populated.",
  limit = 6,
}: {
  title?: string
  description?: string
  limit?: number
}) {
  const { bookmarks, history, mounted, suggestions, watches } = useRepoLauncherWorkspace(limit)

  if (!mounted) {
    return null
  }

  const hasWorkspace = suggestions.length > 0 || bookmarks.length > 0 || watches.length > 0 || history.length > 0
  if (!hasWorkspace) {
    return null
  }

  return (
    <section className="space-y-5 rounded-[1.25rem] border border-border bg-card/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="space-y-2">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Local workspace</div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            Recent
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{history.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bookmark className="h-4 w-4 text-primary" />
            Bookmarked
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{bookmarks.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Eye className="h-4 w-4 text-primary" />
            Watching
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{watches.length}</div>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Quick picks</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion.fullName}
                href={suggestion.canonicalPath}
                className="rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/40 hover:bg-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{suggestion.fullName}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestion.sources.map((source) => (
                        <Badge key={`${suggestion.fullName}-${source}`} variant="muted">
                          {REPO_LAUNCHER_SUGGESTION_LABELS[source]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href="/recent" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4")}>
          Open recent
        </Link>
        <Link href="/bookmarks" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4")}>
          Open bookmarks
        </Link>
        <Link href="/watched" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4")}>
          Open watched
        </Link>
      </div>
    </section>
  )
}
