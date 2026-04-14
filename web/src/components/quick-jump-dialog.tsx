"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Slash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  filterRepoLauncherSuggestions,
  getRepoLauncherSuggestions,
  REPO_LAUNCHER_SUGGESTION_LABELS,
  type RepoLauncherSuggestion,
  type RepoLauncherTarget,
} from "@/lib/repo-launcher"
import {
  getDefaultQuickJumpSuggestionIndex,
  getNextQuickJumpSuggestionIndex,
  resolveQuickJumpTarget,
} from "@/lib/quick-jump"

function QuickJumpSuggestionButton({
  suggestion,
  index,
  active,
  onHover,
  onSelect,
}: {
  suggestion: RepoLauncherSuggestion
  index: number
  active: boolean
  onHover: (index: number) => void
  onSelect: (target: RepoLauncherTarget) => void
}) {
  return (
    <button
      id={`quick-jump-suggestion-${index}`}
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(suggestion)}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        active ? "border-foreground/20 bg-muted/80" : "border-border bg-card hover:bg-muted/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-foreground">{suggestion.fullName}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestion.sources.map((source) => (
          <Badge key={source} variant="muted" className="tracking-[0.1em]">
            {REPO_LAUNCHER_SUGGESTION_LABELS[source]}
          </Badge>
        ))}
      </div>
    </button>
  )
}

export function QuickJumpDialog() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<RepoLauncherSuggestion[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [hasExplicitSuggestionSelection, setHasExplicitSuggestionSelection] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const refreshSuggestions = useCallback(() => {
    setSuggestions(getRepoLauncherSuggestions())
  }, [])

  const navigateToRepo = useCallback(
    (target: RepoLauncherTarget) => {
      setOpen(false)
      setValue("")
      setSuggestions([])
      setActiveSuggestionIndex(-1)
      setHasExplicitSuggestionSelection(false)
      router.push(target.canonicalPath)
    },
    [router],
  )

  // Open with "/" when not focused on an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Focus input when opening and refresh local suggestions
  useEffect(() => {
    if (open) {
      setValue("")
      refreshSuggestions()
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open, refreshSuggestions])

  // Escape closes
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [open])

  const filteredSuggestions = useMemo(
    () => filterRepoLauncherSuggestions(suggestions, value),
    [suggestions, value],
  )

  useEffect(() => {
    if (!open) {
      setActiveSuggestionIndex(-1)
      setHasExplicitSuggestionSelection(false)
      return
    }

    setActiveSuggestionIndex(getDefaultQuickJumpSuggestionIndex(filteredSuggestions, value))
    setHasExplicitSuggestionSelection(false)
  }, [filteredSuggestions, open, value])

  const submitTarget = useMemo(
    () =>
      resolveQuickJumpTarget(value, filteredSuggestions, activeSuggestionIndex, {
        preferActiveSuggestion: hasExplicitSuggestionSelection,
      }),
    [activeSuggestionIndex, filteredSuggestions, hasExplicitSuggestionSelection, value],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!submitTarget) return
      navigateToRepo(submitTarget)
    },
    [navigateToRepo, submitTarget],
  )

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
        return
      }

      const nextIndex = getNextQuickJumpSuggestionIndex(
        activeSuggestionIndex,
        filteredSuggestions.length,
        e.key === "ArrowDown" ? "next" : "previous",
      )
      if (nextIndex === -1) {
        return
      }

      e.preventDefault()
      setActiveSuggestionIndex(nextIndex)
      setHasExplicitSuggestionSelection(true)
    },
    [activeSuggestionIndex, filteredSuggestions.length],
  )

  if (!open) {
    return (
      <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">
          /
        </kbd>
        <span>jump to repo</span>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Slash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={refreshSuggestions}
            onKeyDown={handleInputKeyDown}
            placeholder="owner/repo or repo URL"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Navigate to repository"
            aria-controls="quick-jump-suggestions"
            aria-activedescendant={activeSuggestionIndex >= 0 ? `quick-jump-suggestion-${activeSuggestionIndex}` : undefined}
          />
          <button
            type="submit"
            disabled={!submitTarget}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Go"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Paste <span className="font-mono font-medium text-foreground">owner/repo</span>, a GitHub repo URL, or a Discofork repo URL to jump directly to the repository brief.
          </p>
        </div>
        {filteredSuggestions.length > 0 ? (
          <div className="border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Quick reopen</div>
              <p className="text-xs text-muted-foreground">Recent, bookmarked, and watched repos on this device.</p>
            </div>
            <div id="quick-jump-suggestions" role="listbox" className="mt-3 grid gap-2">
              {filteredSuggestions.map((suggestion, index) => (
                <QuickJumpSuggestionButton
                  key={suggestion.fullName}
                  suggestion={suggestion}
                  index={index}
                  active={index === activeSuggestionIndex}
                  onHover={(nextIndex) => {
                    setActiveSuggestionIndex(nextIndex)
                    setHasExplicitSuggestionSelection(true)
                  }}
                  onSelect={navigateToRepo}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="border-t border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              navigate
            </span>
            {filteredSuggestions.length > 0 ? (
              <span>
                <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                  ↑↓
                </kbd>{" "}
                select
              </span>
            ) : null}
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                esc
              </kbd>{" "}
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
