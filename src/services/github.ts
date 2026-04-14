import { z } from "zod"

import { AppError } from "../core/errors.ts"
import type { DiscoveryResult, ForkMetadata, GitHubRepoRef, RepoMetadata } from "../core/types.ts"
import type { Logger } from "../core/logger.ts"
import { compareForksForSelection, daysSince, recommendForks, scoreForkCandidate } from "./heuristics.ts"
import { runGitHubCommand } from "./github-command.ts"
import { runCommand } from "./command.ts"
import { describeSuspiciousRepoInputCore } from "../core/suspicious-repo-patterns.ts"


const repoViewSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable().optional(),
  homepage: z.string().nullable().optional(),
  default_branch: z.string().nullable().optional(),
  archived: z.boolean(),
  forks_count: z.number().int(),
  stargazers_count: z.number().int(),
  pushed_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

const forkSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable().optional(),
  homepage: z.string().nullable().optional(),
  default_branch: z.string(),
  archived: z.boolean(),
  forks_count: z.number().int().optional(),
  stargazers_count: z.number().int(),
  pushed_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
  parent: z
    .object({
      full_name: z.string(),
    })
    .nullable()
    .optional(),
  source: z
    .object({
      full_name: z.string(),
    })
    .nullable()
    .optional(),
})

type ForkHeadState = {
  sha: string
  hasChanges: boolean
}

type DiscoveryProgressHandler = (message: string) => void
const REPO_HEAD_TIMEOUT_MS = 8000
const supportedGitHubRepoHosts = new Set(["github.com", "www.github.com"])

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const results = new Array<R>(items.length)
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

function isSupportedGitHubRepoHost(hostname: string): boolean {
  return supportedGitHubRepoHosts.has(hostname.toLowerCase())
}

export function parseGitHubRepoInput(input: string): GitHubRepoRef {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new AppError("INVALID_REPO", "Please provide a GitHub repository URL or owner/name.")
  }

  const normalized = trimmed.replace(/\.git$/i, "")
  const shorthandMatch = normalized.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shorthandMatch) {
    const [, owner = "", name = ""] = shorthandMatch
    return {
      owner,
      name,
      fullName: `${owner}/${name}`,
      url: `https://github.com/${owner}/${name}`,
      cloneUrl: `https://github.com/${owner}/${name}.git`,
    }
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new AppError("INVALID_REPO", "Repository must be a GitHub URL or owner/name.")
  }

  if (!isSupportedGitHubRepoHost(url.hostname)) {
    throw new AppError("INVALID_REPO", "Only github.com repository URLs are supported.")
  }

  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 2) {
    throw new AppError("INVALID_REPO", "Repository URL must include owner and repository name.")
  }

  const owner = parts[0]!
  const name = parts[1]!
  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
    cloneUrl: `https://github.com/${owner}/${name}.git`,
  }
}


export function describeSuspiciousRepoInput(repo: GitHubRepoRef): string | null {
  return describeSuspiciousRepoInputCore(repo.owner, repo.name)
}

async function probeGitHubRepositoryHeadStatus(repo: GitHubRepoRef): Promise<number | null> {
  try {
    const response = await fetch(repo.url, {
      method: "HEAD",
      headers: {
        Accept: "text/html",
        "user-agent": "discofork-worker-validation",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REPO_HEAD_TIMEOUT_MS),
    })

    return response.status
  } catch {
    return null
  }
}

export async function assertWorkerRepoInputIsActionable(input: string): Promise<GitHubRepoRef> {
  const repo = parseGitHubRepoInput(input)
  const suspiciousReason = describeSuspiciousRepoInput(repo)
  if (suspiciousReason) {
    throw new AppError(
      "INVALID_REPO_QUEUE_INPUT",
      `Queued input does not look like a GitHub repository: ${repo.fullName}. ${suspiciousReason}`,
      { fullName: repo.fullName },
    )
  }

  const headStatus = await probeGitHubRepositoryHeadStatus(repo)
  if (headStatus === 404) {
    throw new AppError(
      "INVALID_REPO_QUEUE_INPUT",
      `Queued input does not resolve to a GitHub repository: ${repo.fullName}.`,
      { fullName: repo.fullName },
    )
  }

  return repo
}

function toRepoMetadata(parsed: z.infer<typeof repoViewSchema>): RepoMetadata {
  return {
    fullName: parsed.full_name,
    description: parsed.description ?? null,
    homepageUrl: parsed.homepage ?? null,
    defaultBranch: parsed.default_branch ?? "main",
    isArchived: parsed.archived,
    forkCount: parsed.forks_count,
    stargazerCount: parsed.stargazers_count,
    pushedAt: parsed.pushed_at ?? null,
    updatedAt: parsed.updated_at ?? null,
  }
}

