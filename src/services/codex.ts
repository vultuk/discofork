import { readFile } from "node:fs/promises"
import path from "node:path"

import { AppError, toErrorMessage } from "../core/errors.ts"
import type { Logger } from "../core/logger.ts"
import { ensureDir, writeJson, writeText } from "../core/fs.ts"
import type { DiffFacts, ForkAnalysis, ForkMetadata, RepoFacts, UpstreamAnalysis } from "../core/types.ts"
import { deriveMagnitude, deriveMaintenanceLabel } from "./heuristics.ts"
import { parseTimeoutSetting, runCommand } from "./command.ts"

const CODEX_MODEL = "gpt-5.4-mini"
const CODEX_REASONING_EFFORT = "low"
const CODEX_TIMEOUT_MS = parseTimeoutSetting(process.env.DISCOFORK_CODEX_TIMEOUT_MS, 1800000)

type CodexJsonRun<T> = {
  cwd: string
  schemaPath: string
  debugDir: string
  prompt: string
  logger?: Logger
}

async function runCodexJson<T>(run: CodexJsonRun<T>): Promise<T> {
  await ensureDir(run.debugDir)

  const outputPath = path.join(run.debugDir, "output.json")
  const stdoutPath = path.join(run.debugDir, "stdout.log")
  const stderrPath = path.join(run.debugDir, "stderr.log")
  await writeText(path.join(run.debugDir, "prompt.md"), run.prompt)
  await writeJson(path.join(run.debugDir, "invocation.json"), {
    model: CODEX_MODEL,
    reasoningEffort: CODEX_REASONING_EFFORT,
    schemaPath: run.schemaPath,
  })

  const result = await runCommand(
    {
      command: "codex",
      args: [
        "-m",
        CODEX_MODEL,
        "-c",
        `model_reasoning_effort="${CODEX_REASONING_EFFORT}"`,
        "exec",
        "--skip-git-repo-check",
        "--color",
        "never",
        "-C",
        run.cwd,
        "--output-schema",
        run.schemaPath,
        "--output-last-message",
        outputPath,
        "-",
      ],
      input: run.prompt,
    },
    { logger: run.logger, timeoutMs: CODEX_TIMEOUT_MS },
  )

  await writeText(stdoutPath, result.stdout)
  await writeText(stderrPath, result.stderr)

  let raw: string
  try {
    raw = await readFile(outputPath, "utf8")
  } catch (error) {
    throw new AppError("CODEX_OUTPUT_MISSING", "Codex did not write the expected output file.", {
      error: toErrorMessage(error),
      outputPath,
    })
  }

  try {
    const parsed = JSON.parse(raw) as T
    await writeJson(path.join(run.debugDir, "parsed.json"), parsed)
    return parsed
  } catch (error) {
    throw new AppError("CODEX_OUTPUT_INVALID", "Codex output was not valid JSON.", {
      error: toErrorMessage(error),
      outputPath,
      raw,
    })
  }
}

function fallbackUpstreamAnalysis(repoFacts: RepoFacts): UpstreamAnalysis {
  return {
    summary: `${repoFacts.metadata.fullName} appears to be an open source project focused on ${
      repoFacts.detectedTech.join(", ") || "its documented capabilities"
    }. ${repoFacts.metadata.description ?? "The repository description is sparse, so this summary leans on the README and top-level files."}`,
    capabilities: repoFacts.topDirectories.slice(0, 4).map((entry) => `Likely exposes functionality under \`${entry}\`.`),
    targetUsers: ["Developers or operators evaluating the upstream project."],
    architectureNotes: repoFacts.detectedTech.map((tech) => `Technology signal: ${tech}.`),
    evidence: [
      `Description: ${repoFacts.metadata.description ?? "none"}`,
      `Top-level entries: ${repoFacts.topLevelEntries.slice(0, 8).join(", ")}`,
      `Recent commits inspected: ${repoFacts.recentCommits.length}`,
    ],
  }
}

