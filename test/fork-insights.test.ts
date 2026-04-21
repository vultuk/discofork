import { describe, expect, test } from "bun:test"

import {
  buildVisitorGoalCards,
  filterForksByQuery,
  getForkFeatureSignalCount,
  getForkRiskSignalCount,
  getForkTopPositive,
  getForkTopRisk,
  rankForksByScore,
} from "../web/src/lib/fork-insights"
import type { CachedForkView, RepoRecommendationSet } from "../web/src/lib/repository-service"

const forks: CachedForkView[] = [
  {
    fullName: "schema/safe-fork",
    maintenance: "active",
    changeMagnitude: "minor divergence",
    summary: "Keeps close to upstream with a polished deployment path.",
    likelyPurpose: "Provide a safer default for production adopters.",
    bestFor: "Teams that want predictability.",
    additionalFeatures: ["Adds deployment presets."],
    missingFeatures: ["Does not expand reporting."],
    strengths: ["Healthy maintenance cadence."],
    risks: ["Could feel conservative for ambitious teams."],
  },
  {
    fullName: "schema/feature-fork",
    maintenance: "active",
    changeMagnitude: "moderate divergence",
    summary: "Adds workflow automation and richer exports.",
    likelyPurpose: "Push the product toward a more capable platform.",
    bestFor: "Teams that want more capability quickly.",
    additionalFeatures: ["Workflow automation.", "Export bundles."],
    missingFeatures: [],
    strengths: ["Broader feature surface.", "Good operator ergonomics."],
    risks: ["More merge debt than the safer fork."],
  },
  {
    fullName: "schema/bold-fork",
    maintenance: "slowing",
    changeMagnitude: "significant divergence",
    summary: "A dramatic rewrite for experimental users.",
    likelyPurpose: "Explore a different product direction.",
    bestFor: "Teams willing to own a larger downstream delta.",
    additionalFeatures: ["Experimental interface."],
    missingFeatures: ["Less upstream alignment."],
    strengths: [],
    risks: ["Maintenance posture is weaker."],
  },
]

const recommendations: RepoRecommendationSet = {
  bestMaintained: "schema/safe-fork",
  closestToUpstream: "schema/safe-fork",
  mostFeatureRich: "schema/feature-fork",
  mostOpinionated: "schema/bold-fork",
}

describe("fork insights helpers", () => {
  test("buildVisitorGoalCards resolves recommendation targets into fork records", () => {
    const cards = buildVisitorGoalCards(recommendations, forks)

    expect(cards.map((card) => card.key)).toEqual([
      "bestMaintained",
      "closestToUpstream",
      "mostFeatureRich",
      "mostOpinionated",
    ])
    expect(cards[0].fork?.fullName).toBe("schema/safe-fork")
    expect(cards[2].fork?.fullName).toBe("schema/feature-fork")
    expect(cards[3].fork?.fullName).toBe("schema/bold-fork")
  })

  test("filterForksByQuery searches summaries, strengths, and risks case-insensitively", () => {
    expect(filterForksByQuery(forks, "operator ergonomics").map((fork) => fork.fullName)).toEqual([
      "schema/feature-fork",
    ])
    expect(filterForksByQuery(forks, "MAINTENANCE posture").map((fork) => fork.fullName)).toEqual([
      "schema/bold-fork",
    ])
    expect(filterForksByQuery(forks, "   ").map((fork) => fork.fullName)).toEqual(forks.map((fork) => fork.fullName))
  })

  test("rankForksByScore orders forks from strongest to weakest signal", () => {
    expect(rankForksByScore(forks).map((fork) => fork.fullName)).toEqual([
      "schema/safe-fork",
      "schema/feature-fork",
      "schema/bold-fork",
    ])
  })

  test("signal helpers surface useful positive and risk summaries", () => {
    expect(getForkFeatureSignalCount(forks[1])).toBe(4)
    expect(getForkRiskSignalCount(forks[1])).toBe(1)
    expect(getForkTopPositive(forks[1])).toBe("Workflow automation.")
    expect(getForkTopRisk(forks[0])).toBe("Could feel conservative for ambitious teams.")
  })
})
