import { describe, expect, test } from "bun:test"

import {
  filterRepoLauncherSuggestions,
  mergeRepoLauncherSuggestions,
  parseRepoLauncherInput,
} from "../web/src/lib/repo-launcher"

describe("repo launcher parsing", () => {
  test("accepts owner repo strings and pasted URL variants", () => {
    expect(parseRepoLauncherInput("openai/codex")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(parseRepoLauncherInput("https://github.com/openai/codex/tree/main")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(parseRepoLauncherInput("https://discofork.ai/openai/codex?fork=foo/bar")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(parseRepoLauncherInput("github.com/openai/codex.git?tab=readme-ov-file")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(parseRepoLauncherInput("git@github.com:openai/codex.git")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
    })

    expect(parseRepoLauncherInput("(https://github.com/vercel/next.js).")).toEqual({
      owner: "vercel",
      repo: "next.js",
      fullName: "vercel/next.js",
      canonicalPath: "/vercel/next.js",
    })
  })

  test("rejects malformed or suspicious inputs", () => {
    expect(parseRepoLauncherInput("openai")).toBeNull()
    expect(parseRepoLauncherInput("https://example.com/openai/codex")).toBeNull()
    expect(parseRepoLauncherInput(".well-known/nodeinfo")).toBeNull()
    expect(parseRepoLauncherInput("admin/.env")).toBeNull()
    expect(parseRepoLauncherInput("https://discofork.ai/.well-known/nodeinfo")).toBeNull()
  })
})

describe("repo launcher suggestions", () => {
  test("merges history bookmarks and watches into ranked deduped suggestions", () => {
    const suggestions = mergeRepoLauncherSuggestions({
      history: [
        { owner: "openai", repo: "codex", visitedAt: "2026-04-14T20:00:00Z" },
        { owner: "schema-labs-ltd", repo: "discofork", visitedAt: "2026-04-14T21:00:00Z" },
      ],
      bookmarks: [
        { owner: "openai", repo: "codex", bookmarkedAt: "2026-04-12T08:00:00Z" },
      ],
      watches: [
        { owner: "schema-labs-ltd", repo: "discofork", watchedAt: "2026-04-10T08:00:00Z", lastVisitedAt: "2026-04-14T22:00:00Z" },
      ],
      limit: 5,
    })

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]).toMatchObject({
      fullName: "openai/codex",
      sources: ["bookmarked", "recent"],
    })
    expect(suggestions[1]).toMatchObject({
      fullName: "schema-labs-ltd/discofork",
      sources: ["watched", "recent"],
    })
  })

  test("filters suggestions against the current input", () => {
    const suggestions = mergeRepoLauncherSuggestions({
      history: [
        { owner: "openai", repo: "codex", visitedAt: "2026-04-14T20:00:00Z" },
        { owner: "vercel", repo: "next.js", visitedAt: "2026-04-14T21:00:00Z" },
      ],
      limit: 5,
    })

    expect(filterRepoLauncherSuggestions(suggestions, "next").map((entry) => entry.fullName)).toEqual(["vercel/next.js"])
    expect(filterRepoLauncherSuggestions(suggestions, "").map((entry) => entry.fullName)).toEqual([
      "vercel/next.js",
      "openai/codex",
    ])
  })
})