function dedupeLimited(items: string[], limit: number): string[] {
  const normalized = new Set<string>()
  const values: string[] = []

  for (const item of items) {
    const value = item.trim()
    if (!value) {
      continue
    }

    const key = value.toLowerCase()
    if (normalized.has(key)) {
      continue
    }

    normalized.add(key)
    values.push(value)

    if (values.length >= limit) {
      break
    }
  }

  return values
}

function hasAnySignal(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern))
}

function inferAdditionalFeatures(diffFacts: DiffFacts): string[] {
  const pathText = [
    ...diffFacts.topChangedPaths.map((entry) => entry.path.toLowerCase()),
    ...diffFacts.topChangedDirectories.map((entry) => entry.path.toLowerCase()),
    ...diffFacts.sampleFileSummaries.map((entry) => entry.path.toLowerCase()),
  ].join("\n")
  const commitText = diffFacts.uniqueCommits.map((entry) => entry.subject.toLowerCase()).join("\n")
  const combinedText = `${pathText}\n${commitText}`
  const features: string[] = []

  if (
    hasAnySignal(combinedText, [
      "android",
      "mobile",
      "ios",
      "react-native",
      "capacitor",
      "electron",
      "desktop",
    ])
  ) {
    features.push("Adds or extends platform-specific client support, such as mobile, Android, iOS, or desktop packaging.")
  }

  if (hasAnySignal(combinedText, ["sdk", "api", "schema", "openapi", "graphql", "proto", "client"])) {
    features.push("Expands API, schema, or SDK surface area for downstream integrations and generated clients.")
  }

  if (hasAnySignal(combinedText, ["mcp", "plugin", "plugins", "extension", "tool", "tools"])) {
    features.push("Adds plugin, tool, or MCP-style extensibility beyond the upstream baseline.")
  }

  if (hasAnySignal(combinedText, ["server", "backend", "proxy", "admin", "dashboard", "auth", "session"])) {
    features.push("Introduces more operational workflow surface such as server-side handling, auth, session control, or admin tooling.")
  }

  if (hasAnySignal(combinedText, ["agent", "prompt", "handoff", "subagent", "worktree", "memory", "workflow"])) {
    features.push("Changes agent workflow behavior, such as prompt handling, handoffs, worktrees, memory, or orchestration flow.")
  }

  if (hasAnySignal(combinedText, ["fast", "perf", "performance", "latency", "cache", "stream"])) {
    features.push("Adds performance-oriented execution paths, caching, or faster runtime modes.")
  }

  if (features.length === 0 && diffFacts.changedFiles >= 40 && diffFacts.topChangedDirectories.length > 0) {
    const areas = diffFacts.topChangedDirectories
      .slice(0, 2)
      .map((entry) => `\`${entry.path}\``)
      .join(" and ")
    features.push(`Extends or customizes major product areas around ${areas}.`)
  }

  if (features.length === 0 && diffFacts.topChangedPaths.length > 0 && diffFacts.aheadCount >= 10) {
    const paths = diffFacts.topChangedPaths
      .slice(0, 2)
      .map((entry) => `\`${entry.path}\``)
      .join(" and ")
    features.push(`Adds fork-specific behavior in ${paths}.`)
  }

  return dedupeLimited(features, 6)
}

function inferMissingFeatures(diffFacts: DiffFacts): string[] {
  const pathText = [
    ...diffFacts.topChangedPaths.map((entry) => entry.path.toLowerCase()),
    ...diffFacts.sampleFileSummaries.map((entry) => entry.path.toLowerCase()),
  ].join("\n")
  const commitText = diffFacts.uniqueCommits.map((entry) => entry.subject.toLowerCase()).join("\n")
  const combinedText = `${pathText}\n${commitText}`
  const missing: string[] = []
  const removalSignals = ["remove", "removed", "disable", "disabled", "drop", "dropped", "strip", "stripped", "without"]

  if (hasAnySignal(combinedText, removalSignals)) {
    missing.push("Some upstream behavior appears to be removed, disabled, or intentionally stripped down in this fork.")
  }

  if (hasAnySignal(combinedText, [...removalSignals, "deprecated"]) && hasAnySignal(combinedText, ["plugin", "mcp", "tool"])) {
    missing.push("Some upstream plugin, tool, or MCP-style integration paths may be reduced or disabled.")
  }

  if (hasAnySignal(combinedText, [...removalSignals, "deprecated"]) && hasAnySignal(combinedText, ["server", "admin", "auth", "session"])) {
    missing.push("Some upstream operational features such as auth, admin, or session handling may be reduced or absent.")
  }

  if (diffFacts.behindCount >= 30) {
    missing.push(`It trails upstream by ${diffFacts.behindCount} commits, so some recent upstream features and fixes are likely not present yet.`)
  }

  return dedupeLimited(missing, 6)
}

