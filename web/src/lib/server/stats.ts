import { query } from "./database"
import { getRedisClient, queueConfigured } from "./queue"

export type RepoOverviewStats = {
  total: number
  queued: number
  processing: number
  pending: number
  cached: number
  failed: number
}

export type RepoDailyStatsPoint = {
  date: string
  added: number
  cached: number
}

export type RepoStatusPoint = {
  label: "Queued" | "Processing" | "Cached" | "Failed"
  value: number
}

export type OpenAIUsagePoint = {
  date: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  requests: number
}

export type OpenAICostPoint = {
  date: string
  amount: number
  currency: string
}

export type OpenAIStats = {
  scopeLabel: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalRequests: number
  totalCost: number
  currency: string
  usageSeries: OpenAIUsagePoint[]
  costSeries: OpenAICostPoint[]
}

export type OpenAIStatsResult =
  | { available: false; reason: string }
  | {
      available: true
      data: OpenAIStats
    }

export type StatsSnapshot = {
  generatedAt: string
  repoOverview: RepoOverviewStats
  repoDailyStats: RepoDailyStatsPoint[]
  openAIStats: OpenAIStatsResult
}

const STATS_SNAPSHOT_CACHE_KEY = "stats:snapshot:v1"

export async function getRepoOverviewStats(): Promise<RepoOverviewStats> {
  const rows = await query<RepoOverviewStats>(
    `select
      count(*)::int as total,
      count(*) filter (where status = 'queued')::int as queued,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status in ('queued', 'processing'))::int as pending,
      count(*) filter (where status = 'ready')::int as cached,
      count(*) filter (where status = 'failed')::int as failed
    from repo_reports`,
  )

  return rows[0] ?? {
    total: 0,
    queued: 0,
    processing: 0,
    pending: 0,
    cached: 0,
    failed: 0,
  }
}

export async function getRepoDailyStats(days: number): Promise<RepoDailyStatsPoint[]> {
  const rows = await query<{
    date: string
    added: number
    cached: number
  }>(
    `with dates as (
      select generate_series(
        current_date - ($1::int - 1) * interval '1 day',
        current_date,
        interval '1 day'
      )::date as day
    ),
    added as (
      select date_trunc('day', created_at)::date as day, count(*)::int as count
      from repo_reports
      where created_at >= current_date - ($1::int - 1) * interval '1 day'
      group by 1
    ),
    cached as (
      select date_trunc('day', cached_at)::date as day, count(*)::int as count
      from repo_reports
      where cached_at is not null
        and cached_at >= current_date - ($1::int - 1) * interval '1 day'
      group by 1
    )
    select
      to_char(dates.day, 'YYYY-MM-DD') as date,
      coalesce(added.count, 0)::int as added,
      coalesce(cached.count, 0)::int as cached
    from dates
    left join added on added.day = dates.day
    left join cached on cached.day = dates.day
    order by dates.day asc`,
    [days],
  )

  return rows
}

export function toRepoStatusSeries(stats: RepoOverviewStats): RepoStatusPoint[] {
  return [
    { label: "Queued", value: stats.queued },
    { label: "Processing", value: stats.processing },
    { label: "Cached", value: stats.cached },
    { label: "Failed", value: stats.failed },
  ]
}

type OpenAIApiConfig =
  | { enabled: false; reason: string }
  | {
      enabled: true
      adminKey: string
      apiKeyId: string | null
      projectId: string | null
      scopeLabel: string
    }

function getOpenAIConfig(): OpenAIApiConfig {
  const adminKey = process.env.OPENAI_ADMIN_KEY
  if (!adminKey) {
    return {
      enabled: false,
      reason: "Set OPENAI_ADMIN_KEY to load OpenAI usage and costs.",
    }
  }

  const apiKeyId = process.env.OPENAI_USAGE_API_KEY_ID ?? null
  const projectId = process.env.OPENAI_PROJECT_ID ?? null
  const scopeLabel = apiKeyId
    ? `API key ${apiKeyId}`
    : projectId
      ? `Project ${projectId}`
      : "Organization total"

  return {
    enabled: true,
    adminKey,
    apiKeyId,
    projectId,
    scopeLabel,
  }
}

