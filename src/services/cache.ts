import { readFile } from "node:fs/promises"

import type {
  DiffFacts,
  ForkAnalysis,
  ForkMetadata,
  RepoFacts,
  RepoMetadata,
  UpstreamAnalysis,
} from "../core/types.ts"
import { writeJson } from "../core/fs.ts"

type RepoSnapshot = {
  fullName: string
  defaultBranch: string
  pushedAt: string | null
  updatedAt: string | null
}

type UpstreamCacheEntry = {
  version: 1
  cachedAt: string
  upstream: RepoSnapshot
  repoFacts: RepoFacts
  analysis: UpstreamAnalysis
}

type ForkCacheEntry = {
  version: 1
  cachedAt: string
  upstream: RepoSnapshot
  fork: RepoSnapshot
  diffFacts: DiffFacts
  analysis: ForkAnalysis
}

function snapshot(metadata: RepoMetadata | ForkMetadata): RepoSnapshot {
  return {
    fullName: metadata.fullName,
    defaultBranch: metadata.defaultBranch,
    pushedAt: metadata.pushedAt,
    updatedAt: metadata.updatedAt,
  }
}

function sameSnapshot(left: RepoSnapshot, right: RepoSnapshot): boolean {
  return (
    left.fullName === right.fullName &&
    left.defaultBranch === right.defaultBranch &&
    left.pushedAt === right.pushedAt &&
    left.updatedAt === right.updatedAt
  )
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function loadUpstreamCache(
  filePath: string,
  upstream: RepoMetadata,
): Promise<UpstreamCacheEntry | null> {
  const entry = await readJsonFile<UpstreamCacheEntry>(filePath)
  if (!entry || entry.version !== 1) {
    return null
  }

  return sameSnapshot(entry.upstream, snapshot(upstream)) ? entry : null
}

export async function saveUpstreamCache(
  filePath: string,
  upstream: RepoMetadata,
  repoFacts: RepoFacts,
  analysis: UpstreamAnalysis,
): Promise<void> {
  await writeJson(filePath, {
    version: 1,
    cachedAt: new Date().toISOString(),
    upstream: snapshot(upstream),
    repoFacts,
    analysis,
  } satisfies UpstreamCacheEntry)
}

export async function loadForkCache(
  filePath: string,
  fork: ForkMetadata,
  upstream: RepoMetadata,
): Promise<ForkCacheEntry | null> {
  const entry = await readJsonFile<ForkCacheEntry>(filePath)
  if (!entry || entry.version !== 1) {
    return null
  }

  return sameSnapshot(entry.upstream, snapshot(upstream)) && sameSnapshot(entry.fork, snapshot(fork))
    ? entry
    : null
}

export async function saveForkCache(
  filePath: string,
  fork: ForkMetadata,
  upstream: RepoMetadata,
  diffFacts: DiffFacts,
  analysis: ForkAnalysis,
): Promise<void> {
  await writeJson(filePath, {
    version: 1,
    cachedAt: new Date().toISOString(),
    upstream: snapshot(upstream),
    fork: snapshot(fork),
    diffFacts,
    analysis,
  } satisfies ForkCacheEntry)
}
