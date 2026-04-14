import { describe, expect, test } from "bun:test"

import {
  getDefaultQuickJumpSuggestionIndex,
  getNextQuickJumpSuggestionIndex,
  resolveQuickJumpTarget,
} from "../web/src/lib/quick-jump"
import { filterRepoLauncherSuggestions, mergeRepoLauncherSuggestions } from "../web/src/lib/repo-launcher"

const suggestions = mergeRepoLauncherSuggestions({
  history: [
    { owner: "openai", repo: "codex", visitedAt: "2026-04-14T20:00:00Z" },
    { owner: "vercel", repo: "next.js", visitedAt: "2026-04-14T21:00:00Z" },
  ],
  bookmarks: [{ owner: "openai", repo: "codex", bookmarkedAt: "2026-04-12T08:00:00Z" }],
  watches: [{ owner: "schema-labs-ltd", repo: "discofork", watchedAt: "2026-04-10T08:00:00Z", lastVisitedAt: "2026-04-14T22:00:00Z" }],
  limit: 6,
})

describe("quick jump launcher helpers", () => {
  test("reuses repo-launcher parsing for direct submissions", () => {
    expect(resolveQuickJumpTarget("openai/codex", suggestions, 0)).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(resolveQuickJumpTarget("https://github.com/openai/codex/tree/main", suggestions, 0)).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(resolveQuickJumpTarget("https://discofork.ai/openai/codex?fork=schema-labs-ltd/discofork", suggestions, 0)).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(resolveQuickJumpTarget("https://discofork.ai/.well-known/nodeinfo", suggestions, -1)).toBeNull()
  })

  test("lets an explicit suggestion selection override a valid parsed target", () => {
    expect(resolveQuickJumpTarget("openai/codex", suggestions, 1)).toMatchObject({
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(resolveQuickJumpTarget("openai/codex", suggestions, 1, { preferActiveSuggestion: true })).toMatchObject({
      fullName: "schema-labs-ltd/discofork",
      canonicalPath: "/schema-labs-ltd/discofork",
    })
  })

  test("falls back to the active quick-reopen suggestion for filter-only input", () => {
    const filteredSuggestions = filterRepoLauncherSuggestions(suggestions, "next")

    expect(resolveQuickJumpTarget("next", filteredSuggestions, 0)).toMatchObject({
      fullName: "vercel/next.js",
      canonicalPath: "/vercel/next.js",
    })
  })

  test("defaults to the first suggestion only when the input is not already a valid repo target", () => {
    expect(getDefaultQuickJumpSuggestionIndex(suggestions, "")).toBe(0)
    expect(getDefaultQuickJumpSuggestionIndex(suggestions, "next")).toBe(0)
    expect(getDefaultQuickJumpSuggestionIndex(suggestions, "openai/codex")).toBe(-1)
    expect(getDefaultQuickJumpSuggestionIndex(suggestions, "https://github.com/openai/codex/tree/main")).toBe(-1)
    expect(getDefaultQuickJumpSuggestionIndex([], "next")).toBe(-1)
  })

  test("cycles keyboard selection through the suggestion list", () => {
    expect(getNextQuickJumpSuggestionIndex(-1, suggestions.length, "next")).toBe(0)
    expect(getNextQuickJumpSuggestionIndex(0, suggestions.length, "previous")).toBe(suggestions.length - 1)
    expect(getNextQuickJumpSuggestionIndex(suggestions.length - 1, suggestions.length, "next")).toBe(0)
    expect(getNextQuickJumpSuggestionIndex(1, suggestions.length, "previous")).toBe(0)
    expect(getNextQuickJumpSuggestionIndex(0, 0, "next")).toBe(-1)
  })
})
