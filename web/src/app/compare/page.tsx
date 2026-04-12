"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight, GitCompareArrows } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CachedRepoView } from "@/lib/repository-service"
import { getCompareSelection, setCompareSelection } from "@/lib/compare"

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return Number.isNaN(date.getTime()) ? isoString : date.toISOString().slice(0, 10)
}

function StatCell({ label, values }: { label: string; values: (string | number | null)[] }) {
  return (
    <div className="grid gap-2 border-b border-border py-3 last:border-b-0" style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {values.map((value, i) => (
        <div key={i} className="text-sm text-foreground">
          {value ?? "—"}
        </div>
      ))}
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
    <div className="grid gap-2 border-b border-border py-3 last:border-b-0" style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {values.map((value, i) => (
        <div key={i} className="text-sm text-foreground">
          {value ?? "—"}
        </div>
      ))}
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

function CompareContent() {
  const searchParams = useSearchParams()
  const [repos, setRepos] = useState<CachedRepoView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fromUrl = searchParams.get("repos")
    let repoNames: string[]

    if (fromUrl) {
      repoNames = fromUrl.split(",").filter(Boolean).slice(0, 3)
      setCompareSelection(repoNames)
    } else {
      repoNames = getCompareSelection()
    }

    if (repoNames.length === 0) {
      setLoading(false)
      return
    }

    const loadRepos = async () => {
      const loaded: CachedRepoView[] = []

      for (const fullName of repoNames) {
        try {
          const response = await fetch(`/api/repo/${fullName}/brief`)
          if (response.ok) {
            const data = await response.json()
            if (data.kind === "cached") {
              loaded.push(data)
            }
          }
        } catch {
          // Skip repos that fail to load
        }
      }

      setRepos(loaded)
      setLoading(false)
    }

    loadRepos()
  }, [searchParams])

  const columnCount = repos.length

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
        Loading comparison data...
      </div>
    )
  }

  if (repos.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <GitCompareArrows className="mt-1 h-5 w-5 text-muted-foreground" />
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">No repositories selected</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Go to the repository index and click the compare icon on 2-3 repositories to start a comparison.
            </p>
            <Link
              href="/repos"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
            >
              Browse repositories
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      {/* Column headers */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {repos.map((view) => (
          <RepoColumnHeader key={view.fullName} view={view} />
        ))}
      </div>

      {/* Stats comparison */}
      <div className="overflow-hidden rounded-md border border-border bg-card p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
          Stats
        </div>
        <div className="space-y-0">
          <StatCell label="Stars" values={repos.map((v) => v.stats.stars.toLocaleString())} />
          <StatCell label="Forks" values={repos.map((v) => v.stats.forks.toLocaleString())} />
          <StatCell label="Default branch" values={repos.map((v) => v.stats.defaultBranch)} />
          <StatCell label="Last pushed" values={repos.map((v) => formatDate(v.stats.lastPushedAt))} />
          <StatCell label="Cached at" values={repos.map((v) => formatDate(v.cachedAt))} />
          <StatCell label="Fork briefs" values={repos.map((v) => String(v.forks.length))} />
        </div>
      </div>

      {/* Recommendations comparison */}
      <div className="overflow-hidden rounded-md border border-border bg-card p-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
          Fork recommendations
        </div>
        <div className="space-y-0">
          <RecommendationRow
            label="Best maintained"
            values={repos.map((v) => v.recommendations.bestMaintained)}
          />
          <RecommendationRow
            label="Closest upstream"
            values={repos.map((v) => v.recommendations.closestToUpstream)}
          />
          <RecommendationRow
            label="Most features"
            values={repos.map((v) => v.recommendations.mostFeatureRich)}
          />
          <RecommendationRow
            label="Most opinionated"
            values={repos.map((v) => v.recommendations.mostOpinionated)}
          />
        </div>
      </div>

      {/* Fork comparison summary */}
      {repos.some((v) => v.forks.length > 0) && (
        <div className="overflow-hidden rounded-md border border-border bg-card p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
            Top forks
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
          >
            {repos.map((view) => (
              <div key={view.fullName} className="space-y-3">
                {view.forks.slice(0, 3).map((fork) => (
                  <div key={fork.fullName} className="rounded-md border border-border bg-muted/70 p-4">
                    <div className="text-sm font-medium text-foreground">{fork.fullName}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={fork.maintenance === "active" ? "success" : "muted"}>
                        {fork.maintenance}
                      </Badge>
                      <Badge variant="muted">{fork.changeMagnitude}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground line-clamp-2">
                      {fork.summary}
                    </p>
                  </div>
                ))}
                {view.forks.length === 0 && (
                  <div className="text-sm text-muted-foreground">No fork data</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function ComparePage() {
  return (
    <RepoShell
      eyebrow="Repository comparison"
      title="Compare repositories side by side."
      description="Select 2-3 repositories from the repos list to compare their stats, summaries, and fork recommendations."
      compact
    >
      <Suspense fallback={<div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">Loading comparison data...</div>}>
        <CompareContent />
      </Suspense>
    </RepoShell>
  )
}
