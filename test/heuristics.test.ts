import { describe, expect, test } from "bun:test"

import type { DiffFacts, ForkAnalysis, ForkMetadata } from "../src/core/types.ts"
import { computeRecommendations, deriveMagnitude, scoreForkCandidate } from "../src/services/heuristics.ts"

const baseFork: ForkMetadata = {
  fullName: "owner/fork",
  description: "desc",
  homepageUrl: null,
  defaultBranch: "main",
  isArchived: false,
  forkCount: 0,
  stargazerCount: 10,
  pushedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sourceFullName: "owner/fork",
  parentFullName: "upstream/repo",
  createdAt: null,
  archivedAt: null,
  comparisonStatus: "ahead",
  aheadBy: 3,
  behindBy: 1,
  hasChanges: true,
  pushedDaysAgo: 2,
  score: 20,
  scoreReasons: ["recently pushed"],
  defaultSelected: true,
}

const baseDiff: DiffFacts = {
  mergeBase: "abc123",
  aheadCount: 3,
  behindCount: 1,
  changedFiles: 5,
  insertions: 50,
  deletions: 20,
  renamedFiles: 0,
  topChangedPaths: [],
  topChangedDirectories: [],
  uniqueCommits: [],
  fileKinds: [],
  sampleFileSummaries: [],
}

const baseAnalysis: ForkAnalysis = {
  fork: "owner/fork",
  maintenance: "active",
  changeMagnitude: "minor",
  likelyPurpose: "Testing",
  changeCategories: ["features"],
  strengths: ["A"],
  risks: ["B"],
  idealUsers: ["C"],
  decisionSummary: "D",
  confidence: "medium",
  evidence: ["E1", "E2"],
}

describe("heuristics", () => {
  test("scores fresh, starred forks higher", () => {
    const score = scoreForkCandidate({
      stargazerCount: 35,
      pushedDaysAgo: 10,
      isArchived: false,
      parentFullName: "upstream/repo",
    })

    expect(score.score).toBeGreaterThan(20)
    expect(score.reasons).toContain("recently pushed")
  })

  test("derives magnitude from diff size", () => {
    expect(deriveMagnitude(baseDiff)).toBe("minor")
    expect(
      deriveMagnitude({
        ...baseDiff,
        aheadCount: 140,
        changedFiles: 260,
        insertions: 9000,
        deletions: 12000,
      }),
    ).toBe("significant_divergence")
  })

  test("computes recommendation buckets", () => {
    const recommendations = computeRecommendations([
      {
        metadata: baseFork,
        diffFacts: baseDiff,
        analysis: baseAnalysis,
      },
      {
        metadata: {
          ...baseFork,
          fullName: "owner/opinionated",
          score: 100,
        },
        diffFacts: {
          ...baseDiff,
          aheadCount: 200,
          changedFiles: 400,
          insertions: 15000,
          deletions: 5000,
        },
        analysis: {
          ...baseAnalysis,
          fork: "owner/opinionated",
          changeCategories: ["architectural_experiment", "significant_divergence"],
        },
      },
    ])

    expect(recommendations.bestMaintained).toBe("owner/opinionated")
    expect(recommendations.closestToUpstream).toBe("owner/fork")
    expect(recommendations.mostOpinionated).toBe("owner/opinionated")
  })
})
