"use client"

import { useCallback, useEffect, useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BOOKMARKS_CHANGE_EVENT, isBookmarked, toggleBookmark } from "@/lib/bookmarks"
import { cn } from "@/lib/utils"

export function BookmarkButton({
  owner,
  repo,
  variant = "icon",
  compact = false,
}: {
  owner: string
  repo: string
  variant?: "icon" | "button"
  compact?: boolean
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fullName = `${owner}/${repo}`

  useEffect(() => {
    setMounted(true)

    const sync = () => {
      setBookmarked(isBookmarked(fullName))
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener(BOOKMARKS_CHANGE_EVENT, sync as EventListener)

    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener(BOOKMARKS_CHANGE_EVENT, sync as EventListener)
    }
  }, [fullName])

  const handleToggle = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()

    const next = toggleBookmark(owner, repo)
    setBookmarked(next)
  }, [owner, repo])

  const buttonClassName = cn(
    "gap-2",
    compact ? "h-8 rounded-full px-3 text-xs" : "rounded-md px-4",
    bookmarked && "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  )

  if (!mounted) {
    if (variant === "button") {
      return (
        <Button type="button" variant="outline" className={buttonClassName} disabled>
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
        aria-pressed={false}
      >
        <Bookmark className="h-4 w-4" />
      </button>
    )
  }

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        className={buttonClassName}
        aria-pressed={bookmarked}
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
      aria-pressed={bookmarked}
    >
      {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  )
}
