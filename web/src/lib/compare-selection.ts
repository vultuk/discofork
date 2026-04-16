import { parseRepoLauncherInput } from "./repo-launcher"

export const MAX_COMPARE_REPOS = 3

export type CompareSelection = string[]

export type CompareRepoInputResult = {
  kind: "added" | "error" | "replaced" | "unchanged"
  fullName: string | null
  message: string
  nextSelection: CompareSelection
}

function normalizeCompareRepoName(fullName: string): string | null {
  const normalized = fullName.trim()
  return normalized ? normalized : null
}

export function normalizeCompareSelection(repos: CompareSelection): CompareSelection {
  const normalized: string[] = []

  for (const repo of repos) {
    const fullName = normalizeCompareRepoName(repo)
    if (!fullName || normalized.includes(fullName)) {
      continue
    }

    normalized.push(fullName)
    if (normalized.length === MAX_COMPARE_REPOS) {
      break
    }
  }

  return normalized
}

export function parseCompareSelectionValue(value: string | null | undefined): CompareSelection {
  if (!value) {
    return []
  }

  return normalizeCompareSelection(value.split(","))
}

function selectionsEqual(left: CompareSelection, right: CompareSelection): boolean {
  return left.length === right.length && left.every((repo, index) => repo === right[index])
}

export function applyCompareRepoInput(
  repos: CompareSelection,
  rawInput: string,
  replaceTarget?: string | null,
): CompareRepoInputResult {
  const current = normalizeCompareSelection(repos)
  const normalizedReplaceTarget = normalizeCompareRepoName(replaceTarget ?? "")
  const activeReplaceTarget = normalizedReplaceTarget && current.includes(normalizedReplaceTarget) ? normalizedReplaceTarget : null
  const trimmed = rawInput.trim()

  if (!trimmed) {
    return {
      kind: "error",
      fullName: null,
      message: "Please enter a repository name.",
      nextSelection: current,
    }
  }

  const parsedRepo = parseRepoLauncherInput(trimmed)
  if (!parsedRepo) {
    return {
      kind: "error",
      fullName: null,
      message: "Paste owner/repo, a GitHub repo URL, or a Discofork repo URL.",
      nextSelection: current,
    }
  }

  if (!activeReplaceTarget && current.includes(parsedRepo.fullName)) {
    return {
      kind: "unchanged",
      fullName: parsedRepo.fullName,
      message: `${parsedRepo.fullName} is already in compare.`,
      nextSelection: current,
    }
  }

  if (activeReplaceTarget && activeReplaceTarget !== parsedRepo.fullName && current.includes(parsedRepo.fullName)) {
    return {
      kind: "unchanged",
      fullName: parsedRepo.fullName,
      message: `${parsedRepo.fullName} is already selected in another compare slot.`,
      nextSelection: current,
    }
  }

  if (!activeReplaceTarget && current.length >= MAX_COMPARE_REPOS) {
    return {
      kind: "error",
      fullName: null,
      message: "Compare is full. Click Replace on a selected repo, then paste a repository here.",
      nextSelection: current,
    }
  }

  if (activeReplaceTarget === parsedRepo.fullName) {
    return {
      kind: "unchanged",
      fullName: parsedRepo.fullName,
      message: `${parsedRepo.fullName} is already selected in that slot.`,
      nextSelection: current,
    }
  }

  const nextSelection = activeReplaceTarget
    ? replaceCompareSelectionRepo(current, activeReplaceTarget, parsedRepo.fullName)
    : addCompareSelectionRepo(current, parsedRepo.fullName)

  if (selectionsEqual(current, nextSelection)) {
    return {
      kind: "unchanged",
      fullName: parsedRepo.fullName,
      message: `${parsedRepo.fullName} is already in compare.`,
      nextSelection: current,
    }
  }

  if (activeReplaceTarget) {
    return {
      kind: "replaced",
      fullName: parsedRepo.fullName,
      message: `Replaced ${activeReplaceTarget} with ${parsedRepo.fullName}. Cached comparison data will appear here when available.`,
      nextSelection,
    }
  }

  return {
    kind: "added",
    fullName: parsedRepo.fullName,
    message: `Added ${parsedRepo.fullName} to compare. Cached comparison data will appear here when available.`,
    nextSelection,
  }
}

export function addCompareSelectionRepo(repos: CompareSelection, fullName: string): CompareSelection {
  const current = normalizeCompareSelection(repos)
  const nextRepo = normalizeCompareRepoName(fullName)

  if (!nextRepo || current.includes(nextRepo) || current.length >= MAX_COMPARE_REPOS) {
    return current
  }

  return [...current, nextRepo]
}

export function removeCompareSelectionRepo(repos: CompareSelection, fullName: string): CompareSelection {
  const current = normalizeCompareSelection(repos)
  const target = normalizeCompareRepoName(fullName)

  if (!target) {
    return current
  }

  return current.filter((repo) => repo !== target)
}

export function moveCompareSelectionRepo(
  repos: CompareSelection,
  fullName: string,
  direction: "left" | "right",
): CompareSelection {
  const current = normalizeCompareSelection(repos)
  const target = normalizeCompareRepoName(fullName)

  if (!target) {
    return current
  }

  const index = current.indexOf(target)
  if (index === -1) {
    return current
  }

  const nextIndex = direction === "left" ? index - 1 : index + 1
  if (nextIndex < 0 || nextIndex >= current.length) {
    return current
  }

  const next = [...current]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  return next
}

export function replaceCompareSelectionRepo(
  repos: CompareSelection,
  currentFullName: string | null | undefined,
  nextFullName: string,
): CompareSelection {
  const current = normalizeCompareSelection(repos)
  const nextRepo = normalizeCompareRepoName(nextFullName)
  const target = normalizeCompareRepoName(currentFullName ?? "")

  if (!nextRepo) {
    return current
  }

  if (!target || !current.includes(target)) {
    return addCompareSelectionRepo(current, nextRepo)
  }

  if (target === nextRepo) {
    return current
  }

  return normalizeCompareSelection(current.map((repo) => (repo === target ? nextRepo : repo)))
}