function utcDayStartUnixDaysAgo(days: number): number {
  const now = new Date()
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days) / 1000)
}

function utcDayStartUnixToday(): number {
  return utcDayStartUnixDaysAgo(0)
}

function utcDayStartUnix(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000)
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000)
}

function toFiniteNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function toDateLabel(unixSeconds: unknown): string {
  return new Date(toFiniteNumber(unixSeconds) * 1000).toISOString().slice(0, 10)
}

function getOpenAIStatsCacheKey(config: Extract<OpenAIApiConfig, { enabled: true }>): string {
  return ["stats", "openai", "v4", config.apiKeyId ?? "all-keys", config.projectId ?? "all-projects"].join(":")
}

function getOpenAIStatsCacheTtlSeconds(): number {
  const configured = Number(process.env.OPENAI_STATS_CACHE_TTL_SECONDS ?? "900")
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 900
}

async function readCachedOpenAIStats(cacheKey: string): Promise<OpenAIStatsResult | null> {
  if (!queueConfigured()) {
    return null
  }

  try {
    const redis = await getRedisClient()
    const raw = await redis.get(cacheKey)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as OpenAIStatsResult
  } catch {
    return null
  }
}

async function writeCachedOpenAIStats(cacheKey: string, value: OpenAIStatsResult): Promise<void> {
  if (!queueConfigured()) {
    return
  }

  try {
    const redis = await getRedisClient()
    await redis.set(cacheKey, JSON.stringify(value), {
      EX: getOpenAIStatsCacheTtlSeconds(),
    })
  } catch {
    // Stats should still render even if cache writes fail.
  }
}

export async function getCachedStatsSnapshot(): Promise<StatsSnapshot | null> {
  if (!queueConfigured()) {
    return null
  }

  try {
    const redis = await getRedisClient()
    const raw = await redis.get(STATS_SNAPSHOT_CACHE_KEY)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as StatsSnapshot
  } catch {
    return null
  }
}

async function writeStatsSnapshot(snapshot: StatsSnapshot): Promise<void> {
  if (!queueConfigured()) {
    throw new Error("REDIS_URL is required.")
  }

  const redis = await getRedisClient()
  await redis.set(STATS_SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot))
}

async function fetchOpenAI<T>(path: string, config: Extract<OpenAIApiConfig, { enabled: true }>): Promise<T> {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${config.adminKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`OpenAI API request failed with status ${response.status}.`)
  }

  return (await response.json()) as T
}

type OpenAIUsageResponse = {
  data?: Array<{
    start_time: number | string
    results?: Array<{
      input_tokens?: number | string
      output_tokens?: number | string
      input_cached_tokens?: number | string
      num_model_requests?: number | string
    }>
  }>
}

type OpenAICostResponse = {
  data?: Array<{
    start_time: number | string
    results?: Array<{
      amount?: {
        value?: number | string
        currency?: string
      } | null
    }>
  }>
}

type OpenAIProjectResponse = {
  id: string
  created_at?: number | string
}

function daysBetweenInclusive(startUnixSeconds: number, endUnixSeconds: number): number {
  const diff = Math.max(0, endUnixSeconds - startUnixSeconds)
  return Math.floor(diff / (24 * 60 * 60)) + 1
}

async function getOpenAIStatsStartTime(config: Extract<OpenAIApiConfig, { enabled: true }>): Promise<number> {
  if (config.projectId) {
    const project = await fetchOpenAI<OpenAIProjectResponse>(`/organization/projects/${config.projectId}`, config)
    if (project.created_at !== undefined) {
      return utcDayStartUnix(toFiniteNumber(project.created_at))
    }
  }

  return Math.floor(Date.UTC(2020, 0, 1) / 1000)
}

