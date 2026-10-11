"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Slash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useRepoLauncherWorkspace } from "@/hooks/use-repo-launcher-workspace"
import {
  buildRepoLauncherSearchResults,
  REPO_LAUNCHER_SUGGESTION_LABELS,
} from "@/lib/repo-launcher"
import { getNextQuickJumpSuggestionIndex, resolveQuickJumpTarget } from "@/lib/quick-jump"

export function QuickJumpDialog() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { suggestions } = useRepoLauncherWorkspace(8)

  const results = useMemo(
    () => buildRepoLauncherSearchResults({ query: value, suggestions, limit: 8 }),
    [suggestions, value],
  )

  const closeDialog = useCallback(() => {
    setOpen(false)
    setValue("")
    setHighlightedIndex(-1)
  }, [])

  const navigateTo = useCallback(
    (owner: string, repo: string) => {
      closeDialog()
      router.push(`/${owner}/${repo}`)
    },
    [closeDialog, router],
  )

  // Open with "/" when not focused on an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return
        }
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setValue("")
      setHighlightedIndex(-1)
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeDialog()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [closeDialog, open])

  useEffect(() => {
    if (!open) return

    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    setHighlightedIndex(results.length > 0 ? 0 : -1)
  }, [results])

  const submitTarget = resolveQuickJumpTarget(value, results, highlightedIndex, { preferActiveSuggestion: true })

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (submitTarget) {
        navigateTo(submitTarget.owner, submitTarget.repo)
      }
    },
    [navigateTo, submitTarget],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (results.length === 0 || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) {
        return
      }

      e.preventDefault()
      const direction = e.key === "ArrowDown" ? "next" : "previous"
      setHighlightedIndex((prev) => getNextQuickJumpSuggestionIndex(prev, results.length, direction))
    },
    [results.length],
  )

  if (!open) {
    return (
      <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">/</kbd>
        <span>jump to repo</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 pt-[15vh] backdrop-blur-sm" onClick={closeDialog}>
      <div className="relative w-full max-w-xl rounded-lg border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Slash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="quick-jump-suggestions"
            aria-activedescendant={highlightedIndex >= 0 ? `quick-jump-suggestion-${highlightedIndex}` : undefined}
            aria-label="Navigate to repository"
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

        {results.length > 0 ? (
          <div id="quick-jump-suggestions" role="listbox" aria-label="Repository suggestions" className="max-h-[320px] overflow-y-auto py-2">
            {results.map((result, index) => (
              <button
                key={`${result.kind}-${result.fullName}`}
                id={`quick-jump-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => navigateTo(result.owner, result.repo)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  index === highlightedIndex ? "bg-muted/50" : "hover:bg-muted/30"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{result.fullName}</span>
                    <Badge variant={result.kind === "direct" ? "success" : "muted"}>
                      {result.kind === "direct" ? "Typed repo" : result.kind === "cached" ? "Cached repo" : "Local context"}
                    </Badge>
                  </div>
                  {result.sources.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.sources.map((source) => (
                        <Badge key={`${result.fullName}-${source}`} variant="muted">
                          {REPO_LAUNCHER_SUGGESTION_LABELS[source]}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-4 text-xs text-muted-foreground">
            Type an owner/repo, GitHub URL, or Discofork URL. Recent, bookmarked, and watched repositories appear here automatically.
          </div>
        )}

        <div className="border-t border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">↵</kbd>{" "}
              open repo
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">esc</kbd>{" "}
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
