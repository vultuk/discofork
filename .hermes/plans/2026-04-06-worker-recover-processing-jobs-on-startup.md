# Worker: Recover interrupted processing jobs on startup

## Goal
Requeue repositories stranded in the Redis processing queue after an ungraceful worker stop, and restore queued status/live-status metadata so the worker can resume them automatically on the next boot.

## Why this improvement matters
Today `src/worker.ts` only quarantines invalid queued inputs on startup. If Railway restarts the worker mid-job without the graceful shutdown path finishing, the repo can stay marooned in the processing queue with a stale `processing` status and no automatic path back into active work. That is a reliability gap in the hosted worker lifecycle.

## Current observations
- `src/worker.ts` calls `quarantineQueuedRepoJobs()` before entering the dequeue loop, but it does not recover processing-queue items first.
- `src/server/queue.ts` exposes dequeue/acknowledge/requeue helpers, but nothing to move all stranded processing jobs back to the main queue on startup.
- The graceful shutdown handler already requeues the current job and marks it queued again, so startup recovery should mirror that state restoration for interrupted jobs.
- Existing tests cover retry policy and queue-adjacent behavior, but not startup recovery of interrupted processing jobs.

## Exact files to change
- `README.md`
- `src/server/queue.ts`
- `src/worker.ts`
- `src/services/worker-startup.ts` (new, if needed for testable startup recovery orchestration)
- `test/queue-recovery.test.ts`
- `test/worker-startup.test.ts`

## Step-by-step implementation plan
1. Add a queue recovery primitive that reads the Redis processing queue, appends those jobs back onto the main queue in recoverable order, refreshes their dedupe keys, and clears the processing queue.
2. Add a worker-startup recovery helper that uses that primitive, resets each recovered repo record back to `queued`, and writes queued live-status metadata that explains the startup recovery.
3. Call the startup recovery helper near the top of `src/worker.ts` before queued-job quarantine runs.
4. Add regression tests for the queue recovery primitive and for the worker-startup state-reset behavior.
5. Run targeted tests plus root validation, review the diff, then commit/push and open the PR.

## Validation commands
- `npx bun test test/queue-recovery.test.ts test/worker-startup.test.ts`
- `npx bun run typecheck`
- `npx bun test`

## Risks / rollback notes
- Queue ordering must remain sensible after recovery; recovered jobs should become runnable again without starving newer queued work or duplicating processing entries.
- Persisted repo status and live status must stay aligned with the recovered queue state.
- Rollback is straightforward: revert the recovery helper/module and remove the startup call/tests if the behavior proves too aggressive.
