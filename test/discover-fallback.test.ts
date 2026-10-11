import { describe, expect, test } from "bun:test"

import type { RepoLauncherSuggestion } from "../web/src/lib/repo-launcher"
import { buildDiscoverFallbackEntries } from "../web/src/lib/discover-fallback"

const suggestions: RepoLauncherSuggestion[] = [
  {
    owner: "openai",
    repo: "codex",
    fullName: "openai/codex",
    canonicalPath: "/openai/codex",
    sources: ["recent"],
    lastTouchedAt: "2026-04-16T20:00:00Z",
  },
  {
    owner: "vercel",
    repo: "next.js",
    fullName: "vercel/next.js",
    canonicalPath: "/vercel/next.js",
    sources: ["bookmarked", "recent"],
    lastTouchedAt: "2026-04-16T21:00:00Z",
  },
]

describe("discover fallback entries", () => {
  test("limits the local fallback cards while preserving suggestion metadata", () => {
    expect(buildDiscoverFallbackEntries(suggestions, 1)).toEqual([
      {
        owner: "openai",
        repo: "codex",
        fullName: "openai/codex",
        canonicalPath: "/openai/codex",
        sources: ["recent"],
        lastTouchedAt: "2026-04-16T20:00:00Z",
      },
    ])
  })

  test("returns an empty fallback when no suggestions are available", () => {
    expect(buildDiscoverFallbackEntries([], 6)).toEqual([])
  })
})
