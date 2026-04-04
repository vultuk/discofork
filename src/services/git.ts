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

export async function cleanupManagedRepositories(reposRoot: string, logger?: Logger): Promise<void> {
  const exists = await stat(reposRoot)
    .then((entry) => entry.isDirectory())
    .catch(() => false)

  if (!exists) {
    return
  }

  await logger?.info("git_cleanup:start", { reposRoot })
  await rm(reposRoot, { recursive: true, force: true })
  await logger?.info("git_cleanup:finish", { reposRoot })
}

export async function cleanupWorkspaceRoot(workspaceRoot: string, logger?: Logger): Promise<void> {
  const exists = await stat(workspaceRoot)
    .then((entry) => entry.isDirectory())
    .catch(() => false)

  if (!exists) {
    return
  }

  const entries = await readdir(workspaceRoot).catch(() => [])
  if (entries.length === 0) {
    return
  }

  await logger?.info("workspace_cleanup:start", {
    workspaceRoot,
    entries: entries.length,
  })

  await Promise.all(entries.map((entry) => rm(path.join(workspaceRoot, entry), { recursive: true, force: true })))

  await logger?.info("workspace_cleanup:finish", {
    workspaceRoot,
    entries: entries.length,
  })
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

const workspaceSignalFiles = {
  "pnpm-workspace.yaml": "pnpm workspace",
  "turbo.json": "Turborepo",
  "nx.json": "Nx workspace",
  "lerna.json": "Lerna workspace",
  "workspace.json": "workspace.json orchestration",
  "rush.json": "Rush workspace",
} as const

const workspaceDirectoryPrefixes = ["apps/", "packages/", "services/", "libs/", "modules/", "clients/", "servers/", "workers/", "plugins/", "crates/"]

function uniqueLimited(values: string[], limit: number): string[] {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    unique.push(value)

    if (unique.length >= limit) {
      break
    }
  }

  return unique
}

function manifestBaseName(repoPath: string): string {
  return path.posix.basename(repoPath)
}

function isManifestCandidatePath(repoPath: string): boolean {
  return manifestCandidates.includes(manifestBaseName(repoPath))
}

function workspacePathPriority(repoPath: string): [number, number, string] {
  const prefixIndex = workspaceDirectoryPrefixes.findIndex((prefix) => repoPath.startsWith(prefix))
  return [prefixIndex === -1 ? workspaceDirectoryPrefixes.length : prefixIndex, repoPath.split("/").length, repoPath]
}

function listNestedManifestPaths(allEntries: string[]): string[] {
  return allEntries
    .filter((entry) => entry.includes("/") && isManifestCandidatePath(entry))
    .slice()
    .sort((left, right) => {
      const leftPriority = workspacePathPriority(left)
      const rightPriority = workspacePathPriority(right)
      if (leftPriority[0] !== rightPriority[0]) {
        return leftPriority[0] - rightPriority[0]
      }
      if (leftPriority[1] !== rightPriority[1]) {
        return leftPriority[1] - rightPriority[1]
      }
      return leftPriority[2].localeCompare(rightPriority[2])
    })
}

function summarizeWorkspaceSignals(
  entries: string[],
  allEntries: string[],
  rootPackageExcerpt: string | null,
): string[] {
  const signals: string[] = []

  for (const [fileName, label] of Object.entries(workspaceSignalFiles)) {
    if (entries.includes(fileName)) {
      signals.push(label)
    }
  }

  const nestedManifestPaths = listNestedManifestPaths(allEntries)
  const nestedPackageJsonCount = nestedManifestPaths.filter((entry) => manifestBaseName(entry) === "package.json").length
  const nestedPythonCount = nestedManifestPaths.filter((entry) => ["pyproject.toml", "requirements.txt"].includes(manifestBaseName(entry))).length
  const nestedCargoCount = nestedManifestPaths.filter((entry) => manifestBaseName(entry) === "Cargo.toml").length
  const nestedGoCount = nestedManifestPaths.filter((entry) => manifestBaseName(entry) === "go.mod").length

  if (rootPackageExcerpt?.includes('"workspaces"')) {
    signals.push("package.json workspaces")
  }
  if (nestedPackageJsonCount >= 2) {
    signals.push("multiple nested Node.js packages")
  }
  if (nestedPythonCount >= 2) {
    signals.push("multiple nested Python packages or services")
  }
  if (nestedCargoCount >= 2) {
    signals.push("multiple nested Rust crates")
  }
  if (nestedGoCount >= 2) {
    signals.push("multiple nested Go modules")
  }

  return uniqueLimited(signals, 6)
}

