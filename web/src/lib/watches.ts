import { createArrayStore } from "./local-storage"

export type WatchEntry = {
  fullName: string
  owner: string
  repo: string
  watchedAt: string
  lastVisitedAt: string
}

const WATCHES_STORAGE_KEY = "discofork-watches"

const store = createArrayStore<WatchEntry>({
  storageKey: WATCHES_STORAGE_KEY,
  keyOf: (entry) => entry.fullName,
  createEntry: (owner, repo) => ({
    fullName: `${owner}/${repo}`,
    owner,
    repo,
    watchedAt: new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
  }),
})

export const getWatches = store.getAll
export const isWatched = store.has
export const addWatch = store.add
export const removeWatch = store.remove
export const toggleWatch = store.toggle

export function touchWatch(fullName: string): void {
  const watches = getWatches()
  const entry = watches.find((e) => e.fullName === fullName)
  if (entry) {
    entry.lastVisitedAt = new Date().toISOString()
    if (typeof window !== "undefined") {
      localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches))
    }
  }
}

export function hasUpdate(watch: WatchEntry, cachedAt: string): boolean {
  const watchedDate = new Date(watch.lastVisitedAt)
  const cachedDate = new Date(cachedAt)
  return cachedDate > watchedDate
}
