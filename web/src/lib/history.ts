const HISTORY_STORAGE_KEY = "discofork-recent-history"
const MAX_HISTORY_ENTRIES = 20

export type HistoryEntry = {
  fullName: string
  owner: string
  repo: string
  visitedAt: string
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addHistory(owner: string, repo: string): void {
  const history = getHistory()
  const fullName = `${owner}/${repo}`
  const now = new Date().toISOString()

  const existing = history.find((entry) => entry.fullName === fullName)
  if (existing) {
    existing.visitedAt = now
    const sorted = history.sort(
      (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime(),
    )
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sorted))
    return
  }

  const entry: HistoryEntry = {
    fullName,
    owner,
    repo,
    visitedAt: now,
  }

  const updated = [entry, ...history].slice(0, MAX_HISTORY_ENTRIES)
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
}

export function removeHistory(fullName: string): void {
  const history = getHistory().filter((entry) => entry.fullName !== fullName)
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([]))
  }
}
