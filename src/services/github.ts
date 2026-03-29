import { z } from "zod"

import { AppError } from "../core/errors.ts"
import type { DiscoveryResult, ForkMetadata, GitHubRepoRef, RepoMetadata } from "../core/types.ts"
import type { Logger } from "../core/logger.ts"
import { daysSince, recommendForks, scoreForkCandidate } from "./heuristics.ts"
import { runCommand } from "./command.ts"

const repoViewSchema = z.object({
  name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable().optional(),
  homepageUrl: z.string().nullable().optional(),
  defaultBranchRef: z.object({ name: z.string() }),
  stargazerCount: z.number().int(),
  forkCount: z.number().int(),
  updatedAt: z.string().nullable().optional(),
  pushedAt: z.string().nullable().optional(),
  isArchived: z.boolean(),
})

const forkSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable(),
  homepage: z.string().nullable().optional(),
  default_branch: z.string(),
  stargazers_count: z.number().int(),
  forks_count: z.number().int().optional(),
  archived: z.boolean(),
  pushed_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  created_at: z.string().nullable(),
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

const compareSchema = z.object({
  status: z.string().nullable().optional(),
  ahead_by: z.number().int().nullable().optional(),
  behind_by: z.number().int().nullable().optional(),
})

type ForkComparison = {
  status: string | null
  aheadBy: number | null
  behindBy: number | null
  hasChanges: boolean | null
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

  if (!/github\.com$/i.test(url.hostname)) {
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

async function fetchForkComparison(
  upstream: GitHubRepoRef,
  upstreamBranch: string,
  fork: ForkMetadata,
  logger?: Logger,
): Promise<ForkComparison> {
  const [forkOwner] = fork.fullName.split("/")
  if (!forkOwner) {
    return {
      status: null,
      aheadBy: null,
      behindBy: null,
      hasChanges: null,
    }
  }

  const result = await runCommand(
    {
      command: "gh",
      args: [
        "api",
        `repos/${upstream.fullName}/compare/${upstreamBranch}...${forkOwner}:${fork.defaultBranch}`,
        "--jq",
        "{status,ahead_by,behind_by}",
      ],
    },
    {
      logger,
      allowFailure: true,
    },
  )

  if (result.exitCode !== 0) {
    await logger?.warn("fork_compare_failed", {
      fork: fork.fullName,
      upstream: upstream.fullName,
      stderr: result.stderr,
    })
    return {
      status: null,
      aheadBy: null,
      behindBy: null,
      hasChanges: null,
    }
  }

  const parsed = compareSchema.parse(JSON.parse(result.stdout))
  const aheadBy = parsed.ahead_by ?? null
  const behindBy = parsed.behind_by ?? null

  return {
    status: parsed.status ?? null,
    aheadBy,
    behindBy,
    hasChanges: aheadBy === null ? null : aheadBy > 0,
  }
}

async function enrichForkComparisons(
  upstream: GitHubRepoRef,
  upstreamBranch: string,
  forks: ForkMetadata[],
  logger?: Logger,
): Promise<ForkMetadata[]> {
  const enriched: ForkMetadata[] = []

  for (const fork of forks) {
    const comparison = await fetchForkComparison(upstream, upstreamBranch, fork, logger)
    enriched.push({
      ...fork,
      comparisonStatus: comparison.status,
      aheadBy: comparison.aheadBy,
      behindBy: comparison.behindBy,
      hasChanges: comparison.hasChanges,
    })
  }

  return enriched
}

export async function fetchRepoMetadata(repo: GitHubRepoRef, logger?: Logger): Promise<RepoMetadata> {
  const result = await runCommand(
    {
      command: "gh",
      args: [
        "repo",
        "view",
        repo.fullName,
        "--json",
        "name,owner,description,homepageUrl,defaultBranchRef,stargazerCount,forkCount,updatedAt,pushedAt,isArchived",
      ],
    },
    { logger },
  )

  const parsed = repoViewSchema.parse(JSON.parse(result.stdout))

  return {
    fullName: `${parsed.owner.login}/${parsed.name}`,
    description: parsed.description ?? null,
    homepageUrl: parsed.homepageUrl ?? null,
    defaultBranch: parsed.defaultBranchRef.name,
    isArchived: parsed.isArchived,
    forkCount: parsed.forkCount,
    stargazerCount: parsed.stargazerCount,
    pushedAt: parsed.pushedAt ?? null,
    updatedAt: parsed.updatedAt ?? null,
  }
}

async function fetchForkSlice(
  repo: GitHubRepoRef,
  sort: "newest" | "stargazers",
  page: number,
  perPage: number,
  logger?: Logger,
): Promise<ForkMetadata[]> {
  const result = await runCommand(
    {
      command: "gh",
      args: [
        "api",
        `repos/${repo.fullName}/forks?sort=${sort}&per_page=${perPage}&page=${page}`,
        "--jq",
        "map({full_name, description, homepage, default_branch, stargazers_count, forks_count, archived, pushed_at, updated_at, created_at, archived_at, parent, source})",
      ],
    },
    { logger },
  )

  const parsed = z.array(forkSchema).parse(JSON.parse(result.stdout))

  return parsed.map((fork) => {
    const pushedDaysAgo = daysSince(fork.pushed_at)
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
): Promise<DiscoveryResult> {
  const upstream = await fetchRepoMetadata(repo, logger)
  const scanLimit = Math.max(10, options.forkScanLimit)
  const perPage = Math.min(100, scanLimit)
  const collected = new Map<string, ForkMetadata>()

  const addForks = (forks: ForkMetadata[]) => {
    for (const fork of forks) {
      if (!collected.has(fork.fullName)) {
        collected.set(fork.fullName, fork)
      }
    }
  }

  if (upstream.forkCount <= scanLimit) {
    addForks(await fetchForkSlice(repo, "newest", 1, perPage, logger))
  } else {
    const newestLimit = Math.max(10, Math.floor(scanLimit / 2))
    const starLimit = Math.max(10, scanLimit - newestLimit)
    addForks(await fetchForkSlice(repo, "newest", 1, newestLimit, logger))
    addForks(await fetchForkSlice(repo, "stargazers", 1, starLimit, logger))
  }

  const initialForks = Array.from(collected.values()).filter((fork) => fork.fullName !== upstream.fullName)
  const archivedExcluded = initialForks.filter((fork) => fork.isArchived).length
  const archiveFilteredForks = options.includeArchived
    ? initialForks
    : initialForks.filter((fork) => !fork.isArchived)
  const comparedForks = await enrichForkComparisons(repo, upstream.defaultBranch, archiveFilteredForks, logger)
  const unchangedExcluded = comparedForks.filter((fork) => fork.hasChanges === false).length
  const visibleForks = comparedForks.filter((fork) => fork.hasChanges !== false)

  visibleForks.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    return left.fullName.localeCompare(right.fullName)
  })

  const defaultSelection = recommendForks(visibleForks, options.recommendedForkLimit)
  for (const fork of visibleForks) {
    fork.defaultSelected = defaultSelection.has(fork.fullName)
  }

  const selectionWarning =
    upstream.forkCount > initialForks.length
      ? `Scanned ${initialForks.length} of ${upstream.forkCount} forks. Expand the scan limit if you need broader coverage.`
      : null

  return {
    upstream,
    scannedForkCount: initialForks.length,
    totalForkCount: upstream.forkCount,
    archivedExcluded: options.includeArchived ? 0 : archivedExcluded,
    unchangedExcluded,
    selectionWarning,
    forks: visibleForks,
  }
}
