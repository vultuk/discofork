import path from "node:path"
import { type InputRenderable } from "@opentui/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"

import { toErrorMessage } from "../core/errors.ts"
import { formatRelativeDays, truncate } from "../core/format.ts"
import type { DiscoveryResult, FinalReport, ForkMetadata, GitHubRepoRef, ProgressEvent } from "../core/types.ts"
import type { CliOptions } from "./args.ts"
import { loadDiscovery, runAnalysis } from "../services/analysis.ts"
import { parseGitHubRepoInput } from "../services/github.ts"

type AppState =
  | { screen: "input" }
  | { screen: "loading"; message: string }
  | { screen: "selection" }
  | { screen: "analysis" }
  | { screen: "results" }

type AnalysisResult = {
  report: FinalReport
  exports: {
    jsonPath: string
    markdownPath: string
  }
  logPath: string
}

function isConfirmKey(name: string): boolean {
  return name === "enter" || name === "return"
}

function makeRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function pushLog(setter: React.Dispatch<React.SetStateAction<string[]>>, event: ProgressEvent): void {
  const line =
    event.type === "phase"
      ? `[${event.phase}] ${event.detail}`
      : event.type === "fork"
        ? `[${event.fork}] ${event.detail}`
        : event.message

  setter((existing) => [...existing.slice(-11), line])
}

function selectionSummary(discovery: DiscoveryResult, selectedCount: number): string {
  const parts = [
    `${discovery.totalForkCount} total forks`,
    `${discovery.scannedForkCount} scanned`,
    `${selectedCount} selected`,
  ]

  if (discovery.archivedExcluded > 0) {
    parts.push(`${discovery.archivedExcluded} archived hidden`)
  }

  if (discovery.unchangedExcluded > 0) {
    parts.push(`${discovery.unchangedExcluded} unchanged hidden`)
  }

  return parts.join(" | ")
}

