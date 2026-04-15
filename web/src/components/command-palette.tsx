"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, Star, X } from "lucide-react"

import { createLatestRequestGuard } from "@/lib/latest-request-guard"

type PaletteResult = {
  fullName: string
  owner: string
  repo: string
  stars: number | null
  upstreamSummary: string | null
}

const MAX_RESULTS = 8
const DEBOUNCE_MS = 300
const MAX_SUMMARY_LENGTH = 100

function truncate(text: string | null, max: number): string {
  if (!text) return ""
  if (text.length <= max) return text
  return text.slice(0, max) + "…"
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PaletteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const latestSearchRef = useRef<ReturnType<typeof createLatestRequestGuard> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  if (latestSearchRef.current === null) {
    latestSearchRef.current = createLatestRequestGuard()
  }
  const latestSearch = latestSearchRef.current
  const router = useRouter()

  const clearPendingSearchTimer = useCallback(() => {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
  }, [])

  const updateQuery = useCallback((nextQuery: string) => {
    clearPendingSearchTimer()
    latestSearch.invalidate()
    setQuery(nextQuery)
    setResults([])
    setHighlightedIndex(-1)
    setLoading(nextQuery.trim().length > 0)
  }, [clearPendingSearchTimer, latestSearch])

  const closePalette = useCallback(() => {
    clearPendingSearchTimer()
    latestSearch.invalidate()
    setOpen(false)
    setQuery("")
    setResults([])
    setHighlightedIndex(-1)
    setLoading(false)
  }, [clearPendingSearchTimer, latestSearch])

  // Global shortcut: Cmd+K / Ctrl+K (skip when focus is in an input-like element)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
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
        if (open) {
          closePalette()
        } else {
          setOpen(true)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closePalette, open])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  useEffect(() => {
    return () => {
      clearPendingSearchTimer()
      latestSearch.invalidate()
    }
  }, [clearPendingSearchTimer, latestSearch])

  // Escape closes the palette
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closePalette()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [closePalette, open])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    clearPendingSearchTimer()

    if (!open) {
      return
    }

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      searchTimerRef.current = null
      const request = latestSearch.begin()

      try {
        const params = new URLSearchParams({
          query: trimmedQuery,
          status: "ready",
          page: "1",
        })
        const res = await fetch(`/api/repos?${params}`, { signal: request.signal })
        if (!res.ok || !request.isCurrent()) return

        const data = await res.json()
        if (!request.isCurrent()) return

        const items: PaletteResult[] = (data.items ?? []).slice(0, MAX_RESULTS).map(
          (item: Record<string, unknown>) => ({
            fullName: item.fullName,
            owner: item.owner,
            repo: item.repo,
            stars: item.stars,
            upstreamSummary: item.upstreamSummary,
          }),
        )
        setResults(items)
        setHighlightedIndex(items.length > 0 ? 0 : -1)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        // Silent fail — palette just stays empty
      } finally {
        if (request.isCurrent()) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearPendingSearchTimer()
    }
  }, [clearPendingSearchTimer, open, query])

  // Keyboard navigation within results
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
      } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < results.length) {
        e.preventDefault()
        const item = results[highlightedIndex]
        closePalette()
        router.push(`/${item.owner}/${item.repo}`)
      }
    },
    [closePalette, results, highlightedIndex, router],
  )

  const navigateTo = useCallback(
    (owner: string, repo: string) => {
      closePalette()
      router.push(`/${owner}/${repo}`)
    },
    [closePalette, router],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm"
      onClick={closePalette}
    >
      <div
        className="relative w-full max-w-lg rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search repositories…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Search repositories"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={closePalette}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto py-1">
            {results.map((item, index) => (
              <button
                key={item.fullName}
                type="button"
                onClick={() => navigateTo(item.owner, item.repo)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  index === highlightedIndex ? "bg-muted/50" : "hover:bg-muted/30"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.fullName}</span>
                    {item.stars != null && item.stars > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3" />
                        {item.stars.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {item.upstreamSummary && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {truncate(item.upstreamSummary, MAX_SUMMARY_LENGTH)}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query.trim() && !loading && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No repositories found.
          </div>
        )}

        {/* Hint when query is empty */}
        {!query.trim() && !loading && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Type to search across cached repositories…
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              select
            </span>
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
