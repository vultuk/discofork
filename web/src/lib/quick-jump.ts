import {
  parseRepoLauncherInput,
  type RepoLauncherSuggestion,
  type RepoLauncherTarget,
} from "./repo-launcher"

export function getDefaultQuickJumpSuggestionIndex(
  suggestions: RepoLauncherSuggestion[],
  input: string,
): number {
  if (suggestions.length === 0) {
    return -1
  }

  return parseRepoLauncherInput(input.trim()) ? -1 : 0
}

export function getNextQuickJumpSuggestionIndex(
  currentIndex: number,
  suggestionCount: number,
  direction: "next" | "previous",
): number {
  if (suggestionCount <= 0) {
    return -1
  }

  if (currentIndex < 0 || currentIndex >= suggestionCount) {
    return direction === "next" ? 0 : suggestionCount - 1
  }

  return direction === "next"
    ? (currentIndex + 1) % suggestionCount
    : (currentIndex - 1 + suggestionCount) % suggestionCount
}

export function resolveQuickJumpTarget(
  input: string,
  suggestions: RepoLauncherSuggestion[],
  activeSuggestionIndex: number,
  options: { preferActiveSuggestion?: boolean } = {},
): RepoLauncherTarget | null {
  if (
    options.preferActiveSuggestion &&
    activeSuggestionIndex >= 0 &&
    activeSuggestionIndex < suggestions.length
  ) {
    return suggestions[activeSuggestionIndex] ?? null
  }

  const parsedTarget = parseRepoLauncherInput(input.trim())
  if (parsedTarget) {
    return parsedTarget
  }

  if (activeSuggestionIndex < 0 || activeSuggestionIndex >= suggestions.length) {
    return null
  }

  return suggestions[activeSuggestionIndex] ?? null
}