export function enrichForkAnalysis(
  analysis: ForkAnalysis,
  diffFacts: DiffFacts,
): ForkAnalysis {
  const additionalFeatures = dedupeLimited(
    [...(analysis.additionalFeatures ?? []), ...inferAdditionalFeatures(diffFacts)],
    6,
  )
  const missingFeatures = dedupeLimited(
    [...(analysis.missingFeatures ?? []), ...inferMissingFeatures(diffFacts)],
    6,
  )

  const changeCategories = new Set(analysis.changeCategories ?? [])
  if (additionalFeatures.length > 0) {
    changeCategories.add("features")
  }
  if (missingFeatures.length > 0) {
    changeCategories.add("removes_features")
  }

  return {
    ...analysis,
    changeCategories: Array.from(changeCategories).slice(0, 6),
    additionalFeatures,
    missingFeatures,
  }
}

function fallbackForkAnalysis(fork: ForkMetadata, diffFacts: DiffFacts): ForkAnalysis {
  const categories = new Set<string>()
  const combinedPaths = diffFacts.topChangedPaths.map((entry) => entry.path.toLowerCase())
  const combinedCommits = diffFacts.uniqueCommits.map((entry) => entry.subject.toLowerCase()).join(" ")

  if (combinedPaths.some((pathValue) => pathValue.includes("readme") || pathValue.includes("logo"))) {
    categories.add("branding")
  }
  if (combinedCommits.includes("perf") || combinedCommits.includes("speed")) {
    categories.add("performance")
  }
  if (combinedCommits.includes("fix") || combinedCommits.includes("bug")) {
    categories.add("bugfixes")
  }
  if (combinedCommits.includes("remove") || combinedCommits.includes("disable")) {
    categories.add("removes_features")
  }
  if (combinedCommits.includes("feature") || combinedCommits.includes("add")) {
    categories.add("features")
  }
  if (combinedPaths.some((pathValue) => pathValue.startsWith("src/") || pathValue.startsWith("packages/"))) {
    categories.add("architectural_experiment")
  }
  if (diffFacts.aheadCount > 80 || diffFacts.changedFiles > 200) {
    categories.add("significant_divergence")
  }

  const maintenance = deriveMaintenanceLabel(fork.pushedDaysAgo)
  const changeMagnitude = deriveMagnitude(diffFacts)

  return enrichForkAnalysis({
    fork: fork.fullName,
    maintenance,
    changeMagnitude,
    likelyPurpose:
      categories.has("branding")
        ? "Customizes the upstream project for a branded or organization-specific use case."
        : categories.has("features")
        ? "Extends upstream with additional capabilities."
        : "Maintains a local variant of upstream with selective changes.",
    changeCategories: Array.from(categories),
    additionalFeatures:
      categories.has("features") || categories.has("architectural_experiment")
        ? diffFacts.topChangedPaths
            .slice(0, 4)
            .map((entry) => `Fork-specific work appears around \`${entry.path}\`.`)
        : [],
    missingFeatures:
      categories.has("removes_features")
        ? ["Some upstream behavior may be removed or intentionally disabled in this fork."]
        : [],
    strengths: [
      `Ahead of upstream by ${diffFacts.aheadCount} commits.`,
      diffFacts.changedFiles > 0
        ? `Touches ${diffFacts.changedFiles} files across ${diffFacts.topChangedDirectories.length || 1} main areas.`
        : "Very close to upstream.",
    ],
    risks: [
      diffFacts.behindCount > 20 ? `Behind upstream by ${diffFacts.behindCount} commits.` : "No major freshness warning detected.",
      maintenance === "stale" ? "Recent maintenance activity looks weak." : "Maintenance signal is acceptable.",
    ],
    idealUsers: [
      changeMagnitude === "minor"
        ? "Users who want a conservative upstream-adjacent fork."
        : "Users who specifically need the fork's additional behavior.",
    ],
    decisionSummary:
      changeMagnitude === "minor"
        ? "This looks like a light customization rather than a fundamentally different product."
        : "This fork is materially different enough that adopters should validate long-term maintenance and upgrade cost.",
    confidence: "medium",
    evidence: [
      `Ahead ${diffFacts.aheadCount}, behind ${diffFacts.behindCount}.`,
      `Top paths: ${diffFacts.topChangedPaths.slice(0, 5).map((entry) => entry.path).join(", ")}`,
      `Recent fork activity: ${fork.pushedAt ?? "unknown"}`,
    ],
  }, diffFacts)
}

