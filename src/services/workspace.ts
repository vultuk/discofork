import path from "node:path"

import type { GitHubRepoRef } from "../core/types.ts"
import { ensureDir, sanitizeSegment } from "../core/fs.ts"

export type WorkspacePaths = {
  root: string
  cacheRoot: string
  repoCacheRoot: string
  reposRoot: string
  runsRoot: string
  runRoot: string
  logsRoot: string
  reportsRoot: string
  codexRoot: string
  upstreamRepoDir: string
  upstreamCachePath: string
  forkRepoDir: (fullName: string) => string
  forkCachePath: (fullName: string) => string
}

export async function createWorkspacePaths(
  root: string,
  repo: GitHubRepoRef,
  runId: string,
): Promise<WorkspacePaths> {
  const cacheRoot = path.join(root, "cache")
  const repoCacheRoot = path.join(cacheRoot, sanitizeSegment(repo.fullName))
  const reposRoot = path.join(root, "repos", sanitizeSegment(repo.fullName))
  const runsRoot = path.join(root, "runs")
  const runRoot = path.join(runsRoot, runId)
  const logsRoot = path.join(root, "logs")
  const reportsRoot = path.join(runRoot, "reports")
  const codexRoot = path.join(runRoot, "codex")
  const upstreamRepoDir = path.join(reposRoot, "upstream")
  const upstreamCachePath = path.join(repoCacheRoot, "upstream.json")

  await Promise.all([
    ensureDir(root),
    ensureDir(cacheRoot),
    ensureDir(repoCacheRoot),
    ensureDir(reposRoot),
    ensureDir(runsRoot),
    ensureDir(runRoot),
    ensureDir(logsRoot),
    ensureDir(reportsRoot),
    ensureDir(codexRoot),
  ])

  return {
    root,
    cacheRoot,
    repoCacheRoot,
    reposRoot,
    runsRoot,
    runRoot,
    logsRoot,
    reportsRoot,
    codexRoot,
    upstreamRepoDir,
    upstreamCachePath,
    forkRepoDir: (fullName: string) => path.join(reposRoot, "forks", sanitizeSegment(fullName)),
    forkCachePath: (fullName: string) => path.join(repoCacheRoot, "forks", `${sanitizeSegment(fullName)}.json`),
  }
}
