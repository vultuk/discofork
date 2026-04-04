import { describe, expect, mock, test } from "bun:test"

import {
  DISCOFORK_ADMIN_TOKEN_ENV_VAR,
  LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR,
} from "../web/src/lib/server/admin-token-config.ts"
import {
  DEFAULT_STATS_REFRESH_URL,
  STATS_REFRESH_FUNCTION_USER_AGENT,
  getStatsRefreshHealth,
  resolveStatsRefreshFunctionConfig,
  triggerStatsRefresh,
} from "../stats-refresh-function/config.ts"

describe("resolveStatsRefreshFunctionConfig", () => {
  test("prefers the shared admin token contract", () => {
    expect(
      resolveStatsRefreshFunctionConfig({
        [DISCOFORK_ADMIN_TOKEN_ENV_VAR]: "shared-secret",
        STATS_REFRESH_URL: " https://example.com/refresh ",
      }),
    ).toEqual({
      targetUrl: "https://example.com/refresh",
      adminToken: "shared-secret",
      adminTokenSource: DISCOFORK_ADMIN_TOKEN_ENV_VAR,
      adminTokenWarnings: [],
      adminTokenError: null,
    })
  })

  test("falls back to the legacy scheduled-refresh env var with a migration warning", () => {
    const config = resolveStatsRefreshFunctionConfig({
      [LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR]: "legacy-secret",
    })

    expect(config.targetUrl).toBe(DEFAULT_STATS_REFRESH_URL)
    expect(config.adminToken).toBe("legacy-secret")
    expect(config.adminTokenSource).toBe(LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR)
    expect(config.adminTokenWarnings).toEqual([
      `Using legacy ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR}. Set ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} on both the web service and scheduled refresh function to migrate to the shared contract.`,
    ])
    expect(config.adminTokenError).toBeNull()
  })

  test("prefers the shared env var when both tokens are set and reports drift", () => {
    const config = resolveStatsRefreshFunctionConfig({
      [DISCOFORK_ADMIN_TOKEN_ENV_VAR]: "shared-secret",
      [LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR]: "stale-secret",
    })

    expect(config.adminToken).toBe("shared-secret")
    expect(config.adminTokenSource).toBe(DISCOFORK_ADMIN_TOKEN_ENV_VAR)
    expect(config.adminTokenWarnings).toEqual([
      `${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} does not match ${DISCOFORK_ADMIN_TOKEN_ENV_VAR}; ignoring ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} and using ${DISCOFORK_ADMIN_TOKEN_ENV_VAR}.`,
    ])
  })

  test("reports a degraded configuration when no supported token env var is set", () => {
    const health = getStatsRefreshHealth(resolveStatsRefreshFunctionConfig({}))

    expect(health).toEqual({
      status: "degraded",
      targetUrl: DEFAULT_STATS_REFRESH_URL,
      adminToken: {
        configured: false,
        sourceEnvVar: null,
        acceptedEnvVars: [
          DISCOFORK_ADMIN_TOKEN_ENV_VAR,
          LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR,
        ],
        warnings: [],
        error:
          `Scheduled refresh admin token is not configured. Set ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} on both the web service and scheduled refresh function, or temporarily use ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} on the scheduled refresh function for backward compatibility.`,
      },
    })
  })
})

describe("triggerStatsRefresh", () => {
  test("fails locally without calling upstream when no token is configured", async () => {
    const fetchMock = mock(async () => new Response("unexpected", { status: 200 }))

    const result = await triggerStatsRefresh(resolveStatsRefreshFunctionConfig({}), fetchMock)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: false,
      status: 503,
      targetUrl: DEFAULT_STATS_REFRESH_URL,
      adminTokenSource: null,
      adminTokenWarnings: [],
      payload: {
        error:
          `Scheduled refresh admin token is not configured. Set ${DISCOFORK_ADMIN_TOKEN_ENV_VAR} on both the web service and scheduled refresh function, or temporarily use ${LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR} on the scheduled refresh function for backward compatibility.`,
        acceptedEnvVars: [
          DISCOFORK_ADMIN_TOKEN_ENV_VAR,
          LEGACY_STATS_REFRESH_ADMIN_TOKEN_ENV_VAR,
        ],
        sharedWebEnvVar: DISCOFORK_ADMIN_TOKEN_ENV_VAR,
      },
    })
  })

  test("forwards the resolved bearer token upstream", async () => {
    const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
      expect(url).toBe("https://example.com/refresh")
      expect(init).toEqual({
        method: "GET",
        headers: {
          authorization: "Bearer shared-secret",
          "user-agent": STATS_REFRESH_FUNCTION_USER_AGENT,
        },
      })

      return new Response(JSON.stringify({ refreshed: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })
    })

    const result = await triggerStatsRefresh(
      resolveStatsRefreshFunctionConfig({
        [DISCOFORK_ADMIN_TOKEN_ENV_VAR]: "shared-secret",
        STATS_REFRESH_URL: "https://example.com/refresh",
      }),
      fetchMock,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      status: 200,
      targetUrl: "https://example.com/refresh",
      adminTokenSource: DISCOFORK_ADMIN_TOKEN_ENV_VAR,
      adminTokenWarnings: [],
      payload: {
        refreshed: true,
      },
    })
  })
})
