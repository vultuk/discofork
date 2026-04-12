"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GitCompareArrows } from "lucide-react"

import { cn } from "@/lib/utils"
import { isInCompare, toggleCompareRepo, getCompareSelection, buildCompareHref } from "@/lib/compare"

export function CompareToggle({
  fullName,
  showLabel = false,
}: {
  fullName: string
  showLabel?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(false)
  const [count, setCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSelected(isInCompare(fullName))
    setCount(getCompareSelection().length)
  }, [fullName])

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const next = toggleCompareRepo(fullName)
      setSelected(next.includes(fullName))
      setCount(next.length)
    },
    [fullName],
  )

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="rounded-md p-1.5 text-muted-foreground opacity-50"
        aria-label="Add to compare"
      >
        <GitCompareArrows className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-1.5 rounded-md p-1.5 transition-colors",
        selected
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-label={selected ? "Remove from compare" : "Add to compare"}
    >
      <GitCompareArrows className="h-3.5 w-3.5" />
      {showLabel ? (
        <span className="text-xs">{selected ? "Remove" : "Compare"}</span>
      ) : null}
    </button>
  )
}

export function CompareBar() {
  const [repos, setRepos] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setRepos(getCompareSelection())

    const handleStorage = () => {
      setRepos(getCompareSelection())
    }

    window.addEventListener("storage", handleStorage)
    const interval = setInterval(() => {
      setRepos(getCompareSelection())
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorage)
      clearInterval(interval)
    }
  }, [])

  if (!mounted || repos.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
      <GitCompareArrows className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground">
        {repos.length} repo{repos.length !== 1 ? "s" : ""} selected
      </span>
      <a
        href={buildCompareHref(repos)}
        className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Compare now
      </a>
    </div>
  )
}
