"use client"

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Download, GitCompareArrows, Plus, RefreshCcw, Trash2, X } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  MAX_COMPARE_REPOS,
  applyCompareRepoInput,
  buildCompareHref,
  getCompareSelection,
  parseCompareSelectionValue,
  removeCompareSelectionRepo,
  setCompareSelection,
} from "@/lib/compare"
import { exportComparison } from "@/lib/export-comparison"
import {
  REPO_LAUNCHER_SUGGESTION_LABELS,
  getRepoLauncherSuggestions,
  type RepoLauncherSuggestion,
} from "@/lib/repo-launcher"
import type { CachedRepoView } from "@/lib/repository-service"
import { cn } from "@/lib/utils"

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return Number.isNaN(date.getTime()) ? isoString : date.toISOString().slice(0, 10)
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) {
    return "recently"
  }

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function selectionsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((repo, index) => repo === right[index])
}

function StatCell({ label, values }: { label: string; values: (string | number | null)[] }) {
  return (
    <div className="space-y-1 border-b border-border py-3 last:border-b-0">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((value, i) => (
          <div key={i} className="text-sm text-foreground">
            {value ?? "—"}
          </div>
        ))}
      </div>
    </div>
  )
}

function RecommendationRow({
  label,
  values,
}: {
  label: string
  values: (string | null)[]
}) {
  return (
    <div className="space-y-1 border-b border-border py-3 last:border-b-0">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((value, i) => (
          <div key={i} className="text-sm text-foreground">
            {value ?? "—"}
          </div>
        ))}
      </div>
    </div>
  )
}

function RepoColumnHeader({ view }: { view: CachedRepoView }) {
  return (
    <div className="space-y-3 rounded-t-md border border-border bg-card p-5">
      <Link
        href={`/${view.owner}/${view.repo}`}
        className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
      >
        {view.fullName}
      </Link>
      <div className="flex flex-wrap gap-2">
        <Badge variant="muted">{view.stats.stars.toLocaleString()} stars</Badge>
        <Badge variant="muted">{view.stats.forks.toLocaleString()} forks</Badge>
        <Badge variant="muted">{view.stats.defaultBranch}</Badge>
      </div>
      <p className="text-sm leading-6 text-muted-foreground line-clamp-3">{view.upstreamSummary}</p>
    </div>
  )
}

function ComparePickCard({
  fullName,
  view,
  replacing,
  onRemove,
  onToggleReplace,
}: {
  fullName: string
  view?: CachedRepoView
  replacing: boolean
  onRemove: (fullName: string) => void
  onToggleReplace: (fullName: string) => void
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-md border bg-card p-5 transition-colors",
        replacing ? "border-primary/50 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Selected repo</div>
          {view ? (
            <Link
              href={`/${view.owner}/${view.repo}`}
              className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {fullName}
            </Link>
          ) : (
            <div className="truncate text-sm font-semibold text-foreground">{fullName}</div>
          )}
          {view ? (
            <p className="text-xs leading-5 text-muted-foreground line-clamp-3">{view.upstreamSummary}</p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Cached comparison data is still loading for this selection.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleReplace(fullName)}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "gap-1.5 px-3 py-1.5 text-xs",
              replacing && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            {replacing ? "Replacing" : "Replace"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(fullName)}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-rose-500",
            )}
            aria-label={`Remove ${fullName} from compare`}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>

      {view ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="muted">{view.stats.stars.toLocaleString()} stars</Badge>
          <Badge variant="muted">{view.stats.forks.toLocaleString()} forks</Badge>
          <Badge variant="muted">Cached {formatDate(view.cachedAt)}</Badge>
        </div>
      ) : null}
    </div>
  )
}

function EmptyCompareSlot() {
  return (
    <div className="flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-card/50 p-5 text-center">
      <Plus className="h-5 w-5 text-muted-foreground" />
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">Open compare slot</div>
        <p className="text-xs leading-5 text-muted-foreground">
          Paste a repo above or add a recent, bookmarked, or watched repository below.
        </p>
      </div>
    </div>
  )
}

