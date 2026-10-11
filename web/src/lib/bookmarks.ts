import { createArrayStore } from "./local-storage"

export type BookmarkEntry = {
  fullName: string
  owner: string
  repo: string
  bookmarkedAt: string
}

const store = createArrayStore<BookmarkEntry>({
  storageKey: "discofork-bookmarks",
  keyOf: (entry) => entry.fullName,
  createEntry: (owner, repo) => ({
    fullName: `${owner}/${repo}`,
    owner,
    repo,
    bookmarkedAt: new Date().toISOString(),
  }),
})

export const BOOKMARKS_CHANGE_EVENT = "discofork:bookmark-change"

function emitBookmarksChange(bookmarks: BookmarkEntry[] = getBookmarks()): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<{ bookmarks: BookmarkEntry[] }>(BOOKMARKS_CHANGE_EVENT, {
      detail: { bookmarks },
    }),
  )
}

export const getBookmarks = store.getAll
export const isBookmarked = store.has

export function addBookmark(owner: string, repo: string): BookmarkEntry {
  const entry = store.add(owner, repo)
  emitBookmarksChange(getBookmarks())
  return entry
}

export function removeBookmark(fullName: string): void {
  store.remove(fullName)
  emitBookmarksChange(getBookmarks())
}

export function toggleBookmark(owner: string, repo: string): boolean {
  const next = store.toggle(owner, repo)
  emitBookmarksChange(getBookmarks())
  return next
}
