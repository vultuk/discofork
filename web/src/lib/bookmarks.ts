const BOOKMARKS_STORAGE_KEY = "discofork-bookmarks"

export type BookmarkEntry = {
  fullName: string
  owner: string
  repo: string
  bookmarkedAt: string
}

export function getBookmarks(): BookmarkEntry[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as BookmarkEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isBookmarked(fullName: string): boolean {
  return getBookmarks().some((entry) => entry.fullName === fullName)
}

export function addBookmark(owner: string, repo: string): BookmarkEntry {
  const bookmarks = getBookmarks()
  const fullName = `${owner}/${repo}`

  if (bookmarks.some((entry) => entry.fullName === fullName)) {
    return bookmarks.find((entry) => entry.fullName === fullName)!
  }

  const entry: BookmarkEntry = {
    fullName,
    owner,
    repo,
    bookmarkedAt: new Date().toISOString(),
  }

  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify([...bookmarks, entry]))
  return entry
}

export function removeBookmark(fullName: string): void {
  const bookmarks = getBookmarks().filter((entry) => entry.fullName !== fullName)
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks))
}

export function toggleBookmark(owner: string, repo: string): boolean {
  const fullName = `${owner}/${repo}`

  if (isBookmarked(fullName)) {
    removeBookmark(fullName)
    return false
  }

  addBookmark(owner, repo)
  return true
}
