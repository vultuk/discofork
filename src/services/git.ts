import { readdir, rm, stat } from "node:fs/promises"
import path from "node:path"

import type { Logger } from "../core/logger.ts"
import type { DiffFacts, GitHubRepoRef, RepoFacts, RepoMetadata } from "../core/types.ts"
import { compactWhitespace, truncate } from "../core/format.ts"
import { runCommand } from "./command.ts"

const manifestCandidates = [
  "package.json",
  "bunfig.toml",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "Gemfile",
  "mix.exs",
]

export async function cloneOrUpdateRepository(
  repo: GitHubRepoRef | { fullName: string; cloneUrl: string },
  directory: string,
  branch: string,
  logger?: Logger,
): Promise<void> {
  const gitDir = path.join(directory, ".git")
  const hasRepo = await stat(gitDir)
    .then((entry) => entry.isDirectory())
    .catch(() => false)
  const hasDirectory = await stat(directory)
    .then((entry) => entry.isDirectory())
    .catch(() => false)

  if (!hasRepo) {
    if (hasDirectory) {
      const entries = await readdir(directory).catch(() => [])
      if (entries.length > 0) {
        await logger?.warn("git_cache_reset", {
          repository: repo.fullName,
          directory,
        })
        await rm(directory, { recursive: true, force: true })
      }
    }

    await runCommand(
      {
        command: "git",
        args: [
          "clone",
          "--filter=blob:none",
          "--no-checkout",
          "--single-branch",
          "--branch",
          branch,
          "--depth",
          "200",
          repo.cloneUrl,
          directory,
        ],
      },
      { logger },
    )
    return
  }

  await runCommand(
    {
      command: "git",
      args: ["remote", "set-url", "origin", repo.cloneUrl],
      cwd: directory,
    },
    { logger },
  )

  await runCommand(
    {
      command: "git",
      args: ["fetch", "origin", branch, "--depth", "200", "--prune"],
      cwd: directory,
    },
    { logger },
  )
}

export async function ensureUpstreamRemote(
  directory: string,
  upstream: GitHubRepoRef,
  branch: string,
  logger?: Logger,
): Promise<void> {
  const remotes = await runCommand(
    {
      command: "git",
      args: ["remote"],
      cwd: directory,
    },
    { logger },
  )

  const remoteNames = new Set(
    remotes.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  )

  if (!remoteNames.has("upstream")) {
    await runCommand(
      {
        command: "git",
        args: ["remote", "add", "upstream", upstream.cloneUrl],
        cwd: directory,
      },
      { logger },
    )
  } else {
    await runCommand(
      {
        command: "git",
        args: ["remote", "set-url", "upstream", upstream.cloneUrl],
        cwd: directory,
      },
      { logger },
    )
  }

  await runCommand(
    {
      command: "git",
      args: ["fetch", "upstream", branch, "--depth", "200", "--prune"],
      cwd: directory,
    },
    { logger },
  )
}

async function gitText(
  directory: string,
  args: string[],
  logger?: Logger,
  allowFailure = false,
): Promise<string> {
  const result = await runCommand(
    {
      command: "git",
      args,
      cwd: directory,
    },
    { logger, allowFailure },
  )

  return result.stdout.trim()
}

