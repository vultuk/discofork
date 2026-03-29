# Discofork

Discofork is a local-first terminal application for evaluating GitHub forks of an open source project.

It uses:

- `gh` for GitHub metadata and fork discovery
- `git` for cloning, fetching, and structured diff facts
- `codex` CLI for repository and fork interpretation
- OpenTUI + TypeScript for the interactive terminal interface

The goal is practical fork selection, not raw diff archaeology. Discofork gathers compact facts first, then asks Codex to explain what those facts mean.

## Why it exists

Large fork graphs are noisy. Most forks are inactive, archived, or exact mirrors. The useful question is usually:

- what the upstream project does
- which forks are actually maintained
- which forks add meaningful behavior
- which fork is best for stability, features, or experimentation

Discofork is built around that decision workflow.

## Features

- Paste a GitHub repository URL directly into the TUI
- Discover forks with local `gh`
- Ignore archived forks by default
- Limit discovery sensibly when the fork count is huge
- Preselect more promising forks using recency and star-based heuristics
- Clone upstream and selected forks locally with `git`
- Compare forks to upstream without dumping giant raw diffs into the model
- Run structured, schema-constrained `codex exec` prompts
- Persist prompts, raw Codex output, logs, and exports under `.discofork/`
- Reuse cached upstream and fork analyses when neither upstream nor fork has changed since the last run
- Export a machine-readable JSON report and a human-readable Markdown report

## Requirements

- Bun 1.3+
- Git
- GitHub CLI (`gh`) authenticated against GitHub
- Codex CLI (`codex`)

OpenTUI is currently Bun-first, so Discofork uses Bun for runtime and tests.

## Installation

```bash
bun install
```

## Usage

Start the interactive app:

```bash
bun run start
```

Optionally prefill a repository:

```bash
bun run start -- --repo cli/go-gh
```

Useful flags:

```bash
bun run start -- --repo cli/go-gh --fork-scan-limit 60
bun run start -- --repo cli/go-gh --include-archived
bun run start -- --repo cli/go-gh --recommended-fork-limit 8
```

## TUI flow

1. Enter a GitHub repository URL or `owner/name`.
2. Discofork discovers upstream metadata and scans forks with `gh`.
3. The selection screen shows a filtered fork list and preselects promising candidates.
4. Press `Enter` to analyze the selected forks.
5. Discofork clones locally, compares against upstream, runs Codex interpretation, and exports the report.

Key controls:

- `Enter`: discover or analyze
- `j` / `k`: move in fork lists
- `space`: toggle a fork
- `/`: focus the filter input
- `a`: restore the default recommended selection
- `c`: clear selection
- `u`: return from results to selection
- `q` or `Ctrl+C`: quit

## Output layout

Every run writes artifacts under `.discofork/`.

```text
.discofork/
  cache/
  logs/
  repos/
  runs/<run-id>/
    codex/
    reports/
      analysis.json
      analysis.md
```

Notable files:

- `cache/<repo>/upstream.json`: cached upstream facts and summary keyed by upstream freshness
- `cache/<repo>/forks/<fork>.json`: cached per-fork diff facts and interpretation keyed by both upstream and fork freshness
- `logs/<run-id>.jsonl`: structured app logs
- `runs/<run-id>/codex/.../prompt.md`: exact Codex prompt used
- `runs/<run-id>/codex/.../output.json`: final schema-constrained Codex output
- `runs/<run-id>/reports/analysis.json`: machine-readable final report
- `runs/<run-id>/reports/analysis.md`: human-readable final report

## Analysis strategy

Discofork intentionally avoids sending giant raw diffs to Codex.

Instead it gathers:

- upstream metadata and README/manifests
- top-level tree structure
- recent commit subjects
- ahead/behind counts
- changed-file counts, insertions, deletions, rename counts
- top changed directories and file types
- a compact list of the most significant changed files

Those structured facts are then passed into Codex with JSON Schema constraints.

Discofork also keeps an internal cache. If the upstream repository and a fork both have the same `pushedAt` / `updatedAt` snapshot as a previous run, Discofork reuses the stored facts and analysis instead of cloning, diffing, and prompting Codex again.

If Codex fails, Discofork falls back to deterministic heuristic summaries so the run still completes.

## Development

Run checks:

```bash
bun run check
```

Run tests:

```bash
bun test
```

Typecheck only:

```bash
bun run typecheck
```

## Example output

Checked-in example exports live in:

- `examples/cli-go-gh.analysis.md`
- `examples/cli-go-gh.analysis.json`

These were produced from a real smoke run against `cli/go-gh`.

## Scope notes

Current defaults are intentionally pragmatic:

- archived forks are hidden unless explicitly included
- large fork networks are sampled instead of exhaustively analyzed
- recommended forks are chosen using maintenance/activity signals before deep analysis
- fork analysis is sequential and conservative to keep local execution understandable

This project is meant to be useful first. It is not trying to be a full GitHub mining platform.
