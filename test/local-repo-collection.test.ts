import { describe, expect, test } from "bun:test"

import {
  filterLocalRepoCollection,
  summarizeLocalRepoCollection,
  type LocalRepoCollectionEntry,
} from "../web/src/lib/local-repo-collection"

const entries: LocalRepoCollectionEntry[] = [
  {
    fullName: "openai/codex",
    owner: "openai",
    repo: "codex",
    savedAt: "2026-04-16T20:00:00Z",
    secondaryLabel: "Viewed 5m ago",
  },
  {
    fullName: "vercel/next.js",
    owner: "vercel",
    repo: "next.js",
    savedAt: "2026-04-16T19:00:00Z",
    secondaryLabel: "Bookmarked Apr 16",
  },
  {
    fullName: "grafana/grafana",
    owner: "grafana",
    repo: "grafana",
    savedAt: "2026-04-15T12:00:00Z",
    secondaryLabel: "Watching for updates",
  },
]

describe("local repo collection helpers", () => {
  test("filters by owner, repo, or full name case-insensitively", () => {
    expect(filterLocalRepoCollection(entries, "NEXT").map((entry) => entry.fullName)).toEqual(["vercel/next.js"])
    expect(filterLocalRepoCollection(entries, "grafana/grafana").map((entry) => entry.fullName)).toEqual(["grafana/grafana"])
    expect(filterLocalRepoCollection(entries, "")).toEqual(entries)
  })

  test("summarizes filtered results for the page header copy", () => {
    expect(summarizeLocalRepoCollection(3, 3, "")).toBe("3 repositories")
    expect(summarizeLocalRepoCollection(1, 3, "next")).toBe('1 match for “next”')
    expect(summarizeLocalRepoCollection(0, 3, "missing")).toBe('0 matches for “missing”')
  })
})
