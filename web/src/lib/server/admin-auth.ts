import { timingSafeEqual } from "node:crypto"

import {
  DISCOFORK_ADMIN_TOKEN_ENV_VAR,
  DISCOFORK_ADMIN_TOKEN_HEADER,
  getConfiguredAdminToken,
  normalizeAdminToken,
} from "./admin-token-config"

export { DISCOFORK_ADMIN_TOKEN_ENV_VAR, DISCOFORK_ADMIN_TOKEN_HEADER }

export type AdminAuthorizationResult =
  | { ok: true }
  | {
      ok: false
      error: string
      status: 401 | 403 | 503
    }

function adminTokensMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

export function getPresentedAdminToken(headers: Headers): string | null {
  const authorization = normalizeAdminToken(headers.get("authorization"))
  if (authorization) {
    const [scheme, ...rest] = authorization.split(/\s+/)
    if (scheme?.toLowerCase() === "bearer") {
      return normalizeAdminToken(rest.join(" "))
    }
  }

  return normalizeAdminToken(headers.get(DISCOFORK_ADMIN_TOKEN_HEADER))
}

export function authorizeAdminRequest(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): AdminAuthorizationResult {
  const configuredToken = getConfiguredAdminToken(env)
  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error: `${DISCOFORK_ADMIN_TOKEN_ENV_VAR} is not configured.`,
    }
  }

  const presentedToken = getPresentedAdminToken(headers)
  if (!presentedToken) {
    return {
      ok: false,
      status: 401,
      error: "Missing admin credentials.",
    }
  }

  if (!adminTokensMatch(configuredToken, presentedToken)) {
    return {
      ok: false,
      status: 403,
      error: "Invalid admin credentials.",
    }
  }

  return { ok: true }
}

export function buildAdminAuthorizationHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const token = getConfiguredAdminToken(env)

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}
