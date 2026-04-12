const WATCHES_STORAGE_KEY = "discofork-watches"

export type WatchEntry = {
  fullName: string
  owner: string
  repo: string
  watchedAt: string
  lastVisitedAt: string
}

export function getWatches(): WatchEntry[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = localStorage.getItem(WATCHES_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as WatchEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isWatched(fullName: string): boolean {
  return getWatches().some((entry) => entry.fullName === fullName)
}

export function addWatch(owner: string, repo: string): WatchEntry {
  const watches = getWatches()
  const fullName = `${owner}/${repo}`

  const existing = watches.find((entry) => entry.fullName === fullName)
  if (existing) {
    return existing
  }

  const entry: WatchEntry = {
    fullName,
    owner,
    repo,
    watchedAt: new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
  }

  localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify([...watches, entry]))
  return entry
}

export function removeWatch(fullName: string): void {
  const watches = getWatches().filter((entry) => entry.fullName !== fullName)
  localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches))
}

export function toggleWatch(owner: string, repo: string): boolean {
  const fullName = `${owner}/${repo}`

  if (isWatched(fullName)) {
    removeWatch(fullName)
    return false
  }

  addWatch(owner, repo)
  return true
}

export function touchWatch(fullName: string): void {
  const watches = getWatches()
  const entry = watches.find((e) => e.fullName === fullName)
  if (entry) {
    entry.lastVisitedAt = new Date().toISOString()
    localStorage.setItem(WATCHES_STORAGE_KEY, JSON.stringify(watches))
  }
}

export function hasUpdate(watch: WatchEntry, cachedAt: string): boolean {
  const watchedDate = new Date(watch.lastVisitedAt)
  const cachedDate = new Date(cachedAt)
  return cachedDate > watchedDate
}
