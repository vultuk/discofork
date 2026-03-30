import { query } from "./database"

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
      select created_at::date as day, count(*)::int as count
      from repo_reports
      where created_at::date >= current_date - ($1::int - 1) * interval '1 day'
      group by 1
    ),
    cached as (
      select cached_at::date as day, count(*)::int as count
      from repo_reports
      where cached_at is not null
        and cached_at::date >= current_date - ($1::int - 1) * interval '1 day'
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

function unixDaysAgo(days: number): number {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
}

function toDateLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
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
    start_time: number
    results?: Array<{
      input_tokens?: number
      output_tokens?: number
      input_cached_tokens?: number
      num_model_requests?: number
    }>
  }>
}

type OpenAICostResponse = {
  data?: Array<{
    start_time: number
    results?: Array<{
      amount?: {
        value?: number
        currency?: string
      } | null
    }>
  }>
}

export async function getOpenAIStats(days: number): Promise<
  | { available: false; reason: string }
  | {
      available: true
      data: OpenAIStats
    }
> {
  const config = getOpenAIConfig()
  if (!config.enabled) {
    return {
      available: false,
      reason: config.reason,
    }
  }

  const usageParams = new URLSearchParams({
    start_time: String(unixDaysAgo(days)),
    bucket_width: "1d",
    limit: String(days),
  })
  const costParams = new URLSearchParams({
    start_time: String(unixDaysAgo(days)),
    bucket_width: "1d",
    limit: String(days),
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
          inputTokens: totals.inputTokens + (result.input_tokens ?? 0),
          outputTokens: totals.outputTokens + (result.output_tokens ?? 0),
          cachedTokens: totals.cachedTokens + (result.input_cached_tokens ?? 0),
          requests: totals.requests + (result.num_model_requests ?? 0),
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
          amount: totals.amount + (result.amount?.value ?? 0),
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

    return {
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
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Could not load OpenAI usage data.",
    }
  }
}
