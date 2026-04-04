# Worker Environment Validation Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Make worker startup fail fast with a clear error when numeric worker environment variables are invalid, instead of silently accepting NaN, zero, negative, or fractional values.

Architecture: Extract worker option parsing into a small dedicated module so worker configuration can be validated independently of the long-running worker entrypoint. Keep the runtime behavior unchanged for valid settings, but reject invalid numeric overrides early with explicit messages.

Tech Stack: Bun, TypeScript, bun:test, Node process environment

---

## Why this improvement matters

src/worker.ts currently uses raw Number(process.env...) casts for DISCOFORK_FORK_SCAN_LIMIT, DISCOFORK_RECOMMENDED_FORK_LIMIT, and DISCOFORK_COMPARE_CONCURRENCY. Invalid values can silently become NaN or other bad numbers and then flow into discovery, fork selection, and concurrent analysis logic. A small validation layer improves reliability and makes bad Railway/environment configuration obvious.

## Current observations

- src/worker.ts builds workerOptions at module scope using raw Number(...) casts.
- Those values are used in discovery selection and runAnalysis(...) concurrency settings.
- The current test suite has no worker-config parsing coverage.
- Root scripts support the relevant validation commands:
  - bun run typecheck
  - bun test

## Exact files to change

- Create: src/worker-options.ts
- Modify: src/worker.ts
- Create: test/worker-options.test.ts

## Step-by-step implementation plan

### Task 1: Add an isolated worker options loader

Objective: Move worker env parsing into a dedicated module that can be tested without importing the long-running worker entrypoint.

Files:
- Create: src/worker-options.ts

Steps:
1. Define a WorkerOptions type with includeArchived, forkScanLimit, recommendedForkLimit, and compareConcurrency.
2. Add a small helper that parses a numeric env value and requires it to be a finite positive integer.
3. Return the existing defaults (25, 6, 3) when the env value is missing.
4. Throw a descriptive error that includes the env var name and invalid value when parsing fails.

### Task 2: Switch the worker to the validated loader

Objective: Ensure the worker uses the validated options module and surfaces startup configuration errors clearly.

Files:
- Modify: src/worker.ts

Steps:
1. Import loadWorkerOptions and any needed types from src/worker-options.ts.
2. Remove the raw Number(process.env...) object literal.
3. Initialize worker options through the loader.
4. Make worker startup print a concise, explicit error and exit non-zero if configuration validation fails.

### Task 3: Add focused tests for worker env parsing

Objective: Lock in correct defaults and rejection behavior.

Files:
- Create: test/worker-options.test.ts

Steps:
1. Add a test that missing env values fall back to the existing defaults.
2. Add a test that valid integer overrides are accepted.
3. Add a test matrix that rejects invalid values such as non-numeric, zero, negative, and fractional strings.
4. Assert the thrown error mentions the offending environment variable.

### Task 4: Validate the targeted change

Objective: Prove the new configuration module works and the codebase remains healthy.

Validation commands:
1. bun test test/worker-options.test.ts
2. bun run typecheck
3. bun test

## Risks / rollback notes

- Risk: Some deployments may already rely on invalid env values that previously degraded silently. This change intentionally surfaces that misconfiguration.
- Tradeoff: Failing fast is stricter than best-effort fallback, but it is safer for a worker process that should not continue with broken concurrency or scan settings.
- Rollback: Revert the PR to restore the previous permissive behavior if startup strictness proves too disruptive.
