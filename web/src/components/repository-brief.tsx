"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ArrowUpRight, ArrowUpDown, Clock3, Database, Download, Filter, GitFork, Radar, Star, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { BookmarkButton } from "@/components/bookmark-button"
import { WatchButton } from "@/components/watch-button"
import { TagManager } from "@/components/tag-manager"
import { buttonVariants } from "@/components/ui/button"
import type { CachedRepoView, QueuedRepoView } from "@/lib/repository-service"
import { exportRepoBrief } from "@/lib/export-brief"
import { cn } from "@/lib/utils"

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}


export function QueuedRepositoryBrief({ view }: { view: QueuedRepoView }) {
  const router = useRouter()
  const [liveView, setLiveView] = useState(view)

  useEffect(() => {
    setLiveView(view)
  }, [view])

  useEffect(() => {
    if (!view.liveStatusEnabled) {
      return
    }

    const source = new EventSource(`/api/repo/${view.owner}/${view.repo}/status`)

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        snapshot: {
          status: "queued" | "processing" | "ready" | "failed"
          queuePosition: number | null
          progress: QueuedRepoView["progress"]
          errorMessage: string | null
          queuedAt: string | null
          retryCount: number
          retryState: QueuedRepoView["retryState"]
          nextRetryAt: string | null
          lastFailedAt: string | null
        } | null
      }

      const snapshot = payload.snapshot
      if (!snapshot) {
        return
      }

      if (snapshot.status === "ready") {
        source.close()
        router.refresh()
        return
      }

      const nextStatus: QueuedRepoView["status"] = snapshot.status

      setLiveView((current) => ({
        ...current,
        status: nextStatus,
        queuePosition: snapshot.queuePosition,
        progress: snapshot.progress,
        errorMessage: snapshot.errorMessage,
        queuedAt: snapshot.queuedAt ?? current.queuedAt,
        retryCount: snapshot.retryCount,
        retryState: snapshot.retryState,
        nextRetryAt: snapshot.nextRetryAt,
        lastFailedAt: snapshot.lastFailedAt,
      }))
    }

    return () => {
      source.close()
    }
  }, [router, view.liveStatusEnabled, view.owner, view.repo])

  const progressPercent =
    liveView.progress?.current !== null &&
    liveView.progress?.current !== undefined &&
    liveView.progress?.total !== null &&
    liveView.progress?.total !== undefined &&
    liveView.progress.total > 0
      ? Math.max(0, Math.min(100, Math.round((liveView.progress.current / liveView.progress.total) * 100)))
      : null
  const progressStepLabel =
    liveView.progress?.current !== null &&
    liveView.progress?.current !== undefined &&
    liveView.progress?.total !== null &&
    liveView.progress?.total !== undefined
      ? `Step ${liveView.progress.current} of ${liveView.progress.total}`
      : null

  const statusBadgeLabel =
    liveView.retryState === "retrying"
      ? "Retrying"
      : liveView.status === "processing"
        ? "Processing"
        : liveView.status === "failed"
          ? liveView.retryState === "terminal"
            ? "Terminal failure"
            : "Failed"
          : !liveView.liveStatusEnabled
            ? "No live status"
            : "Queued lookup"
  const statusBadgeVariant =
    liveView.status === "processing" && liveView.retryState !== "retrying"
      ? "success"
      : liveView.status === "failed" || liveView.retryState === "retrying"
        ? "warning"
        : !liveView.liveStatusEnabled
          ? "muted"
          : "warning"

  const liveHint =
    !liveView.liveStatusEnabled
      ? liveView.queueHint
      : liveView.retryState === "retrying"
        ? liveView.nextRetryAt
          ? `Discofork is retrying this repository after a transient failure. Retry ${liveView.retryCount} is scheduled for ${liveView.nextRetryAt}.`
          : `Discofork is retrying this repository after a transient failure. Retry ${liveView.retryCount} is pending.`
        : liveView.status === "processing"
          ? "This repository is currently being analyzed by Discofork."
          : liveView.status === "failed"
            ? liveView.retryState === "terminal"
              ? "The latest analysis exhausted the retry budget and now needs a manual requeue from the repository index."
              : "The latest analysis failed. You can retry it from the repository index."
            : typeof liveView.queuePosition === "number"
              ? `This repository is queued for Discofork analysis. Current queue position: ${liveView.queuePosition}.`
              : liveView.queueHint

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
      <div className="rounded-md border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusBadgeVariant}>{statusBadgeLabel}</Badge>
          {liveView.liveStatusEnabled ? <Badge variant="muted">queued {liveView.queuedAt}</Badge> : <Badge variant="muted">static fallback</Badge>}
          {typeof liveView.queuePosition === "number" ? <Badge variant="muted">queue #{liveView.queuePosition}</Badge> : null}
          {liveView.retryState === "retrying" ? <Badge variant="muted">retry {liveView.retryCount}</Badge> : null}
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">No cached brief yet</h2>
          <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground">{liveHint}</p>
          {liveView.errorMessage ? <p className="text-sm leading-7 text-rose-600 dark:text-rose-300">{liveView.errorMessage}</p> : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/70 p-4">
            <Radar className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium text-foreground">
              {liveView.liveStatusEnabled ? "Lookup requested" : "Live queue unavailable"}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/70 p-4">
            <Database className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium text-foreground">Database miss</div>
          </div>
          <div className="rounded-md border border-border bg-muted/70 p-4">
            <Clock3 className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium text-foreground">
              {!liveView.liveStatusEnabled
                ? "No status row to stream yet"
                : liveView.retryState === "retrying"
                  ? "Automatic retry scheduled"
                  : liveView.status === "processing"
                    ? "Worker is running"
                    : liveView.status === "failed"
                      ? "Retry budget exhausted"
                      : "Awaiting backend run"}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-border bg-muted/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Live status</div>
              <div className="mt-2 text-sm font-medium text-foreground">
                {liveView.progress?.detail ??
                  (!liveView.liveStatusEnabled
                    ? liveView.queueHint
                    : liveView.retryState === "retrying"
                      ? liveView.nextRetryAt
                        ? `Waiting to retry at ${liveView.nextRetryAt}.`
                        : `Retry ${liveView.retryCount} is pending.`
                      : liveView.status === "processing"
                        ? "Discofork is working through the analysis pipeline."
                        : liveView.queuePosition
                          ? `Waiting in queue at position ${liveView.queuePosition}.`
                          : "Waiting for a worker to pick up this repository.")}
              </div>
            </div>
            {progressPercent !== null ? <div className="text-sm font-semibold text-foreground">{progressPercent}%</div> : null}
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent ?? (liveView.status === "processing" ? 12 : 4)}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {liveView.progress?.phase ? <span>Phase {liveView.progress.phase}</span> : null}
            {progressStepLabel ? <span>{progressStepLabel}</span> : null}
            {liveView.nextRetryAt ? <span>Next retry {liveView.nextRetryAt}</span> : null}
            {liveView.lastFailedAt ? <span>Last failed {liveView.lastFailedAt}</span> : null}
            {liveView.progress?.updatedAt ? <span>Updated {liveView.progress.updatedAt}</span> : null}
          </div>
        </div>
      </div>

      <aside className="rounded-md border border-border bg-card p-6">
        <div className="space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Repository source</div>
          <a
            href={view.githubUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between rounded-md px-5 py-6")}
          >
            Open on GitHub
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">What happens next</div>
          {liveView.liveStatusEnabled ? (
            <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
              <li>The web backend has queued this repo in Redis if it was not already pending.</li>
              <li>The Discofork worker will run the analysis pipeline and save the result in Postgres.</li>
              <li>Transient worker failures now retry automatically with backoff before a terminal failure is surfaced.</li>
            </ul>
          ) : (
            <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
              <li>This view is a static fallback because Discofork cannot show Redis-backed live status updates right now.</li>
              <li>{liveView.queueHint}</li>
              <li>
                {liveView.status === "failed"
                  ? "Use the repository index to request another run after queueing is restored."
                  : "Once queueing is restored, Discofork can resume live status updates for this repository from its stored state."}
              </li>
            </ul>
          )}
        </div>
      </aside>
    </section>
  )
}

