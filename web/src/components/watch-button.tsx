"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WATCHES_CHANGE_EVENT, isWatched, toggleWatch } from "@/lib/watches"
import { cn } from "@/lib/utils"

export function WatchButton({
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
  const [watched, setWatched] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fullName = `${owner}/${repo}`

  useEffect(() => {
    setMounted(true)

    const sync = () => {
      setWatched(isWatched(fullName))
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener(WATCHES_CHANGE_EVENT, sync as EventListener)

    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener(WATCHES_CHANGE_EVENT, sync as EventListener)
    }
  }, [fullName])

  const handleToggle = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()

    const next = toggleWatch(owner, repo)
    setWatched(next)
  }, [owner, repo])

  const buttonClassName = cn(
    "gap-2",
    compact ? "h-8 rounded-full px-3 text-xs" : "rounded-md px-4",
    watched && "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  )

  if (!mounted) {
    if (variant === "button") {
      return (
        <Button type="button" variant="outline" className={buttonClassName} disabled>
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
        aria-pressed={false}
      >
        <Eye className="h-4 w-4" />
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
        aria-pressed={watched}
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
      aria-pressed={watched}
    >
      {watched ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}
