import type { BookmarkEntry } from "./bookmarks"
import { getBookmarks } from "./bookmarks"
import type { HistoryEntry } from "./history"
import { getHistory } from "./history"
import { describeSuspiciousRepositoryRoute } from "./repository-route-validation"
import type { WatchEntry } from "./watches"
import { getWatches } from "./watches"

const SUPPORTED_REPO_HOSTS = new Set(["github.com", "www.github.com", "discofork.ai", "www.discofork.ai"])
const HOST_LIKE_REPO_INPUT = /^(?:https?:\/\/)?(?:www\.)?(github\.com|discofork\.ai)\//i
const SSH_REPO_INPUT = /^(?:git@github\.com:|ssh:\/\/git@github\.com\/)(?<path>[^?#]+)$/i

const SUGGESTION_SOURCE_ORDER = ["bookmarked", "watched", "recent"] as const
const SUGGESTION_SOURCE_WEIGHT: Record<RepoLauncherSuggestionSource, number> = {
  bookmarked: 4,
  watched: 3,
  recent: 2,
}

export type RepoLauncherTarget = {
  owner: string
  repo: string
  fullName: string
  canonicalPath: string
}

export type RepoLauncherSuggestionSource = (typeof SUGGESTION_SOURCE_ORDER)[number]

export type RepoLauncherSuggestion = RepoLauncherTarget & {
  sources: RepoLauncherSuggestionSource[]
  lastTouchedAt: string | null
}

export const REPO_LAUNCHER_SUGGESTION_LABELS: Record<RepoLauncherSuggestionSource, string> = {
  recent: "Recent",
  bookmarked: "Bookmarked",
  watched: "Watching",
}

function stripWrappingPunctuation(value: string): string {
  return value
    .trim()
    .replace(/^["'`<(\[]+/, "")
    .replace(/["'`)>\].,:;!?]+$/, "")
}

function createRepoLauncherTarget(owner: string, repo: string): RepoLauncherTarget {
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    canonicalPath: `/${owner}/${repo}`,
  }
}

function normalizeRepoPathCandidate(raw: string): string | null {
  const input = stripWrappingPunctuation(raw)
  if (!input) {
    return null
  }

  const sshMatch = input.match(SSH_REPO_INPUT)
  if (sshMatch?.groups?.path) {
    return sshMatch.groups.path
  }

  if (HOST_LIKE_REPO_INPUT.test(input) || /^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
    const href = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`

    try {
      const url = new URL(href)
      if (!SUPPORTED_REPO_HOSTS.has(url.hostname.toLowerCase())) {
        return null
      }
      return url.pathname
    } catch {
      return null
    }
  }

  return input.split(/[?#]/, 1)[0] ?? null
}

function toTimestamp(value: string | null): number {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function scoreSuggestion(suggestion: RepoLauncherSuggestion): number {
  return suggestion.sources.reduce((total, source) => total + SUGGESTION_SOURCE_WEIGHT[source], 0)
}

function addSuggestion(
  suggestions: Map<string, RepoLauncherSuggestion>,
  owner: string,
  repo: string,
  source: RepoLauncherSuggestionSource,
  touchedAt: string | null,
): void {
  const target = parseRepoLauncherInput(`${owner}/${repo}`)
  if (!target) {
    return
  }

  const existing = suggestions.get(target.fullName)
  if (!existing) {
    suggestions.set(target.fullName, {
      ...target,
      sources: [source],
      lastTouchedAt: touchedAt,
    })
    return
  }

  if (!existing.sources.includes(source)) {
    existing.sources.push(source)
  }

  if (toTimestamp(touchedAt) > toTimestamp(existing.lastTouchedAt)) {
    existing.lastTouchedAt = touchedAt
  }
}

export function parseRepoLauncherInput(raw: string): RepoLauncherTarget | null {
  const candidatePath = normalizeRepoPathCandidate(raw)
  if (!candidatePath) {
    return null
  }

  const segments = candidatePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 2) {
    return null
  }

  const owner = segments[0]
  const repoSegment = segments[1]
  if (!owner || !repoSegment) {
    return null
  }

  const repo = repoSegment.replace(/\.git$/i, "")
  if (!repo) {
    return null
  }

  if (describeSuspiciousRepositoryRoute(owner, repo)) {
    return null
  }

  return createRepoLauncherTarget(owner, repo)
}

export function filterRepoLauncherSuggestions(
  suggestions: RepoLauncherSuggestion[],
  query: string,
): RepoLauncherSuggestion[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return suggestions
  }

  return suggestions.filter((suggestion) => suggestion.fullName.toLowerCase().includes(normalizedQuery))
}

export function mergeRepoLauncherSuggestions({
  history = [],
  bookmarks = [],
  watches = [],
  limit = 6,
}: {
  history?: Pick<HistoryEntry, "owner" | "repo" | "visitedAt">[]
  bookmarks?: Pick<BookmarkEntry, "owner" | "repo" | "bookmarkedAt">[]
  watches?: Pick<WatchEntry, "owner" | "repo" | "lastVisitedAt" | "watchedAt">[]
  limit?: number
} = {}): RepoLauncherSuggestion[] {
  const suggestions = new Map<string, RepoLauncherSuggestion>()

  for (const entry of history) {
    addSuggestion(suggestions, entry.owner, entry.repo, "recent", entry.visitedAt)
  }

  for (const entry of bookmarks) {
    addSuggestion(suggestions, entry.owner, entry.repo, "bookmarked", entry.bookmarkedAt)
  }

  for (const entry of watches) {
    addSuggestion(suggestions, entry.owner, entry.repo, "watched", entry.lastVisitedAt || entry.watchedAt)
  }

  return [...suggestions.values()]
    .map((suggestion) => ({
      ...suggestion,
      sources: SUGGESTION_SOURCE_ORDER.filter((source) => suggestion.sources.includes(source)),
    }))
    .sort((left, right) => {
      const scoreDifference = scoreSuggestion(right) - scoreSuggestion(left)
      if (scoreDifference !== 0) {
        return scoreDifference
      }

      const timestampDifference = toTimestamp(right.lastTouchedAt) - toTimestamp(left.lastTouchedAt)
      if (timestampDifference !== 0) {
        return timestampDifference
      }

      return left.fullName.localeCompare(right.fullName)
    })
    .slice(0, limit)
}

export function getRepoLauncherSuggestions(limit = 6): RepoLauncherSuggestion[] {
  return mergeRepoLauncherSuggestions({
    history: getHistory(),
    bookmarks: getBookmarks(),
    watches: getWatches(),
    limit,
  })
}