function representativeWorkspaceDirectories(nestedManifestPaths: string[]): string[] {
  const directories = nestedManifestPaths
    .map((entry) => path.posix.dirname(entry))
    .filter((entry) => entry && entry !== ".")
    .sort((left, right) => {
      const leftPriority = workspacePathPriority(left)
      const rightPriority = workspacePathPriority(right)
      if (leftPriority[0] !== rightPriority[0]) {
        return leftPriority[0] - rightPriority[0]
      }
      if (leftPriority[1] !== rightPriority[1]) {
        return leftPriority[1] - rightPriority[1]
      }
      return leftPriority[2].localeCompare(rightPriority[2])
    })

  return uniqueLimited(directories, 10)
}

function detectTech(entries: string[], workspaceSignals: string[]): string[] {
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

  if (workspaceSignals.length > 0) {
    signals.add("Monorepo / multi-package workspace")
  }
  if (workspaceSignals.includes("pnpm workspace")) {
    signals.add("pnpm")
  }
  if (workspaceSignals.includes("Turborepo")) {
    signals.add("Turborepo")
  }
  if (workspaceSignals.includes("Nx workspace")) {
    signals.add("Nx")
  }

  return Array.from(signals)
}

export const __private__ = {
  listNestedManifestPaths,
  summarizeWorkspaceSignals,
  representativeWorkspaceDirectories,
}

export async function collectRepoFacts(
  directory: string,
  metadata: RepoMetadata,
  logger?: Logger,
): Promise<RepoFacts> {
  const entryText = await gitText(directory, ["ls-tree", "--name-only", "HEAD"], logger)
  const entries = entryText.split("\n").map((entry) => entry.trim()).filter(Boolean)
  const allEntryText = await gitText(directory, ["ls-tree", "-r", "--name-only", "HEAD"], logger)
  const allEntries = allEntryText.split("\n").map((entry) => entry.trim()).filter(Boolean)
  const topDirectories = await gitText(directory, ["ls-tree", "-d", "--name-only", "HEAD"], logger)
  const readmePath = entries.find((entry) => /^readme(\..+)?$/i.test(entry)) ?? null
  const topLevelManifestPaths = entries.filter((entry) => manifestCandidates.includes(entry))
  const nestedManifestPaths = listNestedManifestPaths(allEntries)
  const commitText = await gitText(
    directory,
    ["log", "--format=%H%x09%cI%x09%s", "-n", "12"],
    logger,
  )

  const manifestFiles = (
    await Promise.all(
      topLevelManifestPaths.slice(0, 6).map(async (manifestPath) => {
        const excerpt = await maybeReadFileAtHead(directory, manifestPath, logger)
        return excerpt
          ? {
              path: manifestPath,
              excerpt,
            }
          : null
      }),
    )
  ).filter((manifest): manifest is { path: string; excerpt: string } => manifest !== null)

  const nestedManifestFiles = (
    await Promise.all(
      nestedManifestPaths.slice(0, 8).map(async (manifestPath) => {
        const excerpt = await maybeReadFileAtHead(directory, manifestPath, logger)
        return excerpt
          ? {
              path: manifestPath,
              excerpt,
            }
          : null
      }),
    )
  ).filter((manifest): manifest is { path: string; excerpt: string } => manifest !== null)

  const workspaceSignals = summarizeWorkspaceSignals(
    entries,
    allEntries,
    manifestFiles.find((manifest) => manifest.path === "package.json")?.excerpt ?? null,
  )

  return {
    metadata,
    topLevelEntries: entries.slice(0, 50),
    topDirectories: topDirectories.split("\n").map((entry) => entry.trim()).filter(Boolean).slice(0, 20),
    topFiles: entries.filter((entry) => !entry.includes("/")).slice(0, 20),
    readmeExcerpt: readmePath ? await maybeReadFileAtHead(directory, readmePath, logger) : null,
    manifestFiles,
    nestedManifestFiles,
    workspaceSignals,
    workspaceDirectories: representativeWorkspaceDirectories(nestedManifestPaths),
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
    detectedTech: detectTech(entries, workspaceSignals),
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
