import { createArrayStore } from "./local-storage"

const HISTORY_STORAGE_KEY = "discofork-recent-history"
const MAX_HISTORY_ENTRIES = 20

export type HistoryEntry = {
  fullName: string
  owner: string
  repo: string
  visitedAt: string
}

const store = createArrayStore<HistoryEntry>({
  storageKey: HISTORY_STORAGE_KEY,
  keyOf: (entry) => entry.fullName,
  createEntry: (owner, repo) => ({
    fullName: `${owner}/${repo}`,
    owner,
    repo,
    visitedAt: new Date().toISOString(),
  }),
})

export const getHistory = store.getAll
export const removeHistory = store.remove

/**
 * Add or update a history entry with max-entries cap and recency sorting.
 */
export function addHistory(owner: string, repo: string): void {
  const history = getHistory()
  const fullName = `${owner}/${repo}`
  const now = new Date().toISOString()

  const existing = history.find((entry) => entry.fullName === fullName)
  if (existing) {
    existing.visitedAt = now
    history.sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
    if (typeof window !== "undefined") {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
    }
    return
  }

  const entry: HistoryEntry = {
    fullName,
    owner,
    repo,
    visitedAt: now,
  }

  const updated = [entry, ...history].slice(0, MAX_HISTORY_ENTRIES)
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
  }
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([]))
  }
}
