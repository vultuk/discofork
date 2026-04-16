import {
  MAX_COMPARE_REPOS,
  addCompareSelectionRepo,
  applyCompareRepoInput,
  normalizeCompareSelection,
  parseCompareSelectionValue,
  removeCompareSelectionRepo,
  replaceCompareSelectionRepo,
  type CompareRepoInputResult,
  type CompareSelection,
} from "./compare-selection"

const COMPARE_STORAGE_KEY = "discofork-compare"

export {
  MAX_COMPARE_REPOS,
  addCompareSelectionRepo,
  applyCompareRepoInput,
  normalizeCompareSelection,
  parseCompareSelectionValue,
  removeCompareSelectionRepo,
  replaceCompareSelectionRepo,
  type CompareRepoInputResult,
  type CompareSelection,
}

export const COMPARE_SELECTION_EVENT = "discofork:compare-selection-change"

function emitCompareSelectionChange(repos: CompareSelection): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<{ repos: CompareSelection }>(COMPARE_SELECTION_EVENT, {
      detail: { repos },
    }),
  )
}

function readStoredCompareSelection(): CompareSelection {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? normalizeCompareSelection(parsed.filter((value): value is string => typeof value === "string")) : []
  } catch {
    return []
  }
}

export function getCompareSelection(): CompareSelection {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const fromUrl = new URLSearchParams(window.location.search).get("repos")
    const parsedFromUrl = parseCompareSelectionValue(fromUrl)
    if (parsedFromUrl.length > 0) {
      return parsedFromUrl
    }
  } catch {
    // Fall through to localStorage.
  }

  return readStoredCompareSelection()
}

export function setCompareSelection(repos: CompareSelection): CompareSelection {
  const next = normalizeCompareSelection(repos)

  if (typeof window !== "undefined") {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next))
    emitCompareSelectionChange(next)
  }

  return next
}

export function removeCompareRepo(fullName: string): CompareSelection {
  return setCompareSelection(removeCompareSelectionRepo(getCompareSelection(), fullName))
}

export function clearCompareSelection(): CompareSelection {
  return setCompareSelection([])
}

export function replaceCompareRepo(
  currentFullName: string | null | undefined,
  nextFullName: string,
): CompareSelection {
  return setCompareSelection(replaceCompareSelectionRepo(getCompareSelection(), currentFullName, nextFullName))
}

export function toggleCompareRepo(fullName: string): CompareSelection {
  const current = getCompareSelection()

  if (current.includes(fullName)) {
    return removeCompareRepo(fullName)
  }

  return setCompareSelection(addCompareSelectionRepo(current, fullName))
}

export function isInCompare(fullName: string): boolean {
  return getCompareSelection().includes(fullName)
}

export function buildCompareHref(repos: CompareSelection): string {
  const normalized = normalizeCompareSelection(repos)
  if (normalized.length === 0) {
    return "/compare"
  }

  return `/compare?repos=${encodeURIComponent(normalized.join(","))}`
}
