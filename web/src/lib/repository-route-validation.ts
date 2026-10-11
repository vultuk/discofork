import {
  SUSPICIOUS_OWNER_NAMES,
  SUSPICIOUS_ROUTE_PAIRS,
  describeSuspiciousRepoInputCore,
} from "@/core/suspicious-repo-patterns"

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function joinSqlLiterals(values: readonly string[]): string {
  return values.map((value) => quoteSqlLiteral(value)).join(", ")
}

export const SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE = [
  "owner like '.%'",
  "position('%' in owner) > 0",
  "position('%' in repo) > 0",
  "position('/' in owner) > 0",
  "position('/' in repo) > 0",
  "position(chr(92) in owner) > 0",
  "position(chr(92) in repo) > 0",
  "position('..' in owner) > 0",
  "position('..' in repo) > 0",
  `lower(owner) in (${joinSqlLiterals(SUSPICIOUS_OWNER_NAMES)})`,
  `lower(owner || '/' || repo) in (${joinSqlLiterals(SUSPICIOUS_ROUTE_PAIRS)})`,
].join(" or ")

export function describeSuspiciousRepositoryRoute(owner: string, repo: string): string | null {
  // Path separator check — web-specific because the worker's parseGitHubRepoInput
  // regex already prevents these from reaching validation.
  if (owner.includes("/") || repo.includes("/") || owner.includes("\\") || repo.includes("\\")) {
    return "Owner or repository name contains path separators."
  }

  // Delegate shared checks (hidden prefix, URL-encoded chars, traversal, known patterns)
  return describeSuspiciousRepoInputCore(owner, repo)
}

export function isSuspiciousRepositoryRoute(owner: string, repo: string): boolean {
  return describeSuspiciousRepositoryRoute(owner, repo) !== null
}
