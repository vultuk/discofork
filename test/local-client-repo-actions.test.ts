import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import {
  BOOKMARKS_CHANGE_EVENT,
  getBookmarks,
  isBookmarked,
  toggleBookmark,
} from "../web/src/lib/bookmarks"
import {
  addHistory,
  clearHistory,
  getHistory,
  HISTORY_CHANGE_EVENT,
  removeHistory,
} from "../web/src/lib/history"
import {
  WATCHES_CHANGE_EVENT,
  getWatches,
  isWatched,
  toggleWatch,
  touchWatch,
} from "../web/src/lib/watches"

type MockStorage = {
  clear: () => void
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
  setItem: (key: string, value: string) => void
}

function createMockStorage(): MockStorage {
  const store = new Map<string, string>()

  return {
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

function installMockWindow() {
  const localStorage = createMockStorage()
  const mockWindow = Object.assign(new EventTarget(), { localStorage })

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockWindow,
    writable: true,
  })
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
    writable: true,
  })

  return { localStorage, mockWindow }
}

describe("local client repo action stores", () => {
  beforeEach(() => {
    installMockWindow()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
  })

  test("bookmark toggles emit a same-page change event", () => {
    const bookmarkEvents: string[][] = []

    window.addEventListener(BOOKMARKS_CHANGE_EVENT, () => {
      bookmarkEvents.push(getBookmarks().map((entry) => entry.fullName))
    })

    expect(isBookmarked("openai/codex")).toBe(false)
    expect(toggleBookmark("openai", "codex")).toBe(true)
    expect(isBookmarked("openai/codex")).toBe(true)
    expect(bookmarkEvents).toEqual([["openai/codex"]])

    expect(toggleBookmark("openai", "codex")).toBe(false)
    expect(isBookmarked("openai/codex")).toBe(false)
    expect(bookmarkEvents).toEqual([["openai/codex"], []])
  })

  test("watch toggles and touch updates emit same-page change events", async () => {
    const watchEventCounts: number[] = []

    window.addEventListener(WATCHES_CHANGE_EVENT, () => {
      watchEventCounts.push(getWatches().length)
    })

    expect(isWatched("schema-labs-ltd/discofork")).toBe(false)
    expect(toggleWatch("schema-labs-ltd", "discofork")).toBe(true)
    expect(isWatched("schema-labs-ltd/discofork")).toBe(true)

    const watchedBeforeTouch = getWatches()[0]
    await Bun.sleep(5)
    touchWatch("schema-labs-ltd/discofork")
    const watchedAfterTouch = getWatches()[0]

    expect(new Date(watchedAfterTouch.lastVisitedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(watchedBeforeTouch.lastVisitedAt).getTime(),
    )
    expect(watchEventCounts).toEqual([1, 1])
  })

  test("history mutations emit same-page change events", async () => {
    const historySnapshots: string[][] = []

    window.addEventListener(HISTORY_CHANGE_EVENT, () => {
      historySnapshots.push(getHistory().map((entry) => entry.fullName))
    })

    addHistory("openai", "codex")
    await Bun.sleep(5)
    addHistory("vercel", "next.js")
    removeHistory("openai/codex")
    clearHistory()

    expect(historySnapshots).toEqual([
      ["openai/codex"],
      ["vercel/next.js", "openai/codex"],
      ["vercel/next.js"],
      [],
    ])
  })
})
