"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookmarkPlus, ExternalLink, Trash2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SavedRepoView = {
  id: string
  label: string
  href: string
  savedAt: string
}

const STORAGE_KEY = "discofork:saved-repo-views"
const MAX_SAVED_VIEWS = 6

function isSavedRepoView(value: unknown): value is SavedRepoView {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.href === "string" &&
    typeof candidate.savedAt === "string"
  )
}

function readSavedViews(): SavedRepoView[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedRepoView).slice(0, MAX_SAVED_VIEWS) : []
  } catch {
    return []
  }
}

function writeSavedViews(views: SavedRepoView[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS)))
}

function buildViewLabel(searchParams: URLSearchParams): string {
  const parts = [
    searchParams.get("query") ? `"${searchParams.get("query")}"` : "",
    searchParams.get("status") && searchParams.get("status") !== "all" ? searchParams.get("status") : "",
    searchParams.get("order") && searchParams.get("order") !== "updated" ? `by ${searchParams.get("order")}` : "",
    searchParams.get("language") ? searchParams.get("language") : "",
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(" · ") : "Repository index"
}

function formatSavedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Saved view"

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function SavedRepoViews({ currentHref }: { currentHref: string }) {
  const [views, setViews] = useState<SavedRepoView[]>([])

  useEffect(() => {
    setViews(readSavedViews())
  }, [])

  const currentView = useMemo(() => {
    const href = currentHref || "/repos"
    const params = new URLSearchParams(href.includes("?") ? href.split("?")[1] : "")

    return {
      id: href,
      label: buildViewLabel(params),
      href,
      savedAt: new Date().toISOString(),
    }
  }, [currentHref])

  const alreadySaved = views.some((view) => view.href === currentView.href)

  function saveCurrentView() {
    const nextViews = [currentView, ...views.filter((view) => view.href !== currentView.href)].slice(0, MAX_SAVED_VIEWS)
    setViews(nextViews)
    writeSavedViews(nextViews)
  }

  function removeView(id: string) {
    const nextViews = views.filter((view) => view.id !== id)
    setViews(nextViews)
    writeSavedViews(nextViews)
  }

  return (
    <section className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Saved views</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep the searches and filters you return to when triaging repositories.
          </p>
        </div>
        <button
          type="button"
          onClick={saveCurrentView}
          disabled={alreadySaved}
          className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-3 py-2 text-sm")}
        >
          <BookmarkPlus className="h-4 w-4" />
          {alreadySaved ? "Saved" : "Save current view"}
        </button>
      </div>

      {views.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {views.map((view) => (
            <div key={view.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/55 px-3 py-2">
              <Link href={view.href} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{view.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatSavedAt(view.savedAt)}</div>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href={view.href}
                  aria-label={`Open ${view.label}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => removeView(view.id)}
                  aria-label={`Remove ${view.label}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