export function CachedRepositoryBrief({ view }: { view: CachedRepoView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const maintenanceFilter = searchParams.get("maintenance") ?? ""
  const magnitudeFilter = searchParams.get("magnitude") ?? ""
  const sortBy = searchParams.get("sort") ?? ""

  const allMaintenances = useMemo(
    () => [...new Set(view.forks.map((f) => f.maintenance))].sort(),
    [view.forks],
  )
  const allMagnitudes = useMemo(
    () => [...new Set(view.forks.map((f) => f.changeMagnitude))].sort(),
    [view.forks],
  )

  const filteredForks = useMemo(() => {
    let result = view.forks

    if (maintenanceFilter) {
      result = result.filter((f) => f.maintenance === maintenanceFilter)
    }
    if (magnitudeFilter) {
      result = result.filter((f) => f.changeMagnitude === magnitudeFilter)
    }
    if (sortBy === "maintenance") {
      result = [...result].sort((a, b) => a.maintenance.localeCompare(b.maintenance))
    } else if (sortBy === "magnitude") {
      result = [...result].sort((a, b) => a.changeMagnitude.localeCompare(b.changeMagnitude))
    } else if (sortBy === "name") {
      result = [...result].sort((a, b) => a.fullName.localeCompare(b.fullName))
    }

    return result
  }, [view.forks, maintenanceFilter, magnitudeFilter, sortBy])

  const [selectedForkName, setSelectedForkName] = useState(filteredForks[0]?.fullName ?? "")
  const selectedFork = filteredForks.find((fork) => fork.fullName === selectedForkName) ?? filteredForks[0]

  useEffect(() => {
    if (filteredForks.length > 0 && !filteredForks.some((f) => f.fullName === selectedForkName)) {
      setSelectedForkName(filteredForks[0].fullName)
    }
  }, [filteredForks, selectedForkName])

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const hasActiveFilters = maintenanceFilter || magnitudeFilter || sortBy

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Cached analysis</Badge>
                <Badge variant="muted">cached {view.cachedAt}</Badge>
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{view.fullName}</h2>
                <p className="mt-3 max-w-[110ch] text-[14px] leading-7 text-muted-foreground">{view.upstreamSummary}</p>
              </div>
            </div>

            <a
              href={view.githubUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
            >
              GitHub
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <BookmarkButton owner={view.owner} repo={view.repo} variant="button" />
            <WatchButton owner={view.owner} repo={view.repo} variant="button" />
            <button
              type="button"
              onClick={() => exportRepoBrief(view)}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
            >
              <Download className="h-4 w-4" />
              Export .md
            </button>
          </div>

          <div className="mt-4">
            <TagManager fullName={view.fullName} />
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
            <MetaItem label="Stars" value={view.stats.stars.toLocaleString()} />
            <MetaItem label="Forks" value={view.stats.forks.toLocaleString()} />
            <MetaItem label="Default branch" value={view.stats.defaultBranch} />
            <MetaItem label="Last pushed" value={view.stats.lastPushedAt} />
          </div>

          <div className="mt-6 grid gap-x-8 gap-y-3 border-t border-border pt-4 md:grid-cols-2">
            <MetaItem label="Best maintained" value={view.recommendations.bestMaintained} />
            <MetaItem label="Closest to upstream" value={view.recommendations.closestToUpstream} />
            <MetaItem label="Most feature-rich" value={view.recommendations.mostFeatureRich} />
            <MetaItem label="Most opinionated" value={view.recommendations.mostOpinionated} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Forks</div>
              <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">Choose a fork to inspect</h3>
            </div>
            <div className="text-xs text-muted-foreground">
              {filteredForks.length} of {view.forks.length} fork briefs
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="maintenance-filter" className="text-xs text-muted-foreground">Maintenance:</label>
              <select
                id="maintenance-filter"
                value={maintenanceFilter}
                onChange={(e) => updateParams({ maintenance: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
              >
                <option value="">All</option>
                {allMaintenances.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="magnitude-filter" className="text-xs text-muted-foreground">Magnitude:</label>
              <select
                id="magnitude-filter"
                value={magnitudeFilter}
                onChange={(e) => updateParams({ magnitude: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
              >
                <option value="">All</option>
                {allMagnitudes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <label htmlFor="sort-by" className="text-xs text-muted-foreground">Sort:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => updateParams({ sort: e.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
              >
                <option value="">Default</option>
                <option value="maintenance">Maintenance</option>
                <option value="magnitude">Change magnitude</option>
                <option value="name">Name</option>
              </select>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => updateParams({ maintenance: "", magnitude: "", sort: "" })}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-border">
            {filteredForks.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No forks match the current filters.
              </div>
            ) : (
              filteredForks.map((fork) => {
                const active = fork.fullName === selectedFork?.fullName

                return (
                  <button
                    key={fork.fullName}
                    type="button"
                    onClick={() => setSelectedForkName(fork.fullName)}
                    className={cn(
                      "w-full border-b px-4 py-3 text-left transition-colors last:border-b-0",
                      active
                        ? "border-l-2 border-l-primary border-r-0 border-t-0 border-b border-border bg-primary/10"
                        : "border-l-2 border-l-transparent border-r-0 border-t-0 border-b border-border bg-card hover:bg-muted/70",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{fork.fullName}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={fork.maintenance === "active" ? "success" : "muted"}>{fork.maintenance}</Badge>
                          <Badge variant="muted">{fork.changeMagnitude}</Badge>
                        </div>
                      </div>
                      {active ? <span className="text-xs font-medium text-primary">Selected</span> : null}
                    </div>
                    <p className="mt-2 max-w-[100ch] text-sm leading-6 text-muted-foreground">{fork.summary}</p>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <aside className="rounded-md border border-border bg-card p-6">
        {selectedFork ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Fork comparison</div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{selectedFork.fullName}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedFork.maintenance === "active" ? "success" : "muted"}>{selectedFork.maintenance}</Badge>
                  <Badge variant="muted">{selectedFork.changeMagnitude}</Badge>
                </div>
                <p className="text-[15px] leading-7 text-muted-foreground">{selectedFork.summary}</p>
              </div>
            </div>

            <section className="space-y-4 rounded-md border border-border bg-muted/70 p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Likely purpose</div>
              <p className="text-sm leading-7 text-muted-foreground">{selectedFork.likelyPurpose}</p>
              <div className="pt-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Best for</div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedFork.bestFor}</p>
              </div>
            </section>

            <SectionList title="Additional features" items={selectedFork.additionalFeatures} />
            <SectionList title="Missing features" items={selectedFork.missingFeatures} />
            <SectionList title="Strengths" items={selectedFork.strengths} />
            <SectionList title="Risks" items={selectedFork.risks} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No fork details available.</div>
        )}
      </aside>
    </section>
  )
}