export async function getOpenAIStats(): Promise<OpenAIStatsResult> {
  const config = getOpenAIConfig()
  if (!config.enabled) {
    return {
      available: false,
      reason: config.reason,
    }
  }

  const cacheKey = getOpenAIStatsCacheKey(config)
  const cached = await readCachedOpenAIStats(cacheKey)
  if (cached) {
    return cached
  }

  const startTime = await getOpenAIStatsStartTime(config)
  const nowUnix = Math.floor(Date.now() / 1000)
  const todayStart = utcDayStartUnixToday()
  const bucketCount = daysBetweenInclusive(startTime, todayStart)

  const usageParams = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(nowUnix),
    bucket_width: "1d",
    limit: String(bucketCount),
  })
  const costParams = new URLSearchParams({
    start_time: String(startTime),
    end_time: String(nowUnix),
    bucket_width: "1d",
    limit: String(bucketCount),
  })

  if (config.apiKeyId) {
    usageParams.append("api_key_ids", config.apiKeyId)
  }

  if (config.projectId) {
    usageParams.append("project_ids", config.projectId)
    costParams.append("project_ids", config.projectId)
  }

  try {
    const [usageResponse, costResponse] = await Promise.all([
      fetchOpenAI<OpenAIUsageResponse>(`/organization/usage/completions?${usageParams.toString()}`, config),
      fetchOpenAI<OpenAICostResponse>(`/organization/costs?${costParams.toString()}`, config),
    ])

    const usageSeries = (usageResponse.data ?? []).map((bucket) => {
      const aggregate = (bucket.results ?? []).reduce(
        (totals, result) => ({
          inputTokens: totals.inputTokens + toFiniteNumber(result.input_tokens),
          outputTokens: totals.outputTokens + toFiniteNumber(result.output_tokens),
          cachedTokens: totals.cachedTokens + toFiniteNumber(result.input_cached_tokens),
          requests: totals.requests + toFiniteNumber(result.num_model_requests),
        }),
        {
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          requests: 0,
        },
      )

      return {
        date: toDateLabel(bucket.start_time),
        ...aggregate,
      }
    })

    const costSeries = (costResponse.data ?? []).map((bucket) => {
      const aggregate = (bucket.results ?? []).reduce(
        (totals, result) => ({
          amount: totals.amount + toFiniteNumber(result.amount?.value),
          currency: result.amount?.currency ?? totals.currency,
        }),
        {
          amount: 0,
          currency: "usd",
        },
      )

      return {
        date: toDateLabel(bucket.start_time),
        amount: aggregate.amount,
        currency: aggregate.currency,
      }
    })

    const result: OpenAIStatsResult = {
      available: true,
      data: {
        scopeLabel: config.scopeLabel,
        totalInputTokens: usageSeries.reduce((sum, point) => sum + point.inputTokens, 0),
        totalOutputTokens: usageSeries.reduce((sum, point) => sum + point.outputTokens, 0),
        totalCachedTokens: usageSeries.reduce((sum, point) => sum + point.cachedTokens, 0),
        totalRequests: usageSeries.reduce((sum, point) => sum + point.requests, 0),
        totalCost: costSeries.reduce((sum, point) => sum + point.amount, 0),
        currency: costSeries.find((point) => point.currency)?.currency ?? "usd",
        usageSeries,
        costSeries,
      },
    }
    await writeCachedOpenAIStats(cacheKey, result)
    return result
  } catch (error) {
    const result: OpenAIStatsResult = {
      available: false,
      reason: error instanceof Error ? error.message : "Could not load OpenAI usage data.",
    }
    await writeCachedOpenAIStats(cacheKey, result)
    return result
  }
}

export async function refreshStatsSnapshot(): Promise<StatsSnapshot> {
  const [repoOverview, repoDailyStats, openAIStats] = await Promise.all([
    getRepoOverviewStats(),
    getRepoDailyStats(30),
    getOpenAIStats(),
  ])

  const snapshot: StatsSnapshot = {
    generatedAt: new Date().toISOString(),
    repoOverview,
    repoDailyStats,
    openAIStats,
  }

  await writeStatsSnapshot(snapshot)
  return snapshot
}
