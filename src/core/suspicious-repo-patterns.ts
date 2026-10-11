/**
 * Shared suspicious repository pattern definitions.
 *
 * Both the worker (src/services/github.ts) and the web app
 * (web/src/lib/repository-route-validation.ts) import these lists
 * as the single source of truth for known web-probe patterns.
 *
 * When adding a new suspicious pattern, edit this file only.
 */

export const SUSPICIOUS_OWNER_NAMES: readonly string[] = [".well-known"]

/**
 * Suspicious owner/repo pairs that match known web-probe routes.
 * Keep these tightly scoped to production-style path probes so
 * legitimate dotted repo names like github/.github and vercel/next.js
 * are not flagged.
 */
export const SUSPICIOUS_ROUTE_PAIRS: readonly string[] = [
  "admin/.env",
  "wp-admin/admin-ajax.php",
]

const suspiciousOwnerNameSet = new Set<string>(SUSPICIOUS_OWNER_NAMES)
const suspiciousRoutePairSet = new Set<string>(SUSPICIOUS_ROUTE_PAIRS)

/**
 * Core suspicious-input validation shared by worker and web layers.
 * Returns a human-readable reason string when the input is suspicious,
 * or null when the input passes all checks.
 *
 * This function checks: hidden-path prefix, URL-encoded path characters,
 * path traversal markers, known suspicious owner names, and known
 * suspicious owner/repo pairs.
 *
 * Callers that also need path-separator or SQL-predicate checks should
 * layer those on top of this function.
 */
export function describeSuspiciousRepoInputCore(owner: string, repo: string): string | null {
  const normalizedOwner = owner.toLowerCase()
  const normalizedRepo = repo.toLowerCase()
  const normalizedFullName = `${normalizedOwner}/${normalizedRepo}`

  if (owner.startsWith(".")) {
    return "Owner segment starts with a hidden-path prefix."
  }

  if (owner.includes("%") || repo.includes("%")) {
    return "Owner or repository name still contains URL-encoded path characters."
  }

  if (owner.includes("..") || repo.includes("..")) {
    return "Owner or repository name contains path traversal markers."
  }

  if (suspiciousOwnerNameSet.has(normalizedOwner)) {
    return "Owner segment matches a known web probe path."
  }

  if (suspiciousRoutePairSet.has(normalizedFullName)) {
    return "Owner and repository pair matches a known web probe route."
  }

  return null
}
