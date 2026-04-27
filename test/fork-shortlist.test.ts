import { describe, expect, test } from "bun:test"

import {
  buildForkDecisionSummary,
  filterForksByShortlistProfile,
  generateForkShortlistMarkdown,
} from "../web/src/lib/fork-shortlist"
import type { CachedForkView } from "../web/src/lib/repository-service"

const forks: CachedForkView[] = [
  {
    fullName: "team/safe",
    maintenance: "active",
    changeMagnitude: "minor divergence",
    summary: "Small, healthy fork.",
    likelyPurpose: "Stay close to upstream.",
    bestFor: "Teams that want the safest adoption path.",
    additionalFeatures: ["Deployment presets."],
    missingFeatures: [],
    strengths: ["Healthy maintenance.", "Small merge surface."],
    risks: [],
  },
  {
    fullName: "team/platform",
    maintenance: "active",
    changeMagnitude: "moderate divergence",
    summary: "Adds richer product surface.",
    likelyPurpose: "Offer more workflow capability.",
    bestFor: "Teams that need more features.",
    additionalFeatures: ["Automation.", "Export bundles.", "Dashboard views."],
    missingFeatures: ["Less upstream alignment."],
    strengths: ["Strong operator ergonomics."],
    risks: ["Higher merge debt."],
  },
  {
    fullName: "team/rewrite",
    maintenance: "stale",
    changeMagnitude: "significant divergence",
    summary: "Ambitious but stale rewrite.",
    likelyPurpose: "Explore a different architecture.",
    bestFor: "Experimental users.",
    additionalFeatures: ["Different runtime."],
    missingFeatures: ["Missing upstream features."],
    strengths: [],
    risks: ["Stale maintenance.", "Large divergence."],
  },
]

describe("fork shortlist helpers", () => {
  test("buildForkDecisionSummary identifies the decision anchors", () => {
    const summary = buildForkDecisionSummary(forks)

    expect(summary.total).toBe(3)
    expect(summary.strongCandidates).toBe(2)
    expect(summary.reviewCandidates).toBe(0)
    expect(summary.higherRiskCandidates).toBe(1)
    expect(summary.bestOverall?.fullName).toBe("team/safe")
    expect(summary.lowestRisk?.fullName).toBe("team/safe")
    expect(summary.highestUpside?.fullName).toBe("team/platform")
  })

  test("filterForksByShortlistProfile narrows forks by visitor intent", () => {
    expect(filterForksByShortlistProfile(forks, "safe").map((fork) => fork.fullName)).toEqual([
      "team/safe",
      "team/platform",
    ])
    expect(filterForksByShortlistProfile(forks, "upside").map((fork) => fork.fullName)).toEqual([
      "team/safe",
      "team/platform",
    ])
    expect(filterForksByShortlistProfile(forks, "lowRisk").map((fork) => fork.fullName)).toEqual([
      "team/safe",
    ])
    expect(filterForksByShortlistProfile(forks, "tradeoffs").map((fork) => fork.fullName)).toEqual([
      "team/platform",
      "team/rewrite",
    ])
  })

  test("generateForkShortlistMarkdown exports ranked adoption notes", () => {
    const markdown = generateForkShortlistMarkdown(
      { fullName: "upstream/project", githubUrl: "https://github.com/upstream/project" },
      forks,
      2,
    )

    expect(markdown).toContain("# upstream/project fork shortlist")
    expect(markdown).toContain("### 1. team/safe")
    expect(markdown).toContain("### 2. team/platform")
    expect(markdown).toContain("Strongest signal")
    expect(markdown).not.toContain("team/rewrite")
  })
})
