import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import {
  COMPARE_WORKSPACES_CHANGE_EVENT,
  getCompareWorkspaces,
  removeCompareWorkspace,
  saveCompareWorkspace,
} from "../web/src/lib/compare-workspaces"

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

describe("compare workspaces", () => {
  beforeEach(() => {
    installMockWindow()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
  })

  test("saveCompareWorkspace stores a normalized lineup with a readable default name", () => {
    const saved = saveCompareWorkspace([" openai/codex ", "vercel/next.js", "openai/codex"])

    expect(saved.name).toBe("openai/codex · vercel/next.js")
    expect(saved.repos).toEqual(["openai/codex", "vercel/next.js"])
    expect(getCompareWorkspaces()).toHaveLength(1)
  })

  test("saveCompareWorkspace updates the existing saved lineup for the same repo order instead of duplicating it", async () => {
    const first = saveCompareWorkspace(["openai/codex", "vercel/next.js"])
    await Bun.sleep(5)
    const second = saveCompareWorkspace(["openai/codex", "vercel/next.js"], "Release candidates")

    expect(second.id).toBe(first.id)
    expect(second.name).toBe("Release candidates")
    expect(getCompareWorkspaces()).toHaveLength(1)
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.updatedAt).getTime())
  })

  test("compare workspace mutations emit same-page change events", () => {
    const snapshots: string[][] = []

    window.addEventListener(COMPARE_WORKSPACES_CHANGE_EVENT, () => {
      snapshots.push(getCompareWorkspaces().map((workspace) => workspace.name))
    })

    const saved = saveCompareWorkspace(["openai/codex", "vercel/next.js"])
    removeCompareWorkspace(saved.id)

    expect(snapshots).toEqual([["openai/codex · vercel/next.js"], []])
  })
})