export async function analyzeUpstreamWithCodex(
  repoFacts: RepoFacts,
  schemaPath: string,
  debugDir: string,
  cwd: string,
  logger?: Logger,
): Promise<UpstreamAnalysis> {
  const prompt = [
    "# Task",
    "Summarize this upstream open source repository for someone deciding whether its forks are interesting.",
    "",
    "# Constraints",
    "- Use only the facts provided below.",
    "- Do not speculate beyond the evidence.",
    "- Keep the summary practical and concise.",
    "- Return JSON only, matching the schema.",
    "",
    "# Repository Facts",
    "```json",
    JSON.stringify(repoFacts, null, 2),
    "```",
  ].join("\n")

  try {
    return await runCodexJson<UpstreamAnalysis>({
      cwd,
      schemaPath,
      debugDir,
      prompt,
      logger,
    })
  } catch (error) {
    await logger?.warn("codex_upstream_fallback", { error: toErrorMessage(error) })
    return fallbackUpstreamAnalysis(repoFacts)
  }
}

export async function analyzeForkWithCodex(
  fork: ForkMetadata,
  repoFacts: RepoFacts,
  diffFacts: DiffFacts,
  upstreamAnalysis: UpstreamAnalysis,
  schemaPath: string,
  debugDir: string,
  cwd: string,
  logger?: Logger,
): Promise<ForkAnalysis> {
  const prompt = [
    "# Task",
    "Interpret a GitHub fork relative to its upstream. Focus on decision support for adopters.",
    "",
    "# Constraints",
    "- Use only the structured facts below.",
    "- Prefer concrete, user-facing interpretation over raw metrics.",
    "- Explain what kind of user would prefer the fork.",
    "- Include `additionalFeatures` for meaningful capabilities or workflows the fork appears to add beyond upstream.",
    "- Include `missingFeatures` for upstream capabilities the fork appears to remove, lag on, or make harder to use.",
    "- If the diff clearly touches new product areas, platforms, APIs, plugins, or operational workflows, `additionalFeatures` should not be empty.",
    "- If the fork is materially behind upstream or commits mention removing or disabling behavior, call that out in `missingFeatures`.",
    "- Leave either array empty only when the provided evidence genuinely does not support a concrete statement.",
    "- Return JSON only, matching the schema.",
    "",
    "# Upstream Analysis",
    "```json",
    JSON.stringify(upstreamAnalysis, null, 2),
    "```",
    "",
    "# Upstream Facts",
    "```json",
    JSON.stringify(repoFacts, null, 2),
    "```",
    "",
    "# Fork Metadata",
    "```json",
    JSON.stringify(fork, null, 2),
    "```",
    "",
    "# Diff Facts",
    "```json",
    JSON.stringify(diffFacts, null, 2),
    "```",
  ].join("\n")

  try {
    return enrichForkAnalysis(
      await runCodexJson<ForkAnalysis>({
        cwd,
        schemaPath,
        debugDir,
        prompt,
        logger,
      }),
      diffFacts,
    )
  } catch (error) {
    await logger?.warn("codex_fork_fallback", {
      fork: fork.fullName,
      error: toErrorMessage(error),
    })
    return fallbackForkAnalysis(fork, diffFacts)
  }
}
