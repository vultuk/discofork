import { createArrayStore } from "./local-storage"

export type WatchEntry = {
  fullName: string
  owner: string
  repo: string
  watchedAt: string
  lastVisitedAt: string
}

export type WatchActivitySource = {
  status: "cached" | "missing" | "unknown"
  cachedAt: string | null
}

export type WatchActivity = {
  status: "updated" | "cached" | "missing" | "unknown"
  cachedAt: string | null
  hasUpdate: boolean
}

export const WATCH_ACTIVITY_BATCH_SIZE = 100

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

export const WATCHES_CHANGE_EVENT = "discofork:watch-change"

function emitWatchesChange(watches: WatchEntry[] = getWatches()): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<{ watches: WatchEntry[] }>(WATCHES_CHANGE_EVENT, {
      detail: { watches },
    }),
  )
}

export const getWatches = store.getAll
export const isWatched = store.has

export function addWatch(owner: string, repo: string): WatchEntry {
  const entry = store.add(owner, repo)
  emitWatchesChange(getWatches())
  return entry
}

export function removeWatch(fullName: string): void {
  store.remove(fullName)
  emitWatchesChange(getWatches())
}

export function toggleWatch(owner: string, repo: string): boolean {
  const next = store.toggle(owner, repo)
  emitWatchesChange(getWatches())
  return next
}

export function touchWatch(fullName: string): void {
  const watches = getWatches()
  const entry = watches.find((e) => e.fullName === fullName)
  if (entry) {
    entry.lastVisitedAt = new Date().toISOString()
    if (typeof window !== "undefined") {
      localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches))
      emitWatchesChange(watches)
    }
  }
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function hasUpdate(watch: WatchEntry, cachedAt: string | null | undefined): boolean {
  const visitedTimestamp = toTimestamp(watch.lastVisitedAt)
  const cachedTimestamp = toTimestamp(cachedAt)

  if (visitedTimestamp === null || cachedTimestamp === null) {
    return false
  }

  return cachedTimestamp > visitedTimestamp
}

export function getWatchActivity(
  watch: WatchEntry,
  source: WatchActivitySource | null | undefined,
): WatchActivity {
  if (!source || source.status === "unknown") {
    return {
      status: "unknown",
      cachedAt: null,
      hasUpdate: false,
    }
  }

  if (source.status === "missing") {
    return {
      status: "missing",
      cachedAt: null,
      hasUpdate: false,
    }
  }

  const cachedAt = source.cachedAt ?? null
  const updated = hasUpdate(watch, cachedAt)

  return {
    status: updated ? "updated" : "cached",
    cachedAt,
    hasUpdate: updated,
  }
}

export function chunkWatchFullNames(
  fullNames: string[],
  chunkSize = WATCH_ACTIVITY_BATCH_SIZE,
): string[][] {
  if (chunkSize < 1) {
    return [fullNames]
  }

  const chunks: string[][] = []
  for (let index = 0; index < fullNames.length; index += chunkSize) {
    chunks.push(fullNames.slice(index, index + chunkSize))
  }
  return chunks
}

export function sortWatchesByActivity(
  watches: WatchEntry[],
  activityByFullName: Record<string, WatchActivitySource | null | undefined> = {},
): WatchEntry[] {
  return watches
    .map((watch, index) => {
      const activity = getWatchActivity(watch, activityByFullName[watch.fullName])
      return {
        watch,
        index,
        activity,
        cachedTimestamp: toTimestamp(activity.cachedAt),
      }
    })
    .sort((left, right) => {
      if (left.activity.hasUpdate !== right.activity.hasUpdate) {
        return left.activity.hasUpdate ? -1 : 1
      }

      if (left.activity.hasUpdate && right.activity.hasUpdate && left.cachedTimestamp !== right.cachedTimestamp) {
        return (right.cachedTimestamp ?? 0) - (left.cachedTimestamp ?? 0)
      }

      return left.index - right.index
    })
    .map(({ watch }) => watch)
}
