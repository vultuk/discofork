"use client"

import { useCallback, useEffect, useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks"

export function BookmarkButton({
  owner,
  repo,
  variant = "icon",
}: {
  owner: string
  repo: string
  variant?: "icon" | "button"
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fullName = `${owner}/${repo}`

  useEffect(() => {
    setMounted(true)
    setBookmarked(isBookmarked(fullName))
  }, [fullName])

  const handleToggle = useCallback(() => {
    const next = toggleBookmark(owner, repo)
    setBookmarked(next)
  }, [owner, repo])

  if (!mounted) {
    if (variant === "button") {
      return (
        <Button variant="outline" className="gap-2 rounded-md px-4" disabled>
          <Bookmark className="h-4 w-4" />
          Bookmark
        </Button>
      )
    }
    return (
      <button
        type="button"
        disabled
        className="rounded-md p-2 text-muted-foreground opacity-50"
        aria-label="Bookmark"
      >
        <Bookmark className="h-4 w-4" />
      </button>
    )
  }

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        onClick={handleToggle}
        className={cn(
          "gap-2 rounded-md px-4",
          bookmarked && "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}
      >
        {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "rounded-md p-2 transition-colors",
        bookmarked
          ? "text-amber-500 hover:text-amber-600"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  )
}