async function maybeReadFileAtHead(directory: string, repoPath: string, logger?: Logger): Promise<string | null> {
  const result = await runCommand(
    {
      command: "git",
      args: ["show", `HEAD:${repoPath}`],
      cwd: directory,
    },
    { logger, allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return null
  }

  return truncate(result.stdout, 4000)
}

function detectTech(entries: string[]): string[] {
  const signals = new Set<string>()

  for (const entry of entries) {
    if (entry === "package.json") {
      signals.add("Node.js / JavaScript")
    }
    if (entry === "bunfig.toml") {
      signals.add("Bun")
    }
    if (entry === "tsconfig.json") {
      signals.add("TypeScript")
    }
    if (entry === "pyproject.toml" || entry === "requirements.txt") {
      signals.add("Python")
    }
    if (entry === "Cargo.toml") {
      signals.add("Rust")
    }
    if (entry === "go.mod") {
      signals.add("Go")
    }
    if (entry === "pom.xml" || entry === "build.gradle" || entry === "build.gradle.kts") {
      signals.add("JVM")
    }
    if (entry === "composer.json") {
      signals.add("PHP")
    }
    if (entry === "Gemfile") {
      signals.add("Ruby")
    }
    if (entry === "docs" || entry === "website") {
      signals.add("Documentation site")
    }
    if (entry === "docker" || entry === "Dockerfile") {
      signals.add("Container tooling")
    }
  }

  return Array.from(signals)
}

export async function collectRepoFacts(
  directory: string,
  metadata: RepoMetadata,
  logger?: Logger,
): Promise<RepoFacts> {
  const entryText = await gitText(directory, ["ls-tree", "--name-only", "HEAD"], logger)
  const entries = entryText.split("\n").map((entry) => entry.trim()).filter(Boolean)
  const topDirectories = await gitText(directory, ["ls-tree", "-d", "--name-only", "HEAD"], logger)
  const readmePath = entries.find((entry) => /^readme(\..+)?$/i.test(entry)) ?? null
  const manifestFiles = entries.filter((entry) => manifestCandidates.includes(entry))
  const commitText = await gitText(
    directory,
    ["log", "--format=%H%x09%cI%x09%s", "-n", "12"],
    logger,
  )

  return {
    metadata,
    topLevelEntries: entries.slice(0, 50),
    topDirectories: topDirectories.split("\n").map((entry) => entry.trim()).filter(Boolean).slice(0, 20),
    topFiles: entries.filter((entry) => !entry.includes("/")).slice(0, 20),
    readmeExcerpt: readmePath ? await maybeReadFileAtHead(directory, readmePath, logger) : null,
    manifestFiles: (
      await Promise.all(
        manifestFiles.slice(0, 6).map(async (manifestPath) => {
          const excerpt = await maybeReadFileAtHead(directory, manifestPath, logger)
          return excerpt
            ? {
                path: manifestPath,
                excerpt,
              }
            : null
        }),
      )
    ).filter((manifest): manifest is { path: string; excerpt: string } => manifest !== null),
    recentCommits: commitText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sha = "", authoredAt = "", subject = ""] = line.split("\t")
        return {
          sha,
          authoredAt,
          subject,
        }
      }),
    detectedTech: detectTech(entries),
  }
}

function parseShortStat(text: string): Pick<DiffFacts, "changedFiles" | "insertions" | "deletions"> {
  const changedFiles = Number(text.match(/(\d+)\s+files? changed/)?.[1] ?? 0)
  const insertions = Number(text.match(/(\d+)\s+insertions?\(\+\)/)?.[1] ?? 0)
  const deletions = Number(text.match(/(\d+)\s+deletions?\(-\)/)?.[1] ?? 0)
  return { changedFiles, insertions, deletions }
}

function extensionLabel(filePath: string): string {
  const fileName = filePath.split("/").pop() ?? filePath
  const extMatch = fileName.match(/\.([^.]+)$/)
  if (!extMatch) {
    return "(no extension)"
  }

  return `.${extMatch[1]!.toLowerCase()}`
}

