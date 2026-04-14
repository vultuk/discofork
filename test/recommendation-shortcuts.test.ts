import { describe, expect, test } from "bun:test"

import { buildRecommendationShortcuts } from "../web/src/lib/recommendation-shortcuts"

describe("recommendation shortcuts", () => {
  test("keeps every recommendation label actionable when the fork exists", () => {
    const result = buildRecommendationShortcuts(
      {
        bestMaintained: "owner/best",
        closestToUpstream: "owner/closest",
        mostFeatureRich: "owner/rich",
        mostOpinionated: "owner/opinionated",
      },
      [
        { fullName: "owner/best" },
        { fullName: "owner/closest" },
        { fullName: "owner/rich" },
        { fullName: "owner/opinionated" },
      ],
    )

    expect(result.shortcuts.map((shortcut) => shortcut.label)).toEqual([
      "Best maintained",
      "Closest to upstream",
      "Most feature-rich",
      "Most opinionated",
    ])
    expect(result.shortcuts.every((shortcut) => shortcut.available)).toBe(true)
    expect(result.compareShortcut).toEqual({
      leftKey: "bestMaintained",
      rightKey: "mostFeatureRich",
      label: "Compare Best maintained vs Most feature-rich",
      forkPair: ["owner/best", "owner/rich"],
    })
  })

  test("falls back to another high-signal compare pair when the top pair is duplicated", () => {
    const result = buildRecommendationShortcuts(
      {
        bestMaintained: "owner/shared",
        closestToUpstream: "owner/closest",
        mostFeatureRich: "owner/shared",
        mostOpinionated: "owner/opinionated",
      },
      [
        { fullName: "owner/shared" },
        { fullName: "owner/closest" },
        { fullName: "owner/opinionated" },
      ],
    )

    expect(result.compareShortcut).toEqual({
      leftKey: "bestMaintained",
      rightKey: "mostOpinionated",
      label: "Compare Best maintained vs Most opinionated",
      forkPair: ["owner/shared", "owner/opinionated"],
    })
  })

  test("falls back to an available compare pair when preferred recommendations are missing", () => {
    const result = buildRecommendationShortcuts(
      {
        bestMaintained: "owner/missing-best",
        closestToUpstream: "owner/closest",
        mostFeatureRich: "owner/missing-rich",
        mostOpinionated: "owner/opinionated",
      },
      [
        { fullName: "owner/closest" },
        { fullName: "owner/opinionated" },
      ],
    )

    expect(result.shortcuts).toEqual([
      {
        key: "bestMaintained",
        label: "Best maintained",
        forkName: "owner/missing-best",
        available: false,
      },
      {
        key: "closestToUpstream",
        label: "Closest to upstream",
        forkName: "owner/closest",
        available: true,
      },
      {
        key: "mostFeatureRich",
        label: "Most feature-rich",
        forkName: "owner/missing-rich",
        available: false,
      },
      {
        key: "mostOpinionated",
        label: "Most opinionated",
        forkName: "owner/opinionated",
        available: true,
      },
    ])
    expect(result.compareShortcut).toEqual({
      leftKey: "closestToUpstream",
      rightKey: "mostOpinionated",
      label: "Compare Closest to upstream vs Most opinionated",
      forkPair: ["owner/closest", "owner/opinionated"],
    })
  })
})
