export const DISCOFORK_ADMIN_TOKEN_ENV_VAR = "DISCOFORK_ADMIN_TOKEN"
export const LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR = "STATS_REFRESH_ADMIN_TOKEN"
export const STATS_REFRESH_ADMIN_TOKEN_ENV_VARS = [
  DISCOFORK_ADMIN_TOKEN_ENV_VAR,
  LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR,
] as const
export const DISCOFORK_ADMIN_TOKEN_HEADER = "x-discofork-admin-token"

export type AdminTokenEnvVar = (typeof STATS_REFRESH_ADMIN_TOKEN_ENV_VARS)[number]

export type StatsRefreshAdminTokenConfig = {
  token: string | null
  sourceEnvVar: AdminTokenEnvVar | null
  warnings: string[]
  error: string | null
}

export function normalizeAdminToken(value: string | null | undefined): string | null {
  const token = value?.trim()
  return token ? token : null
}

export function getConfiguredAdminToken(env: NodeJS.ProcessEnv = process.env): string | null {
  return normalizeAdminToken(env[DISCOFORK_ADMIN_TOKEN_ENV_VAR])
}

export function resolveStatsRefreshAdminToken(
  env: NodeJS.ProcessEnv = process.env,
): StatsRefreshAdminTokenConfig {
  const sharedToken = getConfiguredAdminToken(env)
  const legacyToken = normalizeAdminToken(env[LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR])

  if (sharedToken) {
    const warnings = legacyToken
      ? legacyToken === sharedToken
        ? [
            `${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} is also set; ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} remains the shared contract.`,
          ]
        : [
            `${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} does not match ${DISCOFORK_ADMIN_TOKEN_ENV_VAR}; ignoring ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} and using ${DISCOFORK_ADMIN_TOKEN_ENV_VAR}.`,
          ]
      : []

    return {
      token: sharedToken,
      sourceEnvVar: DISCOFORK_ADMIN_TOKEN_ENV_VAR,
      warnings,
      error: null,
    }
  }

  if (legacyToken) {
    return {
      token: legacyToken,
      sourceEnvVar: LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR,
      warnings: [
        `Using legacy ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR}. Set ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} on both the web service and scheduled refresh function to migrate to the shared contract.`,
      ],
      error: null,
    }
  }

  return {
    token: null,
    sourceEnvVar: null,
    warnings: [],
    error:
      `Scheduled refresh admin token is not configured. Set ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} on both the web service and scheduled refresh function, or temporarily use ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} on the scheduled refresh function for backward compatibility.`,
  }
}