export function App({ cliOptions }: { cliOptions: CliOptions }) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const cwd = process.cwd()

  const [appState, setAppState] = useState<AppState>({ screen: cliOptions.repoUrl ? "loading" : "input", message: "Ready" })
  const [repoInput, setRepoInput] = useState(cliOptions.repoUrl ?? "")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [selectedForks, setSelectedForks] = useState<Set<string>>(new Set())
  const [filterInput, setFilterInput] = useState("")
  const [focusMode, setFocusMode] = useState<"repo" | "filter" | "list">("repo")
  const [listIndex, setListIndex] = useState(0)
  const [progressLines, setProgressLines] = useState<string[]>([])
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const repoInputRef = useRef<InputRenderable | null>(null)

  const visibleForks = useMemo(() => {
    if (!discovery) {
      return []
    }

    const query = filterInput.trim().toLowerCase()
    if (!query) {
      return discovery.forks
    }

    return discovery.forks.filter((fork) => {
      const haystack = [fork.fullName, fork.description ?? "", fork.scoreReasons.join(" ")].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [discovery, filterInput])

  const highlightedFork = visibleForks[Math.min(listIndex, Math.max(0, visibleForks.length - 1))] ?? null
  const reportHighlightedFork =
    analysisResult?.report.forks[Math.min(listIndex, Math.max(0, analysisResult.report.forks.length - 1))] ?? null

  useEffect(() => {
    if (!cliOptions.repoUrl) {
      return
    }

    void beginDiscovery(cliOptions.repoUrl)
  }, [])

  async function beginDiscovery(rawInput: string): Promise<void> {
    setErrorMessage(null)
    setAppState({ screen: "loading", message: "Discovering forks" })
    setProgressLines([])

    try {
      const repo = parseGitHubRepoInput(rawInput)
      const discoveryResult = await loadDiscovery(
        repo,
        {
          includeArchived: cliOptions.includeArchived,
          forkScanLimit: cliOptions.forkScanLimit,
          recommendedForkLimit: cliOptions.recommendedForkLimit,
        },
        cwd,
        makeRunId(),
      )

      setDiscovery(discoveryResult)
      setSelectedForks(new Set(discoveryResult.forks.filter((fork) => fork.defaultSelected).map((fork) => fork.fullName)))
      setListIndex(0)
      setFocusMode("list")
      setAppState({ screen: "selection" })
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      setAppState({ screen: "input" })
    }
  }

  async function beginAnalysis(): Promise<void> {
    if (!discovery) {
      return
    }

    const forks = discovery.forks.filter((fork) => selectedForks.has(fork.fullName))
    if (forks.length === 0) {
      setErrorMessage("Select at least one fork before starting analysis.")
      return
    }

    setErrorMessage(null)
    setProgressLines([])
    setAppState({ screen: "analysis" })

    try {
      const repo = parseGitHubRepoInput(repoInput)
      const result = await runAnalysis(
        repo,
        forks,
        {
          includeArchived: cliOptions.includeArchived,
          forkScanLimit: cliOptions.forkScanLimit,
          recommendedForkLimit: cliOptions.recommendedForkLimit,
          selectedForks: forks.map((fork) => fork.fullName),
          maxCommitSamples: 12,
          maxChangedFiles: 12,
          workspaceRoot: path.join(cwd, ".discofork"),
          runId: makeRunId(),
        },
        cwd,
        (event) => pushLog(setProgressLines, event),
      )

      setAnalysisResult(result)
      setListIndex(0)
      setAppState({ screen: "results" })
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      setAppState({ screen: "selection" })
    }
  }

  function toggleSelectedFork(fullName: string): void {
    setSelectedForks((existing) => {
      const next = new Set(existing)
      if (next.has(fullName)) {
        next.delete(fullName)
      } else {
        next.add(fullName)
      }
      return next
    })
  }

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      renderer.destroy()
      return
    }

    if (key.name === "q") {
      renderer.destroy()
      return
    }

    if (appState.screen === "input") {
      if (isConfirmKey(key.name)) {
        void beginDiscovery(repoInput)
      }
      return
    }

    if (appState.screen === "loading") {
      return
    }

    if (appState.screen === "selection") {
      if (focusMode === "filter") {
        if (key.name === "escape") {
          setFocusMode("list")
        }
        return
      }

      if (key.name === "j" || key.name === "down") {
        setListIndex((index) => Math.min(index + 1, Math.max(0, visibleForks.length - 1)))
      } else if (key.name === "k" || key.name === "up") {
        setListIndex((index) => Math.max(index - 1, 0))
      } else if (key.name === "space" && highlightedFork) {
        toggleSelectedFork(highlightedFork.fullName)
      } else if (key.name === "a" && discovery) {
        setSelectedForks(new Set(discovery.forks.filter((fork) => fork.defaultSelected).map((fork) => fork.fullName)))
      } else if (key.name === "c") {
        setSelectedForks(new Set())
      } else if (key.name === "slash") {
        setFocusMode("filter")
      } else if (key.name === "tab") {
        setFocusMode((mode) => (mode === "list" ? "filter" : "list"))
      } else if (isConfirmKey(key.name)) {
        void beginAnalysis()
      } else if (key.name === "r") {
        void beginDiscovery(repoInput)
      }
      return
    }

    if (appState.screen === "analysis") {
      return
    }

    if (appState.screen === "results") {
      if (key.name === "j" || key.name === "down") {
        setListIndex((index) => Math.min(index + 1, Math.max(0, (analysisResult?.report.forks.length ?? 1) - 1)))
      } else if (key.name === "k" || key.name === "up") {
        setListIndex((index) => Math.max(index - 1, 0))
      } else if (key.name === "u") {
        setAppState({ screen: "selection" })
      }
    }
  })

  const listHeight = Math.max(6, height - 16)
  const listStart = Math.max(0, Math.min(listIndex - Math.floor(listHeight / 2), Math.max(0, visibleForks.length - listHeight)))
  const listSlice = visibleForks.slice(listStart, listStart + listHeight)

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <box border borderStyle="rounded" padding={1} flexDirection="column">
        <ascii-font font="tiny" text="Discofork" />
        <text>
          <span fg="#8ec07c">Local-first fork analysis with </span>
          <strong>gh</strong>
          <span fg="#8ec07c">, </span>
          <strong>git</strong>
          <span fg="#8ec07c">, and </span>
          <strong>codex</strong>
        </text>
        {errorMessage ? (
          <text fg="#fb4934">{errorMessage}</text>
        ) : (
          <text fg="#83a598">Paste a GitHub URL, select promising forks, then get an interpretable report.</text>
        )}
      </box>

      {appState.screen === "input" || appState.screen === "loading" ? (
        <box border padding={1} flexDirection="column" gap={1}>
          <text>Repository URL or owner/name</text>
          <input
            ref={repoInputRef}
            value={repoInput}
            onChange={setRepoInput}
            onSubmit={() => {
              const submittedValue = repoInputRef.current?.value ?? repoInput
              setRepoInput(submittedValue)
              void beginDiscovery(submittedValue)
            }}
            placeholder="https://github.com/owner/repo"
            focused={focusMode === "repo"}
          />
          <text fg="#b8bb26">
            Enter = discover forks | default scan limit {cliOptions.forkScanLimit} | archived forks{" "}
            {cliOptions.includeArchived ? "included" : "ignored"}
          </text>
          {appState.screen === "loading" ? (
            <text fg="#fabd2f">{appState.message}</text>
          ) : null}
        </box>
      ) : null}

      {appState.screen === "selection" && discovery ? (
        <box flexDirection={width >= 130 ? "row" : "column"} gap={1}>
          <box border padding={1} flexDirection="column" width={width >= 130 ? Math.floor(width * 0.52) : undefined}>
            <text>
              <strong>{discovery.upstream.fullName}</strong>
            </text>
            <text fg="#83a598">{selectionSummary(discovery, selectedForks.size)}</text>
            {discovery.selectionWarning ? <text fg="#fabd2f">{discovery.selectionWarning}</text> : null}
            {discovery.unchangedExcluded > 0 ? (
              <text fg="#83a598">
                Hidden {discovery.unchangedExcluded} fork{discovery.unchangedExcluded === 1 ? "" : "s"} with no upstream changes.
              </text>
            ) : null}
            <input
              value={filterInput}
              onChange={setFilterInput}
              placeholder="Filter forks by owner, description, or score reason"
              focused={focusMode === "filter"}
            />
            <text fg="#b8bb26">j/k move | space toggle | / focus filter | a defaults | c clear | enter analyze</text>
            <box flexDirection="column" marginTop={1}>
              {listSlice.length === 0 ? (
                <text>No forks match the current filter.</text>
              ) : (
                listSlice.map((fork, offset) => {
                  const absoluteIndex = listStart + offset
                  const active = absoluteIndex === listIndex
                  const selected = selectedForks.has(fork.fullName)
                  const prefix = active ? ">" : " "
                  const marker = selected ? "[x]" : "[ ]"
                  const suffix = fork.defaultSelected ? " default" : ""

                  return (
                    <text key={fork.fullName} fg={active ? "#fabd2f" : "#ebdbb2"}>
                      {truncate(`${prefix} ${marker} ${fork.fullName} (${formatRelativeDays(fork.pushedDaysAgo)})${suffix}`, width >= 130 ? 58 : width - 8)}
                    </text>
                  )
                })
              )}
            </box>
          </box>

          <box border padding={1} flexDirection="column" flexGrow={1}>
            {highlightedFork ? (
              <>
                <text>
                  <strong>{highlightedFork.fullName}</strong>
                </text>
                <text>{highlightedFork.description ?? "No description provided."}</text>
                <text fg="#83a598">
                  stars {highlightedFork.stargazerCount} | updated {formatRelativeDays(highlightedFork.pushedDaysAgo)} | score {highlightedFork.score}
                </text>
                <text fg="#8ec07c">Why this fork looks promising</text>
                {highlightedFork.scoreReasons.map((reason) => (
                  <text key={reason}>- {reason}</text>
                ))}
              </>
            ) : (
              <text>No fork selected.</text>
            )}
          </box>
        </box>
      ) : null}

      {appState.screen === "analysis" ? (
        <box border padding={1} flexDirection="column" gap={1}>
          <text>
            <strong>Analysis in progress</strong>
          </text>
          <text fg="#83a598">Clones and Codex transcripts are stored under `.discofork/` for inspection.</text>
          {progressLines.map((line, index) => (
            <text key={`${index}-${line}`}>{line}</text>
          ))}
        </box>
      ) : null}

      {appState.screen === "results" && analysisResult ? (
        <box flexDirection={width >= 130 ? "row" : "column"} gap={1}>
          <box border padding={1} flexDirection="column" width={width >= 130 ? Math.floor(width * 0.45) : undefined}>
            <text>
              <strong>Upstream</strong>
            </text>
            <text>{analysisResult.report.upstream.analysis.summary}</text>
            <text fg="#8ec07c">Recommendations</text>
            <text>- Best maintained: {analysisResult.report.recommendations.bestMaintained ?? "None"}</text>
            <text>- Closest to upstream: {analysisResult.report.recommendations.closestToUpstream ?? "None"}</text>
            <text>- Most feature-rich: {analysisResult.report.recommendations.mostFeatureRich ?? "None"}</text>
            <text>- Most opinionated: {analysisResult.report.recommendations.mostOpinionated ?? "None"}</text>
            <text fg="#83a598">Exports</text>
            <text>{truncate(analysisResult.exports.markdownPath, width >= 130 ? 52 : width - 8)}</text>
            <text>{truncate(analysisResult.exports.jsonPath, width >= 130 ? 52 : width - 8)}</text>
            <text fg="#b8bb26">j/k move | u return to selection | q quit</text>
            <box flexDirection="column" marginTop={1}>
              {analysisResult.report.forks.map((fork, index) => (
                <text key={fork.metadata.fullName} fg={index === listIndex ? "#fabd2f" : "#ebdbb2"}>
                  {truncate(`${index === listIndex ? ">" : " "} ${fork.metadata.fullName}`, width >= 130 ? 52 : width - 8)}
                </text>
              ))}
            </box>
          </box>

          <box border padding={1} flexDirection="column" flexGrow={1}>
            {reportHighlightedFork ? (
              <>
                <text>
                  <strong>{reportHighlightedFork.metadata.fullName}</strong>
                </text>
                <text>{reportHighlightedFork.analysis.decisionSummary}</text>
                <text fg="#83a598">
                  maintenance {reportHighlightedFork.analysis.maintenance} | magnitude {reportHighlightedFork.analysis.changeMagnitude}
                </text>
                <text>Likely purpose: {reportHighlightedFork.analysis.likelyPurpose}</text>
                <text>Best for: {reportHighlightedFork.analysis.idealUsers.join("; ")}</text>
                <text>Strengths:</text>
                {reportHighlightedFork.analysis.strengths.map((item) => (
                  <text key={item}>- {item}</text>
                ))}
                <text>Risks:</text>
                {reportHighlightedFork.analysis.risks.map((item) => (
                  <text key={item}>- {item}</text>
                ))}
              </>
            ) : (
              <text>No analysed fork selected.</text>
            )}
          </box>
        </box>
      ) : null}
    </box>
  )
}
