"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bookmark, Trash2 } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type BookmarkEntry, getBookmarks, removeBookmark } from "@/lib/bookmarks"

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBookmarks(getBookmarks())
  }, [])

  const handleRemove = (fullName: string) => {
    removeBookmark(fullName)
    setBookmarks(getBookmarks())
  }

  return (
    <RepoShell
      eyebrow="Bookmarks"
      title="Your saved repositories."
      description="Repositories you have bookmarked for quick access. Bookmarks are stored locally in your browser."
      compact
    >
      <section className="space-y-6">
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
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {bookmarks.map((bookmark) => (
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
                    Bookmarked {new Date(bookmark.bookmarkedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
      </section>
    </RepoShell>
  )
}
