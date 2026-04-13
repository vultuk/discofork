/**
 * Helpers for managing side-by-side fork comparison state via URL params.
 * Uses `compare=fork1,fork2` query parameter to persist selection.
 */

export const COMPARE_FORKS_PARAM = "compare"

/**
 * Parse the compare param from a URL search string.
 * Returns one or two fork names if present, otherwise null.
 */
export function parseCompareForks(searchParams: URLSearchParams): [string, string] | [string] | null {
  const raw = searchParams.get(COMPARE_FORKS_PARAM)
  if (!raw) return null

  const parts = raw.split(",").filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return [parts[0]]
  if (parts[0] === parts[1]) return [parts[0]]

  return [parts[0], parts[1]]
}

/**
 * Build a URLSearchParams with the compare param set to two fork names.
 * Returns empty string if either name is empty.
 */
export function buildCompareForksParam(forkA: string, forkB: string): string {
  if (!forkA || !forkB || forkA === forkB) return ""
  return `${COMPARE_FORKS_PARAM}=${encodeURIComponent(forkA)},${encodeURIComponent(forkB)}`
}

/**
 * Check if a given fork name is one of the forks being compared.
 */
export function isForkInCompare(forkName: string, comparePair: [string, string] | [string] | null): boolean {
  if (!comparePair) return false
  return comparePair[0] === forkName || (comparePair.length === 2 && comparePair[1] === forkName)
}
