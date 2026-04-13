"use client"

import { useState, useEffect } from "react"
import { Grid3X3, List } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "discofork-repo-view-mode"

export type ViewMode = "card" | "compact"

export function getViewMode(): ViewMode {
  if (typeof window === "undefined") return "card"
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "compact" ? "compact" : "card"
  } catch {
    return "card"
  }
}

export function setViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore storage errors
  }
}

export function RepoViewToggle() {
  const [mode, setMode] = useState<ViewMode>("card")

  useEffect(() => {
    setMode(getViewMode())
  }, [])

  const toggle = () => {
    const next = mode === "card" ? "compact" : "card"
    setMode(next)
    setViewMode(next)

    // Dispatch a custom event so the page can re-render
    window.dispatchEvent(new CustomEvent("repo-view-mode-change", { detail: next }))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "card" ? "Switch to compact view" : "Switch to card view"}
      title={mode === "card" ? "Switch to compact view" : "Switch to card view"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {mode === "card" ? (
        <List className="h-4 w-4" />
      ) : (
        <Grid3X3 className="h-4 w-4" />
      )}
    </button>
  )
}
