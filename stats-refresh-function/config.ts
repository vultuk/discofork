import {
  DISCOFORK_ADMIN_TOKEN_ENV_VAR,
  STATS_REFRESH_ADMIN_TOKEN_ENV_VARS,
  resolveStatsRefreshAdminToken,
} from "../web/src/lib/server/admin-token-config.ts"

export const DEFAULT_STATS_REFRESH_URL = "https://discofork.ai/api/stats/refresh"
export const STATS_REFRESH_FUNCTION_USER_AGENT = "discofork-stats-refresh-function"

export type StatsRefreshFunctionConfig = {
  targetUrl: string
  adminToken: string | null
  adminTokenSource: (typeof STATS_REFRESH_ADMIN_TOKEN_ENV_VARS)[number] | null
  adminTokenWarnings: string[]
  adminTokenError: string | null
}

export type FetchLike = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

export type StatsRefreshResult = {
  ok: boolean
  status: number
  targetUrl: string
  adminTokenSource: StatsRefreshFunctionConfig["adminTokenSource"]
  adminTokenWarnings: string[]
  payload: unknown
}

function resolveStatsRefreshUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredUrl = env.STATS_REFRESH_URL?.trim()
  return configuredUrl ? configuredUrl : DEFAULT_STATS_REFRESH_URL
}

export function resolveStatsRefreshFunctionConfig(
  env: NodeJS.ProcessEnv = process.env,
): StatsRefreshFunctionConfig {
  const tokenConfig = resolveStatsRefreshAdminToken(env)

  return {
    targetUrl: resolveStatsRefreshUrl(env),
    adminToken: tokenConfig.token,
    adminTokenSource: tokenConfig.sourceEnvVar,
    adminTokenWarnings: tokenConfig.warnings,
    adminTokenError: tokenConfig.error,
  }
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()

  try {
    return text ? JSON.parse(text) : null
  } catch {
    return { raw: text }
  }
}

export async function triggerStatsRefresh(
  config: StatsRefreshFunctionConfig = resolveStatsRefreshFunctionConfig(),
  fetchImpl: FetchLike = fetch,
): Promise<StatsRefreshResult> {
  if (!config.adminToken) {
    return {
      ok: false,
      status: 503,
      targetUrl: config.targetUrl,
      adminTokenSource: config.adminTokenSource,
      adminTokenWarnings: config.adminTokenWarnings,
      payload: {
        error: config.adminTokenError,
        acceptedEnvVars: [...STATS_REFRESH_ADMIN_TOKEN_ENV_VARS],
        sharedWebEnvVar: DISCOFORK_ADMIN_TOKEN_ENV_VAR,
      },
    }
  }

  const response = await fetchImpl(config.targetUrl, {
    method: "GET",
    headers: {
      authorization: `Bearer ${config.adminToken}`,
      "user-agent": STATS_REFRESH_FUNCTION_USER_AGENT,
    },
  })

  return {
    ok: response.ok,
    status: response.status,
    targetUrl: config.targetUrl,
    adminTokenSource: config.adminTokenSource,
    adminTokenWarnings: config.adminTokenWarnings,
    payload: await parseResponsePayload(response),
  }
}

export function getStatsRefreshHealth(
  config: StatsRefreshFunctionConfig = resolveStatsRefreshFunctionConfig(),
) {
  return {
    status: config.adminToken ? "ok" : "degraded",
    targetUrl: config.targetUrl,
    adminToken: {
      configured: Boolean(config.adminToken),
      sourceEnvVar: config.adminTokenSource,
      acceptedEnvVars: [...STATS_REFRESH_ADMIN_TOKEN_ENV_VARS],
      warnings: config.adminTokenWarnings,
      error: config.adminTokenError,
    },
  }
}
