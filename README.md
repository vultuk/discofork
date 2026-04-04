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
- Delete temporary cloned repositories after each analysis run to avoid local disk bloat
- Export a machine-readable JSON report and a human-readable Markdown report

## Requirements

- Bun 1.3+
- Git
- GitHub CLI (`gh`)
- Codex CLI (`codex`)

OpenTUI is currently Bun-first, so Discofork uses Bun for runtime and tests.

## Installation

```bash
bun install
```

If you publish Discofork to npm, it can also be launched with:

```bash
npx discofork --help
```

The npm executable still requires Bun on `PATH`, because the runtime entrypoint is executed through Bun.

For a one-shot installer similar to `curl ... | bash`, use:

```bash
curl -fsSL https://discofork.ai/install.sh | bash
```

The installer:

- installs Bun if it is missing
- downloads Discofork into `~/.local/share/discofork`
- installs runtime dependencies with Bun
- installs `gh` if it is missing
- installs `codex` if it is missing
- creates a `discofork` launcher in `~/.local/bin`

Installer support notes:

- supports macOS and Linux
- supports `arm64` and `amd64`
- installs `gh` into the selected user-local bin directory
- installs `codex` into the selected user-local bin directory
- does not currently target Windows

You can also target a specific ref:

```bash
curl -fsSL https://discofork.ai/install.sh | bash -s -- --ref main
```

## Usage

Start the interactive app:

```bash
discofork
```

Optionally prefill a repository:

```bash
discofork --repo cli/go-gh
```

Useful flags:

```bash
discofork --repo cli/go-gh --fork-scan-limit 60
discofork --repo cli/go-gh --include-archived
discofork --repo cli/go-gh --recommended-fork-limit 8
discofork --repo cli/go-gh --compare-concurrency 3
```

Environment check:

```bash
bun run start -- doctor
```

## TUI flow

1. Enter a GitHub repository URL or `owner/name`.
2. Discofork discovers upstream metadata and scans forks with `gh`.
3. Before discovery, choose whether default picks should favor highest-star forks or most recent forks.
4. The selection screen shows a filtered fork list, filters unchanged forks before filling the visible scan window, and preselects candidates using the chosen mode.
5. Press `Enter` to analyze the selected forks.
6. Discofork clones locally, compares against upstream, runs Codex interpretation, and exports the report.

Comparison work runs with bounded parallelism and defaults to `3` forks in flight at once. Override it with `--compare-concurrency`.

Key controls:

- `Enter`: discover or analyze
- `Shift+Tab`: toggle highest-star vs most-recent defaults on the input screen
- `j` / `k`: move in fork lists
- `space`: toggle a fork
- `/`: focus the filter input
- `a`: restore the default recommended selection
- `c`: clear selection
- `u`: return from results to selection
- `q` or `Ctrl+C`: quit

## Doctor

Run a local environment check with:

```bash
discofork doctor
```

or:

```bash
bun run start -- doctor
```

It checks:

- Bun, Git, GitHub CLI, and Codex CLI availability
- `gh` login state
- current GitHub core API rate limit
- Codex login state

If you are developing from source instead of using the installed launcher, the equivalent command is:

```bash
bun run start -- doctor
```

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
- `repos/<repo>/...`: temporary clone workspace used during active analysis and deleted afterwards
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

Discofork also keeps an internal cache. If the upstream repository and a fork both have the same `pushedAt` snapshot as a previous run, Discofork reuses the stored facts and analysis instead of cloning, diffing, and prompting Codex again. Temporary clone directories are removed after each run, so the cache is what persists.

If Codex fails, Discofork falls back to deterministic heuristic summaries so the run still completes.

## Web backend

The website now has a real backend shape:

- `GET /api/repo/:owner/:repo` is the backend boundary for repo lookup
- the backend checks Postgres for a cached report first
- if no cached report exists, it writes or refreshes a queued row in Postgres
- it then enqueues the repo in Redis with dedupe, so the same repo is not queued repeatedly
- the frontend route fetches that backend endpoint instead of touching Postgres or Redis directly

If `DATABASE_URL` and `REDIS_URL` are not set for the web app, it falls back to the existing mock/demo data.

## Worker

