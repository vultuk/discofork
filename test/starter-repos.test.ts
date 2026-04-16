import { describe, expect, test } from "bun:test"

import {
  buildStarterRepoLookup,
  getStarterRepoCards,
  getStarterRepoCollections,
} from "../web/src/lib/starter-repos"

describe("starter repo launchpad", () => {
  test("returns curated collections with stable labels and starter cards", () => {
    const collections = getStarterRepoCollections()

    expect(collections.length).toBeGreaterThanOrEqual(3)
    expect(collections.map((collection) => collection.slug)).toEqual(["ai-tooling", "developer-tools", "infrastructure"])
    expect(collections.every((collection) => collection.repos.length >= 2)).toBe(true)
  })

  test("flattens starter repo cards in collection order for quick empty-state rendering", () => {
    const cards = getStarterRepoCards(4)

    expect(cards).toHaveLength(4)
    expect(cards.map((card) => card.fullName)).toEqual([
      "openai/codex",
      "anthropics/claude-code",
      "vercel/next.js",
      "oven-sh/bun",
    ])
  })

  test("builds a direct lookup by full repo name for compare and queue shortcuts", () => {
    const lookup = buildStarterRepoLookup()

    expect(lookup["openai/codex"]).toMatchObject({
      owner: "openai",
      repo: "codex",
      collectionSlug: "ai-tooling",
    })
    expect(lookup["grafana/grafana"]).toMatchObject({
      collectionSlug: "infrastructure",
    })
  })
})
