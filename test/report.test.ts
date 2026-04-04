import { describe, expect, test } from "bun:test"

import type { FinalReport } from "../src/core/types.ts"
import { renderMarkdownReport } from "../src/services/report.ts"

const report: FinalReport = {
  generatedAt: "2026-03-29T12:00:00Z",
  repository: {
    owner: "example",
    name: "repo",
    fullName: "example/repo",
    url: "https://github.com/example/repo",
    cloneUrl: "https://github.com/example/repo.git",
  },
  upstream: {
    metadata: {
      fullName: "example/repo",
      description: "A repo",
      homepageUrl: null,
      defaultBranch: "main",
      isArchived: false,
      forkCount: 10,
      stargazerCount: 20,
      pushedAt: "2026-03-28T12:00:00Z",
      updatedAt: "2026-03-28T12:00:00Z",
    },
    topLevelEntries: ["README.md", "src"],
    topDirectories: ["src"],
    topFiles: ["README.md"],
    readmeExcerpt: "# Repo",
    manifestFiles: [],
    nestedManifestFiles: [],
    workspaceSignals: [],
    workspaceDirectories: [],
    recentCommits: [],
    detectedTech: ["TypeScript"],
    analysis: {
      summary: "Upstream summary",
      capabilities: ["CLI"],
      targetUsers: ["Developers"],
      architectureNotes: ["TS"],
      evidence: ["README"],
    },
  },
  discovery: {
    totalForkCount: 10,
    scannedForkCount: 2,
    archivedExcluded: 1,
    unchangedExcluded: 1,
    selectionWarning: null,
  },
  forks: [
    {
      metadata: {
        fullName: "forks/one",
        description: "Fork one",
        homepageUrl: null,
        defaultBranch: "main",
        isArchived: false,
        forkCount: 0,
        stargazerCount: 3,
        pushedAt: "2026-03-27T12:00:00Z",
        updatedAt: "2026-03-27T12:00:00Z",
        sourceFullName: "forks/one",
        parentFullName: "example/repo",
        createdAt: null,
        archivedAt: null,
        comparisonStatus: "ahead",
        aheadBy: 3,
        behindBy: 1,
        hasChanges: true,
        pushedDaysAgo: 2,
        score: 30,
        scoreReasons: ["recently pushed"],
        defaultSelected: true,
      },
      diffFacts: {
        mergeBase: "abc",
        aheadCount: 3,
        behindCount: 1,
        changedFiles: 4,
        insertions: 10,
        deletions: 2,
        renamedFiles: 0,
        topChangedPaths: [],
        topChangedDirectories: [],
        uniqueCommits: [],
        fileKinds: [],
        sampleFileSummaries: [],
      },
      analysis: {
        fork: "forks/one",
        maintenance: "active",
        changeMagnitude: "minor",
        likelyPurpose: "Adds features",
        changeCategories: ["features"],
        additionalFeatures: ["Adds plugin hooks"],
        missingFeatures: [],
        strengths: ["Active"],
        risks: ["Small maintainer base"],
        idealUsers: ["Power users"],
        decisionSummary: "Good default fork",
        confidence: "medium",
        evidence: ["Ahead 3", "Recent push"],
      },
    },
  ],
  recommendations: {
    bestMaintained: "forks/one",
    closestToUpstream: "forks/one",
    mostFeatureRich: "forks/one",
    mostOpinionated: null,
  },
}

describe("renderMarkdownReport", () => {
  test("renders a concise decision-oriented report", () => {
    const markdown = renderMarkdownReport(report)
    expect(markdown).toContain("# Discofork Report: example/repo")
    expect(markdown).toContain("Best maintained: forks/one")
    expect(markdown).toContain("Decision summary: Good default fork")
  })

  test("renders an upstream-only report when all selected forks were skipped", () => {
    const markdown = renderMarkdownReport({
      ...report,
      discovery: {
        ...report.discovery,
        selectionWarning: "2 selected forks could not be analysed and were skipped.",
      },
      forks: [],
      recommendations: {
        bestMaintained: null,
        closestToUpstream: null,
        mostFeatureRich: null,
        mostOpinionated: null,
      },
    })

    expect(markdown).toContain("Note: 2 selected forks could not be analysed and were skipped.")
    expect(markdown).toContain("No fork analyses were completed for this run.")
  })
})
