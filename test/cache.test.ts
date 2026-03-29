import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { DiffFacts, ForkAnalysis, ForkMetadata, RepoFacts, RepoMetadata, UpstreamAnalysis } from "../src/core/types.ts"
import { loadForkCache, loadUpstreamCache, saveForkCache, saveUpstreamCache } from "../src/services/cache.ts"

let tempDir: string | null = null

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

const upstream: RepoMetadata = {
  fullName: "owner/repo",
  description: "Repo",
  homepageUrl: null,
  defaultBranch: "main",
  isArchived: false,
  forkCount: 5,
  stargazerCount: 10,
  pushedAt: "2026-03-29T10:00:00Z",
  updatedAt: "2026-03-29T10:05:00Z",
}

const repoFacts: RepoFacts = {
  metadata: upstream,
  topLevelEntries: ["README.md"],
  topDirectories: ["src"],
  topFiles: ["README.md"],
  readmeExcerpt: "hello",
  manifestFiles: [],
  recentCommits: [],
  detectedTech: ["TypeScript"],
}

const upstreamAnalysis: UpstreamAnalysis = {
  summary: "summary",
  capabilities: ["cap"],
  targetUsers: ["users"],
  architectureNotes: ["note"],
  evidence: ["evidence-1", "evidence-2"],
}

const fork: ForkMetadata = {
  fullName: "forks/repo",
  description: "Fork",
  homepageUrl: null,
  defaultBranch: "main",
  isArchived: false,
  forkCount: 0,
  stargazerCount: 2,
  pushedAt: "2026-03-29T10:10:00Z",
  updatedAt: "2026-03-29T10:11:00Z",
  sourceFullName: "forks/repo",
  parentFullName: "owner/repo",
  createdAt: null,
  archivedAt: null,
  comparisonStatus: "ahead",
  aheadBy: 3,
  behindBy: 1,
  hasChanges: true,
  pushedDaysAgo: 0,
  score: 20,
  scoreReasons: ["recently pushed"],
  defaultSelected: true,
}

const diffFacts: DiffFacts = {
  mergeBase: "abc",
  aheadCount: 3,
  behindCount: 1,
  changedFiles: 4,
  insertions: 20,
  deletions: 10,
  renamedFiles: 0,
  topChangedPaths: [],
  topChangedDirectories: [],
  uniqueCommits: [],
  fileKinds: [],
  sampleFileSummaries: [],
}

const forkAnalysis: ForkAnalysis = {
  fork: "forks/repo",
  maintenance: "active",
  changeMagnitude: "minor",
  likelyPurpose: "Testing",
  changeCategories: ["features"],
  strengths: ["strength"],
  risks: ["risk"],
  idealUsers: ["users"],
  decisionSummary: "summary",
  confidence: "medium",
  evidence: ["e1", "e2"],
}

describe("cache", () => {
  test("reuses matching upstream and fork cache entries", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "discofork-cache-"))
    const upstreamPath = path.join(tempDir, "upstream.json")
    const forkPath = path.join(tempDir, "fork.json")

    await saveUpstreamCache(upstreamPath, upstream, repoFacts, upstreamAnalysis)
    await saveForkCache(forkPath, fork, upstream, diffFacts, forkAnalysis)

    const cachedUpstream = await loadUpstreamCache(upstreamPath, upstream)
    const cachedFork = await loadForkCache(forkPath, fork, upstream)

    expect(cachedUpstream?.analysis.summary).toBe("summary")
    expect(cachedFork?.analysis.fork).toBe("forks/repo")
  })

  test("invalidates cache when upstream or fork freshness changes", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "discofork-cache-"))
    const upstreamPath = path.join(tempDir, "upstream.json")
    const forkPath = path.join(tempDir, "fork.json")

    await saveUpstreamCache(upstreamPath, upstream, repoFacts, upstreamAnalysis)
    await saveForkCache(forkPath, fork, upstream, diffFacts, forkAnalysis)

    const newerUpstream = {
      ...upstream,
      pushedAt: "2026-03-30T10:00:00Z",
    }
    const newerFork = {
      ...fork,
      updatedAt: "2026-03-30T11:00:00Z",
    }

    expect(await loadUpstreamCache(upstreamPath, newerUpstream)).toBeNull()
    expect(await loadForkCache(forkPath, newerFork, upstream)).toBeNull()
    expect(await loadForkCache(forkPath, fork, newerUpstream)).toBeNull()
  })
})
