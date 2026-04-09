# Validate worker retry settings before job processing

## Goal
Make Discofork fail fast when `DISCOFORK_WORKER_MAX_RETRIES` or `DISCOFORK_WORKER_RETRY_BASE_DELAY_MS` is malformed instead of silently running the worker with `NaN` retry configuration.

## Why this improvement matters
`src/worker.ts` still parses those retry env vars with raw `Number(...)` casts while `src/worker-options.ts` already validates the other worker numeric settings. A malformed retry value can silently disable retries or emit broken retry metadata, which makes worker behaviour harder to diagnose in production.

## Current observations
- `src/worker.ts` reads `DISCOFORK_WORKER_MAX_RETRIES` and `DISCOFORK_WORKER_RETRY_BASE_DELAY_MS` directly with `Number(...)`.
- `src/worker-options.ts` already has shared numeric validation for the other worker settings.
- `test/worker-options.test.ts` covers the validated worker settings but not the retry controls.
- `src/services/retry-policy.ts` already handles runtime retry semantics; the missing piece is input validation and using validated settings consistently.

## Exact files to change
- `src/worker-options.ts`
- `src/worker.ts`
- `test/worker-options.test.ts`

## Step-by-step implementation plan
1. Extend the shared worker options shape to include validated retry settings and defaults.
2. Add parsing helpers for positive and non-negative integer env values so retry settings can be validated alongside the existing worker numeric options.
3. Update `src/worker.ts` to use the parsed retry settings from `loadWorkerOptions()` instead of raw environment casts.
4. Expand `test/worker-options.test.ts` to cover defaults, valid overrides, and invalid retry env values.
5. Run typecheck and focused tests, then review the local diff before committing.

## Validation commands
- `npx bun run typecheck`
- `npx bun test test/worker-options.test.ts`
- `npx bun test test/retry-policy.test.ts`

## Risks / rollback notes
- Keep the change scoped to configuration parsing; do not alter the retry backoff algorithm itself.
- `DISCOFORK_WORKER_MAX_RETRIES=0` should remain a valid way to disable retries if current semantics already permit it.
- If the new validation accidentally changes worker defaults, revert `src/worker-options.ts` and `src/worker.ts` together.
