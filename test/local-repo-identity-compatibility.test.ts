import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { addBookmark, getBookmarks, isBookmarked, toggleBookmark } from "../web/src/lib/bookmarks"
import { addWatch, getWatches, isWatched, touchWatch } from "../web/src/lib/watches"
import { getNote, getNotes, hasNote, removeNote, setNote } from "../web/src/lib/notes"
import { addTag, getRepoTags, getTags, removeTag } from "../web/src/lib/tags"
import { createArrayStore, createMapStore } from "../web/src/lib/local-storage"

const initialBookmark = { fullName: "Org/Repo", owner: "Org", repo: "Repo", bookmarkedAt: "2026-01-01" }
const initialWatch = { fullName: "Org/Repo", owner: "Org", repo: "Repo", watchedAt: "2026-01-01", lastVisitedAt: "2026-01-02" }
let values: Map<string, string>
let writes: string[]

describe("canonical pages retain mixed-case browser repository state", () => {
  beforeEach(() => {
    values = new Map([
      ["discofork-bookmarks", JSON.stringify([initialBookmark])],
      ["discofork-watches", JSON.stringify([initialWatch])],
      ["discofork-notes", JSON.stringify({ "Org/Repo": "original note" })],
      ["discofork-tags", JSON.stringify({ "Org/Repo": ["original-tag"] })],
    ])
    writes = []
    Object.assign(globalThis, {
      window: new EventTarget(),
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { writes.push(key); values.set(key, value) },
      },
    })
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
  })

  test("case-only reads find all four stores without rewriting keys or original data", () => {
    const before = new Map(values)
    expect(isBookmarked("org/repo")).toBe(true)
    expect(isWatched("ORG/REPO")).toBe(true)
    expect(getNote("org/repo")).toBe("original note")
    expect(hasNote("ORG/REPO")).toBe(true)
    expect(getRepoTags("org/repo")).toEqual(["original-tag"])
    expect(values).toEqual(before)
    expect(writes).toEqual([])
  })

  test("adding a case-only bookmark/watch reuses original entries and timestamps", () => {
    expect(addBookmark("org", "repo")).toEqual(initialBookmark)
    expect(addWatch("ORG", "REPO")).toEqual(initialWatch)
    expect(getBookmarks()).toEqual([initialBookmark])
    expect(getWatches()).toEqual([initialWatch])
    expect(writes).toEqual([])
  })

  test("explicit toggling removes the existing bookmark rather than adding a duplicate", () => {
    expect(toggleBookmark("org", "repo")).toBe(false)
    expect(getBookmarks()).toEqual([])
  })

  test("visiting a canonical page touches the existing watch without replacing its identity", () => {
    touchWatch("org/repo")
    const watch = getWatches()[0]
    expect(watch).toMatchObject({ ...initialWatch, lastVisitedAt: expect.any(String) })
    expect(watch?.lastVisitedAt).not.toBe(initialWatch.lastVisitedAt)
    expect(getWatches()).toHaveLength(1)
  })

  test("note/tag edits update the original alias without creating another key", () => {
    setNote("org/repo", "edited note")
    expect(getNotes()).toEqual({ "Org/Repo": "edited note" })
    expect(addTag("org/repo", "new-tag")).toEqual(["new-tag", "original-tag"])
    expect(getTags()).toEqual({ "Org/Repo": ["new-tag", "original-tag"] })
    expect(removeTag("ORG/REPO", "original-tag")).toEqual(["new-tag"])
    removeNote("ORG/REPO")
    expect(getNotes()).toEqual({})
  })

  test("existing case collisions are retained, with exact map-key preference", () => {
    const notes = { "Org/Repo": "legacy note", "org/repo": "canonical note" }
    const tags = { "Org/Repo": ["legacy-tag"], "org/repo": ["canonical-tag"] }
    values.set("discofork-notes", JSON.stringify(notes))
    values.set("discofork-tags", JSON.stringify(tags))
    expect(getNote("org/repo")).toBe("canonical note")
    expect(getNote("Org/Repo")).toBe("legacy note")
    expect(getNotes()).toEqual(notes)
    expect(getTags()).toEqual(tags)
    expect(writes).toEqual([])
    setNote("org/repo", "explicit edit")
    expect(getNotes()).toEqual({ ...notes, "org/repo": "explicit edit" })
  })

  test("unsupported retained array records do not prevent a valid alias lookup", () => {
    const records = [null, { legacy: "unsupported" }, initialBookmark]
    values.set("discofork-bookmarks", JSON.stringify(records))
    expect(isBookmarked("org/repo")).toBe(true)
    expect(addBookmark("org", "repo")).toEqual(initialBookmark)
    expect(JSON.parse(values.get("discofork-bookmarks")!)).toEqual(records)
    expect(writes).toEqual([])
  })

  test("generic stores remain case-sensitive unless explicitly opted in", () => {
    const array = createArrayStore({ storageKey: "discofork-bookmarks", keyOf: (entry: typeof initialBookmark) => entry.fullName, createEntry: (owner, repo) => ({ ...initialBookmark, fullName: `${owner}/${repo}`, owner, repo }) })
    const map = createMapStore<string>({ storageKey: "discofork-notes" })
    expect(array.has("org/repo")).toBe(false)
    expect(map.get("org/repo")).toBeUndefined()
  })
})
