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

export const getBookmarks = store.getAll
export const isBookmarked = store.has
export const addBookmark = store.add
export const removeBookmark = store.remove
export const toggleBookmark = store.toggle
