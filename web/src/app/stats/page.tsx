import type { Metadata } from "next"
import type { ReactNode } from "react"
import { ArrowRight, CircleDollarSign, Clock3, Database, GitFork, LoaderCircle, Star } from "lucide-react"

import { RequeueFailedButton } from "@/components/requeue-failed-button"
import { RepoShell } from "@/components/repo-shell"
import { queueConfigured } from "@/lib/server/queue"
import {
  getCachedStatsSnapshot,
  toRepoStatusSeries,
  type GitHubRateLimitBucket,
  type RepoDailyStatsPoint,
  type RepoStatusPoint,
} from "@/lib/server/stats"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Stats · Discofork",
  description: "Operational stats for the Discofork backend.",
}

export const dynamic = "force-dynamic"

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value)
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%"
  }

  return `${Math.round(value)}%`
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatUtcTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown"
  }

  return new Date(value).toISOString().slice(0, 16).replace("T", " ") + " UTC"
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        </div>
        {icon}
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{hint}</p>
    </div>
  )
}

function MultiBarChart({
  title,
  subtitle,
  series,
}: {
  title: string
  subtitle: string
  series: RepoDailyStatsPoint[]
}) {
  const maxValue = Math.max(1, ...series.flatMap((point) => [point.added, point.cached]))
  const width = 720
  const height = 240
  const padding = { top: 16, right: 16, bottom: 28, left: 52 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const xStep = series.length > 1 ? innerWidth / (series.length - 1) : 0
  const toX = (index: number) => padding.left + index * xStep
  const toY = (value: number) => padding.top + innerHeight - (value / maxValue) * innerHeight
  const buildPath = (selector: (point: RepoDailyStatsPoint) => number) =>
    series
      .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(selector(point))}`)
      .join(" ")
  const addedPath = buildPath((point) => point.added)
  const cachedPath = buildPath((point) => point.cached)
  const tickIndexes = Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])).filter((index) => index >= 0)
  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    y: padding.top + innerHeight - innerHeight * ratio,
    value: Math.round(maxValue * ratio),
  }))

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Repo activity</div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-6 flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
          Added
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Cached
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/70 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label={title}>
          {yAxisTicks.map((tick) => {
            return (
              <g key={tick.ratio}>
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={width - padding.right}
                  y2={tick.y}
                  stroke="hsl(var(--border))"
                  strokeDasharray="4 6"
                />
                <text
                  x={padding.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="hsl(var(--muted-foreground))"
                >
                  {tick.value.toLocaleString()}
                </text>
              </g>
            )
          })}
          <path d={addedPath} fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={cachedPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {series.map((point, index) => (
            <g key={point.date}>
              <circle cx={toX(index)} cy={toY(point.added)} r="3.5" fill="hsl(var(--foreground))" />
              <circle cx={toX(index)} cy={toY(point.cached)} r="3.5" fill="hsl(var(--primary))" />
            </g>
          ))}
        </svg>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          {tickIndexes.map((index) => (
            <span key={series[index]?.date}>{series[index] ? formatDateLabel(series[index]!.date) : ""}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function HorizontalBars({
  title,
  subtitle,
  points,
}: {
  title: string
  subtitle: string
  points: RepoStatusPoint[]
}) {
  const maxValue = Math.max(1, ...points.map((point) => point.value))

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Current mix</div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-6 space-y-4">
        {points.map((point) => (
          <div key={point.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-foreground">{point.label}</span>
              <span className="text-muted-foreground">{point.value.toLocaleString()}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full",
                  point.label === "Cached"
                    ? "bg-emerald-500"
                    : point.label === "Failed"
                      ? "bg-amber-500"
                      : point.label === "Processing"
                        ? "bg-blue-500"
                        : "bg-foreground",
                )}
                style={{ width: `${(point.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function GitHubRateLimitSection({
  core,
  search,
  graphql,
  pausedUntil,
  fetchedAt,
}: {
  core: GitHubRateLimitBucket
  search: GitHubRateLimitBucket
  graphql: GitHubRateLimitBucket
  pausedUntil: string | null
  fetchedAt: string
}) {
  const buckets = [
    { label: "Core", bucket: core, tone: "bg-foreground" },
    { label: "Search", bucket: search, tone: "bg-sky-500" },
    { label: "GraphQL", bucket: graphql, tone: "bg-emerald-500" },
  ]

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">GitHub API</div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Shared rate limit status</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Workers use the core quota to decide whether to keep issuing GitHub API requests or wait for the reset window.
          </p>
        </div>
        <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Snapshot {formatUtcTimestamp(fetchedAt)}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {buckets.map(({ label, bucket, tone }) => {
          const percentRemaining = bucket.limit > 0 ? (bucket.remaining / bucket.limit) * 100 : 0
          return (
            <div key={label} className="rounded-xl border border-border bg-muted/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
                <span className={cn("h-2.5 w-2.5 rounded-full", tone)} />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {bucket.remaining.toLocaleString()}
                <span className="ml-1 text-base font-medium text-muted-foreground">/ {bucket.limit.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {formatPercent(percentRemaining)} remaining. Resets {formatUtcTimestamp(bucket.resetAt)}.
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
        <span>{pausedUntil ? `Workers paused until ${formatUtcTimestamp(pausedUntil)}.` : "Workers are clear to continue calling GitHub."}</span>
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          Uses the shared Redis snapshot plus GitHub reset time.
        </span>
      </div>
    </section>
  )
}

export default async function StatsPage() {
  const snapshot = await getCachedStatsSnapshot()
  const queueEnabled = queueConfigured()

  if (!snapshot) {
    return (
      <RepoShell
        eyebrow="Operations stats"
        title="Discofork backend health and throughput in one place."
        description="This dashboard reads from the Redis stats snapshot only."
        compact
      >
        <section className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
          Stats are not available yet. Populate the Redis snapshot first, then reload this page.
        </section>
      </RepoShell>
    )
  }

  const { repoOverview, repoDailyStats, openAIStats: openAIStatsResult, githubRateLimit } = snapshot
  const statusSeries = toRepoStatusSeries(repoOverview)
  const cachedCoverage = repoOverview.total === 0 ? 0 : (repoOverview.cached / repoOverview.total) * 100

  return (
    <RepoShell
      eyebrow="Operations stats"
      title="Discofork backend health and throughput in one place."
      description="This dashboard helps operators decide whether the queue is healthy and how quickly new repos are landing and being cached."
      compact
    >
      <section className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Repos Added"
            value={repoOverview.total.toLocaleString()}
            hint="All repository records currently stored by the backend."
            icon={<Database className="h-5 w-5 text-muted-foreground" />}
          />
          <KpiCard
            label="In Queue"
            value={repoOverview.pending.toLocaleString()}
            hint={`${repoOverview.queued.toLocaleString()} queued and ${repoOverview.processing.toLocaleString()} currently processing.`}
            icon={<LoaderCircle className="h-5 w-5 text-muted-foreground" />}
          />
          <KpiCard
            label="Cached"
            value={repoOverview.cached.toLocaleString()}
            hint={`${formatPercent(cachedCoverage)} of indexed repos are ready to open as cached briefs.`}
            icon={<Star className="h-5 w-5 text-muted-foreground" />}
          />
          <KpiCard
            label="Failed"
            value={repoOverview.failed.toLocaleString()}
            hint={`${repoOverview.failed.toLocaleString()} failed`}
            icon={<ArrowRight className="h-5 w-5 rotate-45 text-muted-foreground" />}
          />
        </div>

        {openAIStatsResult.available ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Input Tokens"
              value={formatCompact(openAIStatsResult.data.totalInputTokens)}
              hint="Total input tokens across the full tracked lifetime."
              icon={<ArrowRight className="h-5 w-5 text-muted-foreground" />}
            />
            <KpiCard
              label="Output Tokens"
              value={formatCompact(openAIStatsResult.data.totalOutputTokens)}
              hint="Total output tokens across the full tracked lifetime."
              icon={<ArrowRight className="h-5 w-5 rotate-180 text-muted-foreground" />}
            />
            <KpiCard
              label="Requests"
              value={formatCompact(openAIStatsResult.data.totalRequests)}
              hint="Model requests reported across the full tracked lifetime."
              icon={<GitFork className="h-5 w-5 text-muted-foreground" />}
            />
            <KpiCard
              label="Cost"
              value={formatCurrency(openAIStatsResult.data.totalCost, openAIStatsResult.data.currency)}
              hint="Cost aggregated from the organization costs endpoint across the full tracked lifetime."
              icon={<CircleDollarSign className="h-5 w-5 text-muted-foreground" />}
            />
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <MultiBarChart
            title="Daily repo intake versus cached completions"
            subtitle="A 30-day trend of how many repos entered Discofork each day and how many ended the day cached and ready."
            series={repoDailyStats}
          />
          <HorizontalBars
            title="Current repository status mix"
            subtitle="A quick scan of whether the backend is mostly healthy, actively processing, or building up failed work."
            points={statusSeries}
          />
        </div>

        {githubRateLimit.available ? (
          <GitHubRateLimitSection
            core={githubRateLimit.data.core}
            search={githubRateLimit.data.search}
            graphql={githubRateLimit.data.graphql}
            pausedUntil={githubRateLimit.data.pausedUntil}
            fetchedAt={githubRateLimit.data.fetchedAt}
          />
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
          <p className="text-xs text-muted-foreground">Snapshot updated {new Date(snapshot.generatedAt).toISOString().slice(0, 16).replace("T", " ")} UTC</p>
          <RequeueFailedButton failedCount={repoOverview.failed} queueEnabled={queueEnabled} />
        </div>
      </section>
    </RepoShell>
  )
}