export function parseLsRemoteHeadSha(output: string): string | null {
  const line = output
    .split("\n")
    .map((entry) => entry.trim())
    .find(Boolean)

  if (!line) {
    return null
  }

  const [sha = ""] = line.split(/\s+/, 1)
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null
}

async function fetchRemoteBranchHeadSha(
  cloneUrl: string,
  branch: string,
  logger?: Logger,
): Promise<string | null> {
  const result = await runCommand(
    {
      command: "git",
      args: ["ls-remote", "--heads", cloneUrl, `refs/heads/${branch}`],
    },
    { logger, allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return null
  }

  return parseLsRemoteHeadSha(result.stdout)
}

async function fetchForkHeadState(
  upstreamHeadSha: string,
  fork: ForkMetadata,
  logger?: Logger,
): Promise<ForkHeadState | null> {
  const headSha = await fetchRemoteBranchHeadSha(`https://github.com/${fork.fullName}.git`, fork.defaultBranch, logger)
  if (!headSha) {
    await logger?.warn("fork_compare:failed", {
      fork: fork.fullName,
      defaultBranch: fork.defaultBranch,
    })
    return null
  }

  return {
    sha: headSha,
    hasChanges: headSha !== upstreamHeadSha,
  }
}

async function enrichForkComparisons(
  upstreamHeadSha: string,
  forks: ForkMetadata[],
  logger?: Logger,
  onProgress?: DiscoveryProgressHandler,
): Promise<{
  forks: ForkMetadata[]
  comparedForkCount: number
  unchangedExcluded: number
}> {
  let completed = 0
  let unchangedExcluded = 0

  const comparedForks = await mapWithConcurrency<ForkMetadata, ForkMetadata | null>(forks, 6, async (fork) => {
    const comparison = await fetchForkHeadState(upstreamHeadSha, fork, logger)
    completed += 1
    onProgress?.(`Discovering forks (${completed}/${forks.length} compared in this batch)`)

    if (!comparison) {
      return {
        ...fork,
        comparisonStatus: null,
        aheadBy: null,
        behindBy: null,
        hasChanges: true,
      } satisfies ForkMetadata
    }

    if (!comparison.hasChanges) {
      unchangedExcluded += 1
      return null
    }

    return {
      ...fork,
      comparisonStatus: comparison.sha,
      aheadBy: null,
      behindBy: null,
      hasChanges: comparison.hasChanges,
    } satisfies ForkMetadata
  })

  return {
    forks: comparedForks.filter((fork): fork is ForkMetadata => fork !== null),
    comparedForkCount: forks.length,
    unchangedExcluded,
  }
}

export async function fetchRepoMetadata(repo: GitHubRepoRef, logger?: Logger): Promise<RepoMetadata> {
  const result = await runGitHubCommand(
    {
      command: "gh",
      args: ["api", `repos/${repo.fullName}`],
    },
    { logger },
  )

  const parsed = repoViewSchema.parse(JSON.parse(result.stdout))
  return toRepoMetadata(parsed)
}

async function fetchForkSlice(
  repo: GitHubRepoRef,
  sort: "newest" | "stargazers",
  page: number,
  perPage: number,
  logger?: Logger,
): Promise<ForkMetadata[]> {
  const result = await runGitHubCommand(
    {
      command: "gh",
      args: ["api", `repos/${repo.fullName}/forks?sort=${sort}&per_page=${perPage}&page=${page}`],
    },
    { logger },
  )

  const parsed = z.array(forkSchema).parse(JSON.parse(result.stdout))
  return parsed.map((fork) => {
    const pushedDaysAgo = daysSince(fork.pushed_at ?? null)
    const scored = scoreForkCandidate({
      stargazerCount: fork.stargazers_count,
      pushedDaysAgo,
      isArchived: fork.archived,
      parentFullName: fork.parent?.full_name ?? null,
    })

    return {
      fullName: fork.full_name,
      description: fork.description ?? null,
      homepageUrl: fork.homepage ?? null,
      defaultBranch: fork.default_branch,
      isArchived: fork.archived,
      forkCount: fork.forks_count ?? 0,
      stargazerCount: fork.stargazers_count,
      pushedAt: fork.pushed_at ?? null,
      updatedAt: fork.updated_at ?? null,
      sourceFullName: fork.source?.full_name ?? fork.full_name,
      parentFullName: fork.parent?.full_name ?? null,
      createdAt: fork.created_at ?? null,
      archivedAt: fork.archived_at ?? null,
      comparisonStatus: null,
      aheadBy: null,
      behindBy: null,
      hasChanges: null,
      pushedDaysAgo,
      score: scored.score,
      scoreReasons: scored.reasons,
      defaultSelected: false,
    }
  })
}

export async function discoverForks(
  repo: GitHubRepoRef,
  options: {
    includeArchived: boolean
    forkScanLimit: number
    recommendedForkLimit: number
  },
  logger?: Logger,
  onProgress?: DiscoveryProgressHandler,
): Promise<DiscoveryResult> {
  onProgress?.("Discovering forks (loading upstream metadata)")
  const upstream = await fetchRepoMetadata(repo, logger)
  onProgress?.("Discovering forks (loading upstream HEAD)")
  const upstreamHeadSha = await fetchRemoteBranchHeadSha(repo.cloneUrl, upstream.defaultBranch, logger)
  if (!upstreamHeadSha) {
    throw new AppError("DISCOVERY_FAILED", `Could not resolve upstream HEAD for ${upstream.fullName}:${upstream.defaultBranch}.`)
  }
  const scanLimit = Math.max(10, options.forkScanLimit)
  const perPage = Math.min(100, Math.max(20, Math.ceil(scanLimit / 2)))
  const maxComparedForks = Math.min(Math.max(scanLimit * 4, 80), Math.max(scanLimit, upstream.forkCount))
  const fetchSorts: Array<"stargazers" | "newest"> =
    upstream.forkCount <= scanLimit ? ["stargazers"] : ["stargazers", "newest"]
  const nextPageBySort = new Map(fetchSorts.map((sort) => [sort, 1]))
  const exhaustedSorts = new Set<"stargazers" | "newest">()
  const seenForks = new Set<string>()
  const visibleForksByName = new Map<string, ForkMetadata>()
  let archivedExcluded = 0
  let unchangedExcluded = 0
  let comparedForkCount = 0

  while (
    visibleForksByName.size < scanLimit &&
    comparedForkCount < maxComparedForks &&
    exhaustedSorts.size < fetchSorts.length
  ) {
    let fetchedAny = false

    for (const sort of fetchSorts) {
      if (visibleForksByName.size >= scanLimit || comparedForkCount >= maxComparedForks || exhaustedSorts.has(sort)) {
        continue
      }

      const page = nextPageBySort.get(sort) ?? 1
      onProgress?.(`Discovering forks (loading ${sort} page ${page})`)
      const forkSlice = await fetchForkSlice(repo, sort, page, perPage, logger)
      nextPageBySort.set(sort, page + 1)

      if (forkSlice.length === 0) {
        exhaustedSorts.add(sort)
        continue
      }

      fetchedAny = true
      if (forkSlice.length < perPage) {
        exhaustedSorts.add(sort)
      }

      const freshForks = forkSlice.filter((fork) => {
        if (fork.fullName === upstream.fullName || seenForks.has(fork.fullName)) {
          return false
        }

        seenForks.add(fork.fullName)
        return true
      })

      if (!options.includeArchived) {
        archivedExcluded += freshForks.filter((fork) => fork.isArchived).length
      }

      const archiveFilteredForks = options.includeArchived ? freshForks : freshForks.filter((fork) => !fork.isArchived)
      const remainingBudget = maxComparedForks - comparedForkCount
      const comparableBatch = archiveFilteredForks.slice(0, remainingBudget)

      if (comparableBatch.length === 0) {
        continue
      }

      onProgress?.(
        `Discovering forks (${visibleForksByName.size} visible, ${comparedForkCount} checked, comparing ${comparableBatch.length} ${sort} forks)`,
      )
      const comparedBatch = await enrichForkComparisons(upstreamHeadSha, comparableBatch, logger, onProgress)
      comparedForkCount += comparedBatch.comparedForkCount
      unchangedExcluded += comparedBatch.unchangedExcluded

      for (const fork of comparedBatch.forks) {
        visibleForksByName.set(fork.fullName, fork)
        if (visibleForksByName.size >= scanLimit) {
          break
        }
      }
    }

    if (!fetchedAny) {
      break
    }
  }

  const visibleForks = Array.from(visibleForksByName.values())
    .sort((left, right) => compareForksForSelection(left, right, "stars"))
    .slice(0, scanLimit)

  const recommended = recommendForks(visibleForks, options.recommendedForkLimit, "stars")
  for (const fork of visibleForks) {
    fork.defaultSelected = recommended.has(fork.fullName)
  }

  onProgress?.(`Discovering forks complete (${visibleForks.length} changed candidates)`)

  return {
    upstream,
    scannedForkCount: comparedForkCount,
    totalForkCount: upstream.forkCount,
    archivedExcluded,
    unchangedExcluded,
    selectionWarning:
      upstream.forkCount > visibleForks.length
        ? `Checked ${comparedForkCount} forks to surface ${visibleForks.length} changed candidates. Expand the scan limit if you need broader coverage.`
        : null,
    forks: visibleForks,
  }
}
