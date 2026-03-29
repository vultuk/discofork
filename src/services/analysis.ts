import path from "node:path"

import { AppError } from "../core/errors.ts"
import { createLogger } from "../core/logger.ts"
import type {
  AnalysisOptions,
  DiffFacts,
  ExportPaths,
  FinalReport,
  ForkAnalysis,
  ForkMetadata,
  GitHubRepoRef,
  ProgressEvent,
  RepoFacts,
  UpstreamAnalysis,
} from "../core/types.ts"
import { loadForkCache, loadUpstreamCache, saveForkCache, saveUpstreamCache } from "./cache.ts"
import { commandExists } from "./command.ts"
import { analyzeForkWithCodex, analyzeUpstreamWithCodex } from "./codex.ts"
import { discoverForks, fetchRepoMetadata } from "./github.ts"
import { cloneOrUpdateRepository, collectDiffFacts, collectRepoFacts, ensureUpstreamRemote } from "./git.ts"
import { computeRecommendations } from "./heuristics.ts"
import { exportReport } from "./report.ts"
import { createWorkspacePaths } from "./workspace.ts"

type ProgressHandler = (event: ProgressEvent) => void

export async function ensurePrerequisites(): Promise<void> {
  for (const tool of ["gh", "git", "codex"]) {
    const exists = await commandExists(tool)
    if (!exists) {
      throw new AppError("MISSING_TOOL", `Required tool not found on PATH: ${tool}`)
    }
  }
}

export async function loadDiscovery(
  repo: GitHubRepoRef,
  options: Pick<AnalysisOptions, "includeArchived" | "forkScanLimit" | "recommendedForkLimit">,
  cwd: string,
  runId: string,
): Promise<Awaited<ReturnType<typeof discoverForks>>> {
  const paths = await createWorkspacePaths(path.join(cwd, ".discofork"), repo, runId)
  const logger = createLogger(path.join(paths.logsRoot, `${runId}.jsonl`))
  return discoverForks(repo, options, logger)
}

export async function runAnalysis(
  repo: GitHubRepoRef,
  selectedForks: ForkMetadata[],
  options: AnalysisOptions,
  cwd: string,
  onProgress: ProgressHandler,
): Promise<{ report: FinalReport; exports: ExportPaths; logPath: string }> {
  const paths = await createWorkspacePaths(options.workspaceRoot, repo, options.runId)
  const logger = createLogger(path.join(paths.logsRoot, `${options.runId}.jsonl`))

  onProgress({ type: "phase", phase: "setup", detail: "Checking local toolchain" })
  await ensurePrerequisites()

  const upstreamMetadata = await fetchRepoMetadata(repo, logger)
  const upstreamBranch = upstreamMetadata.defaultBranch

  let upstreamFacts: RepoFacts
  let upstreamAnalysis: UpstreamAnalysis
  const cachedUpstream = await loadUpstreamCache(paths.upstreamCachePath, upstreamMetadata)

  if (cachedUpstream) {
    upstreamFacts = cachedUpstream.repoFacts
    upstreamAnalysis = cachedUpstream.analysis
    onProgress({ type: "phase", phase: "upstream", detail: `Using cached upstream analysis from ${cachedUpstream.cachedAt}` })
  } else {
    onProgress({ type: "phase", phase: "upstream", detail: "Cloning or updating upstream" })
    await cloneOrUpdateRepository(repo, paths.upstreamRepoDir, upstreamBranch, logger)

    onProgress({ type: "phase", phase: "upstream", detail: "Collecting upstream facts" })
    upstreamFacts = await collectRepoFacts(paths.upstreamRepoDir, upstreamMetadata, logger)

    upstreamAnalysis = await analyzeUpstreamWithCodex(
      upstreamFacts,
      path.join(cwd, "schemas", "upstream-analysis.schema.json"),
      path.join(paths.codexRoot, "upstream"),
      paths.upstreamRepoDir,
      logger,
    )

    await saveUpstreamCache(paths.upstreamCachePath, upstreamMetadata, upstreamFacts, upstreamAnalysis)
  }

  const analysedForks: FinalReport["forks"] = []

  for (const fork of selectedForks) {
    const cachedFork = await loadForkCache(paths.forkCachePath(fork.fullName), fork, upstreamMetadata)
    let diffFacts: DiffFacts
    let analysis: ForkAnalysis

    if (cachedFork) {
      diffFacts = cachedFork.diffFacts
      analysis = cachedFork.analysis
      onProgress({ type: "fork", fork: fork.fullName, detail: `Using cached fork analysis from ${cachedFork.cachedAt}` })
    } else {
      onProgress({ type: "fork", fork: fork.fullName, detail: "Cloning or updating fork" })
      const forkDir = paths.forkRepoDir(fork.fullName)
      const [forkOwner, forkName] = fork.fullName.split("/")
      const forkRef: GitHubRepoRef = {
        owner: forkOwner!,
        name: forkName!,
        fullName: fork.fullName,
        url: `https://github.com/${fork.fullName}`,
        cloneUrl: `https://github.com/${fork.fullName}.git`,
      }

      await cloneOrUpdateRepository(forkRef, forkDir, fork.defaultBranch, logger)
      await ensureUpstreamRemote(forkDir, repo, upstreamBranch, logger)

      onProgress({ type: "fork", fork: fork.fullName, detail: "Comparing against upstream" })
      diffFacts = await collectDiffFacts(
        forkDir,
        fork.defaultBranch,
        upstreamBranch,
        options.maxCommitSamples,
        options.maxChangedFiles,
        logger,
      )

      onProgress({ type: "fork", fork: fork.fullName, detail: "Interpreting changes with Codex" })
      analysis = await analyzeForkWithCodex(
        fork,
        upstreamFacts,
        diffFacts,
        upstreamAnalysis,
        path.join(cwd, "schemas", "fork-analysis.schema.json"),
        path.join(paths.codexRoot, fork.fullName.replace("/", "__")),
        forkDir,
        logger,
      )

      await saveForkCache(paths.forkCachePath(fork.fullName), fork, upstreamMetadata, diffFacts, analysis)
    }

    analysedForks.push({
      metadata: fork,
      diffFacts,
      analysis,
    })
  }

  onProgress({ type: "phase", phase: "report", detail: "Rendering export files" })
  const report: FinalReport = {
    generatedAt: new Date().toISOString(),
    repository: repo,
    upstream: {
      ...upstreamFacts,
      analysis: upstreamAnalysis,
    },
    discovery: {
      totalForkCount: upstreamMetadata.forkCount,
      scannedForkCount: selectedForks.length,
      archivedExcluded: 0,
      unchangedExcluded: 0,
      selectionWarning: null,
    },
    forks: analysedForks,
    recommendations: computeRecommendations(analysedForks),
  }

  const exports: ExportPaths = {
    jsonPath: path.join(paths.reportsRoot, "analysis.json"),
    markdownPath: path.join(paths.reportsRoot, "analysis.md"),
  }

  await exportReport(report, exports)
  onProgress({ type: "status", message: "Analysis complete" })

  return {
    report,
    exports,
    logPath: logger.path,
  }
}
