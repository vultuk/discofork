"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isWatched, toggleWatch } from "@/lib/watches"

export function WatchButton({
  owner,
  repo,
  variant = "icon",
}: {
  owner: string
  repo: string
  variant?: "icon" | "button"
}) {
  const [watched, setWatched] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fullName = `${owner}/${repo}`

  useEffect(() => {
    setMounted(true)
    setWatched(isWatched(fullName))
  }, [fullName])

  const handleToggle = useCallback(() => {
    const next = toggleWatch(owner, repo)
    setWatched(next)
  }, [owner, repo])

  if (!mounted) {
    if (variant === "button") {
      return (
        <Button variant="outline" className="gap-2 rounded-md px-4" disabled>
          <Eye className="h-4 w-4" />
          Watch
        </Button>
      )
    }
    return (
      <button
        type="button"
        disabled
        className="rounded-md p-2 text-muted-foreground opacity-50"
        aria-label="Watch"
      >
        <Eye className="h-4 w-4" />
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
          watched && "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
        )}
      >
        {watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {watched ? "Watching" : "Watch"}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "rounded-md p-2 transition-colors",
        watched
          ? "text-blue-500 hover:text-blue-600"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={watched ? "Unwatch" : "Watch"}
    >
      {watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}
