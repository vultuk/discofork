/**
 * Web-local suspicious repository pattern definitions.
 *
 * Railway builds the web service from the `web/` directory, so any module
 * imported into the Next.js bundle must stay inside `web/src`.
 *
 * Keep this file aligned with `src/core/suspicious-repo-patterns.ts` when the
 * worker-side validation rules change.
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
 * Core suspicious-input validation shared by the web route validation and
 * repo launcher logic. Returns a human-readable reason string when the input
 * is suspicious, or null when the input passes all checks.
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
