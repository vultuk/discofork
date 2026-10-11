"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  filterRepoLauncherSuggestions,
  getRepoLauncherSuggestions,
  parseRepoLauncherInput,
  REPO_LAUNCHER_SUGGESTION_LABELS,
  type RepoLauncherSuggestion,
  type RepoLauncherTarget,
} from "@/lib/repo-launcher"

function SuggestionButton({
  suggestion,
  onSelect,
}: {
  suggestion: RepoLauncherSuggestion
  onSelect: (target: RepoLauncherTarget) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className="rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/70"
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

export function QueueInput({ placeholder = "owner/repo" }: { placeholder?: string }) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [suggestions, setSuggestions] = useState<RepoLauncherSuggestion[]>([])

  const refreshSuggestions = useCallback(() => {
    setSuggestions(getRepoLauncherSuggestions())
  }, [])

  useEffect(() => {
    refreshSuggestions()
  }, [refreshSuggestions])

  const navigateToRepo = useCallback(
    (target: RepoLauncherTarget) => {
      setInput("")
      setError("")
      router.push(target.canonicalPath)
    },
    [router],
  )

  const filteredSuggestions = useMemo(
    () => filterRepoLauncherSuggestions(suggestions, input),
    [input, suggestions],
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError("")

      const trimmed = input.trim()
      if (!trimmed) {
        setError("Please enter a repository name.")
        return
      }

      const target = parseRepoLauncherInput(trimmed)
      if (!target) {
        setError("Paste owner/repo, a GitHub repo URL, or a Discofork repo URL.")
        return
      }

      navigateToRepo(target)
    },
    [input, navigateToRepo],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError("")
            }}
            onFocus={refreshSuggestions}
            placeholder={placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        <Button type="submit" variant="default" className="gap-2 rounded-md px-4">
          Queue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {filteredSuggestions.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Quick reopen</div>
            <p className="text-xs text-muted-foreground">Recent, bookmarked, and watched repos on this device.</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {filteredSuggestions.map((suggestion) => (
              <SuggestionButton key={suggestion.fullName} suggestion={suggestion} onSelect={navigateToRepo} />
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </form>
  )
}
