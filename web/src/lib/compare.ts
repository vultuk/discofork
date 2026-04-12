const COMPARE_STORAGE_KEY = "discofork-compare"

export type CompareSelection = string[]

export function getCompareSelection(): CompareSelection {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get("repos")
    if (fromUrl) {
      const repos = fromUrl.split(",").filter(Boolean)
      return repos.slice(0, 3)
    }
  } catch {
    // Fall through to localStorage
  }

  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as CompareSelection
    return Array.isArray(parsed) ? parsed.slice(0, 3) : []
  } catch {
    return []
  }
}

export function setCompareSelection(repos: CompareSelection): void {
  const trimmed = repos.slice(0, 3)
  if (typeof window !== "undefined") {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(trimmed))
  }
}

export function toggleCompareRepo(fullName: string): CompareSelection {
  const current = getCompareSelection()

  if (current.includes(fullName)) {
    const next = current.filter((name) => name !== fullName)
    setCompareSelection(next)
    return next
  }

  if (current.length >= 3) {
    return current
  }

  const next = [...current, fullName]
  setCompareSelection(next)
  return next
}

export function isInCompare(fullName: string): boolean {
  return getCompareSelection().includes(fullName)
}

export function buildCompareHref(repos: CompareSelection): string {
  if (repos.length === 0) {
    return "/compare"
  }

  return `/compare?repos=${encodeURIComponent(repos.join(","))}`
}