A separate worker process now exists for backend processing:

```bash
bun run worker
```

The worker:

- watches the Redis queue for repo jobs
- runs Discofork discovery and analysis for the queued repo
- stores the final report JSON in Postgres
- marks failures in Postgres so the web backend can surface queued vs failed vs ready state

Important environment variables for the worker:

- `DATABASE_URL`
- `REDIS_URL`
- `DISCOFORK_FORK_SCAN_LIMIT` optional, defaults to `25`
- `DISCOFORK_RECOMMENDED_FORK_LIMIT` optional, defaults to `6`
- `DISCOFORK_COMPARE_CONCURRENCY` optional, defaults to `3`

## Migrations

Run database migrations with:

```bash
bun run migrate
```

Migrations live in [`migrations/`](/home/ec2-user/development/personal/discofork/migrations).

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

## Railway web deployment

The website is a separate app under `web/`.

For Railway:

1. Create a web service from this repo with **Root Directory** set to `/web`.
2. Keep the service config in `web/railway.toml`.
3. Add PostgreSQL and Redis as separate Railway template services.

Railway's config-as-code applies to a single service deployment, so the TOML config handles the web app itself, while Redis and Postgres should be provisioned as managed services in the same Railway project.

CLI example:

```bash
railway deploy -t postgres
railway deploy -t redis
```

Once those exist, connect them to the web service with environment variables such as:

- `DATABASE_URL`
- `REDIS_URL`
- `DISCOFORK_ADMIN_TOKEN` (shared secret for `/api/stats/refresh` and `/api/repos/requeue-failed`)

For the worker, create a separate service from the repo root and run:

```bash
bun run worker
```

Before first use, run the root migration command once against the target Postgres database:

```bash
bun run migrate
```

### Railway worker container

A Railway-ready worker container is included at:

- [`Dockerfile.worker`](/home/ec2-user/development/personal/discofork/Dockerfile.worker)
- [`railway.worker.toml`](/home/ec2-user/development/personal/discofork/railway.worker.toml)

The worker container installs:

- Bun
- Git
- GitHub CLI (`gh`)
- Codex CLI

Required worker environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `GH_TOKEN` or `GITHUB_TOKEN`
- `OPENAI_API_KEY`

Optional worker tuning:

- `DISCOFORK_FORK_SCAN_LIMIT`
- `DISCOFORK_RECOMMENDED_FORK_LIMIT`
- `DISCOFORK_COMPARE_CONCURRENCY`
- `DISCOFORK_COMMAND_TIMEOUT_MS`
- `DISCOFORK_GITHUB_COMMAND_TIMEOUT_MS`
- `DISCOFORK_CODEX_TIMEOUT_MS`

The container startup script will:

1. verify required env vars
2. configure GitHub CLI as Git's credential helper with `gh auth setup-git`
3. set `GIT_TERMINAL_PROMPT=0` so Git fails fast instead of hanging on auth prompts
4. authenticate Codex from `OPENAI_API_KEY` if needed
5. run `bun run migrate`
6. start `bun run worker`

On Railway, create a separate service from the repo root and point it at `Dockerfile.worker`.

## Railway stats refresh function

If you want the `/stats` page to read only from Redis snapshots, a Railway Function handler is included at:

- [`stats-refresh-function/index.ts`](/home/ec2-user/development/personal/discofork/stats-refresh-function/index.ts)

It calls `https://discofork.ai/api/stats/refresh`, resolves its bearer token from `DISCOFORK_ADMIN_TOKEN` first, and falls back to the legacy `STATS_REFRESH_ADMIN_TOKEN` only for backward compatibility.

If no supported token is configured, the function now fails locally with a `503` payload and `/api/health` reports which env vars are accepted, instead of repeatedly hitting the protected web route without credentials.

If you use Railway Functions, set `DISCOFORK_ADMIN_TOKEN` to the same value as the web service, then paste or point Railway at that file and schedule it every 15 minutes. `STATS_REFRESH_ADMIN_TOKEN` remains a temporary migration fallback for older deployments.

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
- fork analysis is bounded and conservative to keep local execution understandable

This project is meant to be useful first. It is not trying to be a full GitHub mining platform.
