import type { RepoLauncherSuggestion } from "./repo-launcher"

export type DiscoverFallbackEntry = RepoLauncherSuggestion

export function buildDiscoverFallbackEntries(
  suggestions: RepoLauncherSuggestion[],
  limit = 6,
): DiscoverFallbackEntry[] {
  if (limit <= 0) {
    return []
  }

  return suggestions.slice(0, limit)
}
