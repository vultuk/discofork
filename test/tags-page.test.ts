import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import {
  addTag,
  getAllTags,
  getRepoTags,
  getReposByTag,
  getTagSummaries,
  getTagSummary,
  removeTag,
  setRepoTags,
  TAGS_CHANGE_EVENT,
  type TagsMap,
} from "../web/src/lib/tags"

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

const SAMPLE_TAGS: TagsMap = {
  "schema-labs-ltd/discofork": ["bug", "ops"],
  "openai/codex": ["ai", "bug"],
  "vercel/next.js": ["frontend", "ops"],
}

describe("tags page helpers", () => {
  beforeEach(() => {
    installMockWindow()
  })

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
  })

  test("getTagSummaries returns alphabetical tags with repository counts and sorted repositories", () => {
    expect(getTagSummaries(SAMPLE_TAGS)).toEqual([
      { tag: "ai", repoCount: 1, repos: ["openai/codex"] },
      {
        tag: "bug",
        repoCount: 2,
        repos: ["openai/codex", "schema-labs-ltd/discofork"],
      },
      { tag: "frontend", repoCount: 1, repos: ["vercel/next.js"] },
      {
        tag: "ops",
        repoCount: 2,
        repos: ["schema-labs-ltd/discofork", "vercel/next.js"],
      },
    ])
  })

  test("switching and clearing the selected tag updates the visible repositories without losing saved tags", () => {
    let selectedTag: string | null = null

    expect(getTagSummary(selectedTag, SAMPLE_TAGS)).toBeNull()

    selectedTag = "bug"
    expect(getTagSummary(selectedTag, SAMPLE_TAGS)).toEqual({
      tag: "bug",
      repoCount: 2,
      repos: ["openai/codex", "schema-labs-ltd/discofork"],
    })

    selectedTag = "ops"
    expect(getTagSummary(selectedTag, SAMPLE_TAGS)).toEqual({
      tag: "ops",
      repoCount: 2,
      repos: ["schema-labs-ltd/discofork", "vercel/next.js"],
    })

    selectedTag = null
    expect(getTagSummary(selectedTag, SAMPLE_TAGS)).toBeNull()
    expect(getTagSummaries(SAMPLE_TAGS).map((summary) => `${summary.tag}:${summary.repoCount}`)).toEqual([
      "ai:1",
      "bug:2",
      "frontend:1",
      "ops:2",
    ])
  })

  test("existing tag add/remove behavior remains normalized, emits change events, and stays compatible with repo filtering", () => {
    const tagEventSnapshots: string[][] = []

    window.addEventListener(TAGS_CHANGE_EVENT, () => {
      tagEventSnapshots.push(getAllTags())
    })

    expect(getRepoTags("schema-labs-ltd/discofork")).toEqual([])

    setRepoTags("schema-labs-ltd/discofork", [" Ops ", "bug", "ops", ""])
    expect(getRepoTags("schema-labs-ltd/discofork")).toEqual(["bug", "ops"])

    setRepoTags("schema-labs-ltd/discofork", ["bug", "ops"])
    expect(tagEventSnapshots).toEqual([["bug", "ops"]])

    expect(addTag("schema-labs-ltd/discofork", "BUG")).toEqual(["bug", "ops"])
    expect(addTag("schema-labs-ltd/discofork", "release")).toEqual(["bug", "ops", "release"])

    setRepoTags("openai/codex", ["bug", "ai"])

    expect(getAllTags()).toEqual(["ai", "bug", "ops", "release"])
    expect(getReposByTag("bug")).toEqual(["openai/codex", "schema-labs-ltd/discofork"])

    expect(removeTag("schema-labs-ltd/discofork", "bug")).toEqual(["ops", "release"])
    expect(removeTag("schema-labs-ltd/discofork", "ops")).toEqual(["release"])
    expect(removeTag("schema-labs-ltd/discofork", "release")).toEqual([])
    expect(getRepoTags("schema-labs-ltd/discofork")).toEqual([])
    expect(getReposByTag("release")).toEqual([])
    expect(tagEventSnapshots).toEqual([
      ["bug", "ops"],
      ["bug", "ops", "release"],
      ["ai", "bug", "ops", "release"],
      ["ai", "bug", "ops", "release"],
      ["ai", "bug", "release"],
      ["ai", "bug"],
    ])
  })

  test("tags page route and shared navigation wire the new collection view into the UI", () => {
    const pageSource = readFileSync(new URL("../web/src/app/tags/page.tsx", import.meta.url), "utf8")
    const shellSource = readFileSync(new URL("../web/src/components/repo-shell.tsx", import.meta.url), "utf8")

    expect(pageSource).toContain('eyebrow="Tags"')
    expect(pageSource).toContain('href={`/${owner}/${repo}`}')
    expect(pageSource).toContain("Select a tag above to view the repositories saved under it.")
    expect(shellSource).toContain('href="/tags"')
    expect(shellSource).toContain("Tags")
  })
})