function SuggestionCard({
  suggestion,
  actionLabel,
  disabled,
  onAction,
}: {
  suggestion: RepoLauncherSuggestion
  actionLabel: string
  disabled: boolean
  onAction: (suggestion: RepoLauncherSuggestion) => void
}) {
  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-5">
      <div className="space-y-2">
        <Link
          href={suggestion.canonicalPath}
          className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
        >
          {suggestion.fullName}
        </Link>
        <div className="flex flex-wrap gap-2">
          {suggestion.sources.map((source) => (
            <Badge key={`${suggestion.fullName}-${source}`} variant="muted">
              {REPO_LAUNCHER_SUGGESTION_LABELS[source]}
            </Badge>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Last surfaced {formatRelativeTime(suggestion.lastTouchedAt)} from your local context.
        </p>
      </div>
      <Button variant="outline" className="w-full gap-2" disabled={disabled} onClick={() => onAction(suggestion)}>
        <Plus className="h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  )
}

function CompareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selection, setSelectionState] = useState<string[]>([])
  const [repoViews, setRepoViews] = useState<Record<string, CachedRepoView>>({})
  const [suggestions, setSuggestions] = useState<RepoLauncherSuggestion[]>([])
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState("")
  const [manualFeedback, setManualFeedback] = useState<{ message: string; tone: "error" | "info" | "success" } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fromUrl = parseCompareSelectionValue(searchParams.get("repos"))
    const nextSelection = fromUrl.length > 0 ? fromUrl : getCompareSelection()

    if (fromUrl.length > 0) {
      setCompareSelection(fromUrl)
    }

    setSelectionState((current) => (selectionsEqual(current, nextSelection) ? current : nextSelection))
    setReplaceTarget((current) => (current && nextSelection.includes(current) ? current : null))
    setSuggestions(getRepoLauncherSuggestions(12))

    if (fromUrl.length === 0 && nextSelection.length > 0) {
      router.replace(buildCompareHref(nextSelection), { scroll: false })
    }
  }, [router, searchParams])

  useEffect(() => {
    if (replaceTarget && !selection.includes(replaceTarget)) {
      setReplaceTarget(null)
      setManualFeedback(null)
    }
  }, [replaceTarget, selection])

  useEffect(() => {
    let cancelled = false

    if (selection.length === 0) {
      setRepoViews({})
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)

    const loadRepos = async () => {
      const entries = await Promise.all(
        selection.map(async (fullName) => {
          try {
            const response = await fetch(`/api/repo/${fullName}/brief`)
            if (!response.ok) {
              return [fullName, null] as const
            }

            const data = (await response.json()) as CachedRepoView | { kind: string }
            return [fullName, data.kind === "cached" ? data : null] as const
          } catch {
            return [fullName, null] as const
          }
        }),
      )

      if (cancelled) {
        return
      }

      setRepoViews(
        Object.fromEntries(entries.filter(([, view]) => view).map(([fullName, view]) => [fullName, view])) as Record<
          string,
          CachedRepoView
        >,
      )
      setLoading(false)
    }

    void loadRepos()

    return () => {
      cancelled = true
    }
  }, [selection])

  const loadedRepos = useMemo(
    () => selection.map((fullName) => repoViews[fullName]).filter((view): view is CachedRepoView => Boolean(view)),
    [repoViews, selection],
  )

  const availableSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !selection.includes(suggestion.fullName)),
    [selection, suggestions],
  )

  const compareLimitReached = selection.length >= MAX_COMPARE_REPOS
  const instruction = replaceTarget
    ? `Replacing ${replaceTarget}. Paste a repo above or pick one of the suggestions below to swap it out in place.`
    : compareLimitReached
      ? "You have reached the 3-repo compare limit. Click Replace on a selected repo, then paste a repo above or choose a suggestion below."
      : `Paste a repo above or add up to ${MAX_COMPARE_REPOS - selection.length} more repositories from your recent, bookmarked, or watched activity.`
  const pasteInstruction = replaceTarget
    ? `Paste an owner/repo value or a GitHub or Discofork URL to replace ${replaceTarget}.`
    : compareLimitReached
      ? "Choose Replace on a selected repo, then paste an owner/repo value or repo URL here."
      : "Paste an owner/repo value or a GitHub or Discofork URL to fill the next open compare slot."
  const pasteActionLabel = replaceTarget ? `Replace ${replaceTarget}` : "Add to compare"

  const persistWorkspace = (nextSelection: string[]) => {
    const persistedSelection = setCompareSelection(nextSelection)
    setSelectionState(persistedSelection)
    setReplaceTarget((current) => (current && persistedSelection.includes(current) ? current : null))
    router.replace(buildCompareHref(persistedSelection), { scroll: false })
  }

  const handleRemove = (fullName: string) => {
    setManualFeedback(null)
    if (replaceTarget === fullName) {
      setReplaceTarget(null)
    }
    persistWorkspace(removeCompareSelectionRepo(selection, fullName))
  }

  const handleClear = () => {
    setManualFeedback(null)
    setManualInput("")
    setReplaceTarget(null)
    persistWorkspace([])
  }

  const handleSuggestionAction = (suggestion: RepoLauncherSuggestion) => {
    const result = applyCompareRepoInput(selection, suggestion.fullName, replaceTarget)

    if (result.kind === "error") {
      setManualFeedback({ message: result.message, tone: "error" })
      return
    }

    if (result.kind === "unchanged") {
      setManualFeedback({ message: result.message, tone: "info" })
      return
    }

    persistWorkspace(result.nextSelection)
    setManualInput("")
    setManualFeedback({ message: result.message, tone: "success" })
    setReplaceTarget(null)
  }

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = applyCompareRepoInput(selection, manualInput, replaceTarget)
    if (result.kind === "error") {
      setManualFeedback({ message: result.message, tone: "error" })
      return
    }

    if (result.kind === "unchanged") {
      setManualFeedback({ message: result.message, tone: "info" })
      return
    }

    persistWorkspace(result.nextSelection)
    setManualInput("")
    setManualFeedback({ message: result.message, tone: "success" })
    setReplaceTarget(null)
  }

  const missingRepoCount = selection.length - loadedRepos.length

  return (
    <section className="space-y-6">
      <div className="space-y-5 rounded-md border border-border bg-card p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Workspace</div>
            <h2 className="text-base font-semibold text-foreground">
              {selection.length > 0 ? `${selection.length} of ${MAX_COMPARE_REPOS} compare slots filled` : "No repositories selected yet"}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{instruction}</p>
          </div>
          {selection.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs text-muted-foreground hover:text-rose-500")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          ) : null}
        </div>

        <div className="rounded-md border border-dashed border-border bg-background/40 p-4">
          <div className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Paste a repo</div>
            <h3 className="text-sm font-semibold text-foreground">Add directly from a name or URL</h3>
            <p className="text-xs leading-5 text-muted-foreground">{pasteInstruction}</p>
          </div>
          <form onSubmit={handleManualSubmit} className="mt-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={manualInput}
                onChange={(event) => {
                  setManualInput(event.target.value)
                  setManualFeedback(null)
                }}
                placeholder="openai/codex or https://github.com/openai/codex"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
              />
              <Button type="submit" className="gap-2 sm:self-start">
                {pasteActionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {manualFeedback ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  manualFeedback.tone === "error"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                    : manualFeedback.tone === "info"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
                )}
              >
                {manualFeedback.message}
              </div>
            ) : null}
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {selection.map((fullName) => (
            <ComparePickCard
              key={fullName}
              fullName={fullName}
              view={repoViews[fullName]}
              replacing={replaceTarget === fullName}
              onRemove={handleRemove}
              onToggleReplace={(target) => {
                setManualFeedback(null)
                setReplaceTarget((current) => (current === target ? null : target))
              }}
            />
          ))}
          {Array.from({ length: Math.max(MAX_COMPARE_REPOS - selection.length, 0) }).map((_, index) => (
            <EmptyCompareSlot key={`empty-slot-${index}`} />
          ))}
        </div>

        {missingRepoCount > 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            {missingRepoCount} selected {missingRepoCount === 1 ? "repository is" : "repositories are"} still loading or missing cached
            compare data. You can keep editing the selection while those responses resolve.
          </div>
        ) : null}
      </div>

      {availableSuggestions.length > 0 ? (
        <div className="space-y-4 rounded-md border border-border bg-card p-5">
          <div className="space-y-1">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Suggestions</div>
            <h2 className="text-base font-semibold text-foreground">Add or replace from local context</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Suggestions are sourced from repositories you recently viewed, bookmarked, or watched in this browser.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableSuggestions.map((suggestion) => {
              const disabled = compareLimitReached && !replaceTarget
              const actionLabel = replaceTarget ? `Replace ${replaceTarget}` : compareLimitReached ? "Choose a repo above first" : "Add to compare"

              return (
                <SuggestionCard
                  key={suggestion.fullName}
                  suggestion={suggestion}
                  actionLabel={actionLabel}
                  disabled={disabled}
                  onAction={handleSuggestionAction}
                />
              )
            })}
          </div>
        </div>
      ) : selection.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <GitCompareArrows className="mt-1 h-5 w-5 text-muted-foreground" />
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">No local compare suggestions yet</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Paste a repo above to build your first compare set, or browse the repository index to build more local suggestions for this browser.
              </p>
              <Link href="/repos" className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}>
                Browse repositories
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
          Loading comparison data...
        </div>
      ) : loadedRepos.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <GitCompareArrows className="mt-1 h-5 w-5 text-muted-foreground" />
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">No cached comparison data available yet</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Keep editing the compare lineup here, or browse more repositories to choose entries that already have cached briefs.
              </p>
              <Link href="/repos" className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}>
                Browse repositories
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {loadedRepos.length >= 2 ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => exportComparison(loadedRepos)}
                className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
              >
                <Download className="h-4 w-4" />
                Export .md
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {loadedRepos.map((view) => (
              <RepoColumnHeader key={view.fullName} view={view} />
            ))}
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-card p-5">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Stats</div>
            <div className="space-y-0">
              <StatCell label="Stars" values={loadedRepos.map((view) => view.stats.stars.toLocaleString())} />
              <StatCell label="Forks" values={loadedRepos.map((view) => view.stats.forks.toLocaleString())} />
              <StatCell label="Default branch" values={loadedRepos.map((view) => view.stats.defaultBranch)} />
              <StatCell label="Last pushed" values={loadedRepos.map((view) => formatDate(view.stats.lastPushedAt))} />
              <StatCell label="Cached at" values={loadedRepos.map((view) => formatDate(view.cachedAt))} />
              <StatCell label="Fork briefs" values={loadedRepos.map((view) => String(view.forks.length))} />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-card p-5">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Fork recommendations
            </div>
            <div className="space-y-0">
              <RecommendationRow
                label="Best maintained"
                values={loadedRepos.map((view) => view.recommendations.bestMaintained)}
              />
              <RecommendationRow
                label="Closest upstream"
                values={loadedRepos.map((view) => view.recommendations.closestToUpstream)}
              />
              <RecommendationRow
                label="Most features"
                values={loadedRepos.map((view) => view.recommendations.mostFeatureRich)}
              />
              <RecommendationRow
                label="Most opinionated"
                values={loadedRepos.map((view) => view.recommendations.mostOpinionated)}
              />
            </div>
          </div>

          {loadedRepos.some((view) => view.forks.length > 0) ? (
            <div className="overflow-hidden rounded-md border border-border bg-card p-5">
              <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Top forks</div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {loadedRepos.map((view) => (
                  <div key={view.fullName} className="space-y-3">
                    {view.forks.slice(0, 3).map((fork) => (
                      <div key={fork.fullName} className="rounded-md border border-border bg-muted/70 p-4">
                        <div className="text-sm font-medium text-foreground">{fork.fullName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={fork.maintenance === "active" ? "success" : "muted"}>{fork.maintenance}</Badge>
                          <Badge variant="muted">{fork.changeMagnitude}</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-2">{fork.summary}</p>
                      </div>
                    ))}
                    {view.forks.length === 0 ? <div className="text-sm text-muted-foreground">No fork data</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default function ComparePage() {
  return (
    <RepoShell
      eyebrow="Repository comparison"
      title="Compare repositories side by side."
      description="Manage your active comparison directly on this page, paste repositories by name or URL, remove or replace selections in place, and seed new compare sets from recent, bookmarked, or watched repositories."
      compact
    >
      <Suspense
        fallback={
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            Loading comparison data...
          </div>
        }
      >
        <CompareContent />
      </Suspense>
    </RepoShell>
  )
}