export async function collectDiffFacts(
  directory: string,
  forkBranch: string,
  upstreamBranch: string,
  maxCommitSamples: number,
  maxChangedFiles: number,
  logger?: Logger,
): Promise<DiffFacts> {
  const upstreamRef = `upstream/${upstreamBranch}`
  const originRef = `origin/${forkBranch}`
  const mergeBaseResult = await runCommand(
    {
      command: "git",
      args: ["merge-base", upstreamRef, originRef],
      cwd: directory,
    },
    { logger, allowFailure: true },
  )
  const mergeBase = mergeBaseResult.exitCode === 0 ? mergeBaseResult.stdout.trim() : null
  const diffRange = mergeBase ? `${mergeBase}..${originRef}` : `${upstreamRef}..${originRef}`
  const countsText = await gitText(
    directory,
    ["rev-list", "--left-right", "--count", `${upstreamRef}...${originRef}`],
    logger,
  )
  const [behindText, aheadText] = countsText.split(/\s+/)
  const shortStat = parseShortStat(
    await gitText(directory, ["diff", "--shortstat", "--find-renames", diffRange], logger, true),
  )
  const nameStatusText = await gitText(
    directory,
    ["diff", "--name-status", "--find-renames", diffRange],
    logger,
    true,
  )
  const numstatText = await gitText(
    directory,
    ["diff", "--numstat", "--find-renames", diffRange],
    logger,
    true,
  )
  const dirstatText = await gitText(
    directory,
    ["diff", "--dirstat=files,0,cumulative", diffRange],
    logger,
    true,
  )
  const commitText = await gitText(
    directory,
    ["log", "--no-merges", `--format=%H%x09%cI%x09%s`, "-n", String(maxCommitSamples), diffRange],
    logger,
    true,
  )

  const fileSummaries = numstatText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t")
      const additions = Number(parts[0] === "-" ? 0 : parts[0] ?? 0)
      const deletions = Number(parts[1] === "-" ? 0 : parts[1] ?? 0)
      const repoPath = parts.slice(2).join("\t")
      return {
        path: repoPath,
        additions,
        deletions,
      }
    })
    .filter((entry) => entry.path)

  const extensionCounts = new Map<string, number>()
  for (const file of fileSummaries) {
    const label = extensionLabel(file.path)
    extensionCounts.set(label, (extensionCounts.get(label) ?? 0) + 1)
  }

  const topChangedDirectories = dirstatText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([\d.]+)%\s+(.+)$/)
      if (!match) {
        return null
      }

      return {
        percent: Number(match[1]),
        path: match[2]!.trim(),
      }
    })
    .filter((entry): entry is { percent: number; path: string } => entry !== null)
    .slice(0, 10)

  const commitSummaries = commitText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha = "", authoredAt = "", subject = ""] = line.split("\t")
      return { sha, authoredAt, subject }
    })

  const topChangedPaths = fileSummaries
    .slice()
    .sort((left, right) => right.additions + right.deletions - (left.additions + left.deletions))
    .slice(0, maxChangedFiles)
    .map((entry) => ({
      path: entry.path,
      changes: entry.additions + entry.deletions,
    }))

  const renamedFiles = nameStatusText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("R")).length

  return {
    mergeBase,
    aheadCount: Number(aheadText ?? 0),
    behindCount: Number(behindText ?? 0),
    changedFiles: shortStat.changedFiles || fileSummaries.length,
    insertions: shortStat.insertions,
    deletions: shortStat.deletions,
    renamedFiles,
    topChangedPaths,
    topChangedDirectories,
    uniqueCommits: commitSummaries,
    fileKinds: Array.from(extensionCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    sampleFileSummaries: fileSummaries
      .slice()
      .sort((left, right) => right.additions + right.deletions - (left.additions + left.deletions))
      .slice(0, maxChangedFiles),
  }
}

export function summarizeDiffFacts(diffFacts: DiffFacts): string[] {
  const lines: string[] = []
  lines.push(
    compactWhitespace(
      `Ahead ${diffFacts.aheadCount}, behind ${diffFacts.behindCount}, ${diffFacts.changedFiles} changed files, ${diffFacts.insertions} insertions, ${diffFacts.deletions} deletions.`,
    ),
  )

  if (diffFacts.topChangedDirectories.length > 0) {
    lines.push(
      `Top directories: ${diffFacts.topChangedDirectories
        .slice(0, 4)
        .map((entry) => `${entry.path} (${entry.percent}%)`)
        .join(", ")}.`,
    )
  }

  if (diffFacts.uniqueCommits.length > 0) {
    lines.push(
      `Notable commits: ${diffFacts.uniqueCommits
        .slice(0, 5)
        .map((entry) => truncate(entry.subject, 80))
        .join(" | ")}.`,
    )
  }

  return lines
}
