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
import {
  cleanupManagedRepositories,
  cloneOrUpdateRepository,
  collectDiffFacts,
  collectRepoFacts,
  ensureUpstreamRemote,
} from "./git.ts"
import { computeRecommendations } from "./heuristics.ts"
import { exportReport } from "./report.ts"
import { createWorkspacePaths } from "./workspace.ts"

type ProgressHandler = (event: ProgressEvent) => void

type AnalysedFork = {
  metadata: ForkMetadata
  diffFacts: DiffFacts
  analysis: ForkAnalysis
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
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
  onProgress?: (message: string) => void,
): Promise<Awaited<ReturnType<typeof discoverForks>>> {
  const paths = await createWorkspacePaths(path.join(cwd, ".discofork"), repo, runId)
  const logger = createLogger(path.join(paths.logsRoot, `${runId}.jsonl`))
  return discoverForks(repo, options, logger, onProgress)
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
  let outcome: { report: FinalReport; exports: ExportPaths; logPath: string } | null = null

  try {
    const totalProgressSteps = Math.max(2, selectedForks.length + 2)
    let completedForks = 0

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

    onProgress({
      type: "progress",
      phase: "upstream",
      detail: "Upstream analysis ready",
      current: 1,
      total: totalProgressSteps,
    })

    const compareConcurrency = Math.max(1, options.compareConcurrency)
    onProgress({
      type: "phase",
      phase: "forks",
      detail: `Processing ${selectedForks.length} selected forks with concurrency ${compareConcurrency}`,
    })

    const analysedForkResults = await mapWithConcurrency<ForkMetadata, AnalysedFork | null>(
      selectedForks,
      compareConcurrency,
      async (fork) => {
        try {
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

          return {
            metadata: fork,
            diffFacts,
            analysis,
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          await logger.warn("fork_analysis:skipped", {
            repository: repo.fullName,
            fork: fork.fullName,
            message,
          })
          onProgress({
            type: "warning",
            message: `Skipping fork ${fork.fullName}: ${message}`,
          })
          return null
        } finally {
          completedForks += 1
          onProgress({
            type: "progress",
            phase: "forks",
            detail: `Processed ${completedForks} of ${selectedForks.length} selected forks`,
            current: Math.min(totalProgressSteps - 1, 1 + completedForks),
            total: totalProgressSteps,
          })
        }
      },
    )
    const analysedForks = analysedForkResults.filter((fork): fork is AnalysedFork => fork !== null)
    const skippedForkCount = selectedForks.length - analysedForks.length
    const selectionWarning =
      skippedForkCount > 0
        ? `${skippedForkCount} selected fork${skippedForkCount === 1 ? "" : "s"} could not be analysed and were skipped.`
        : null

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
        selectionWarning,
      },
      forks: analysedForks,
      recommendations: computeRecommendations(analysedForks),
    }

    const exports: ExportPaths = {
      jsonPath: path.join(paths.reportsRoot, "analysis.json"),
      markdownPath: path.join(paths.reportsRoot, "analysis.md"),
    }

    await exportReport(report, exports)
    onProgress({
      type: "progress",
      phase: "report",
      detail: "Report rendered and saved",
      current: totalProgressSteps,
      total: totalProgressSteps,
    })
    outcome = {
      report,
      exports,
      logPath: logger.path,
    }
  } finally {
    onProgress({ type: "phase", phase: "cleanup", detail: "Removing local cloned repositories" })
    await cleanupManagedRepositories(paths.reposRoot, logger)
  }

  onProgress({ type: "status", message: "Analysis complete" })
  return outcome!
}
