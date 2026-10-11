"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bookmark, Search, Trash2, X } from "lucide-react"

import { CompareBar, CompareToggle } from "@/components/compare-toggle"
import { RepoShell } from "@/components/repo-shell"
import { buttonVariants } from "@/components/ui/button"
import { filterLocalRepoCollection, summarizeLocalRepoCollection } from "@/lib/local-repo-collection"
import { cn } from "@/lib/utils"
import { type BookmarkEntry, getBookmarks, removeBookmark } from "@/lib/bookmarks"

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    setMounted(true)
    setBookmarks(getBookmarks())
  }, [])

  const filteredBookmarks = useMemo(
    () => filterLocalRepoCollection(bookmarks.map((entry) => ({ ...entry, savedAt: entry.bookmarkedAt, secondaryLabel: entry.bookmarkedAt })), query),
    [bookmarks, query],
  )

  const handleRemove = (fullName: string) => {
    removeBookmark(fullName)
    setBookmarks(getBookmarks())
  }

  return (
    <RepoShell
      eyebrow="Bookmarks"
      title="Your saved repositories."
      description="Repositories you have bookmarked for quick access. Search them locally and build compare sets directly from the repositories you already care about."
      compact
    >
      <section className="space-y-6">
        <CompareBar />
        {!mounted ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            Loading bookmarks...
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <Bookmark className="mt-1 h-5 w-5 text-muted-foreground" />
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-foreground">No bookmarks yet</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Visit any repository page and click the bookmark icon to save it here for quick access later.
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
              <span className="text-sm text-muted-foreground">
                {summarizeLocalRepoCollection(filteredBookmarks.length, bookmarks.length, query)}
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter bookmarked repositories..."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Clear bookmarked repository search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {filteredBookmarks.length === 0 ? (
              <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
                No bookmarked repositories match <span className="font-medium text-foreground">“{query.trim()}”</span>.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                {filteredBookmarks.map((bookmark) => (
                  <div
                    key={bookmark.fullName}
                    className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link
                        href={`/${bookmark.owner}/${bookmark.repo}`}
                        className="block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        {bookmark.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Bookmarked {new Date(bookmark.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 justify-end">
                      <CompareToggle fullName={bookmark.fullName} showLabel />
                      <Link
                        href={`/${bookmark.owner}/${bookmark.repo}`}
                        className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs")}
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemove(bookmark.fullName)}
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:text-rose-500"
                        aria-label={`Remove ${bookmark.fullName} from bookmarks`}
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
