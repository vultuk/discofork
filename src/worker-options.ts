export type WorkerOptions = {
  includeArchived: boolean
  forkScanLimit: number
  recommendedForkLimit: number
  compareConcurrency: number
}

export const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  includeArchived: false,
  forkScanLimit: 25,
  recommendedForkLimit: 6,
  compareConcurrency: 3,
}

type WorkerEnv = Record<string, string | undefined>

function parsePositiveIntegerSetting(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }

  const trimmed = value.trim()
  const parsed = Number(trimmed)
  if (!trimmed || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer. Received ${JSON.stringify(value)}.`)
  }

  return parsed
}

export function loadWorkerOptions(env: WorkerEnv = process.env): WorkerOptions {
  return {
    includeArchived: DEFAULT_WORKER_OPTIONS.includeArchived,
    forkScanLimit: parsePositiveIntegerSetting(
      "DISCOFORK_FORK_SCAN_LIMIT",
      env.DISCOFORK_FORK_SCAN_LIMIT,
      DEFAULT_WORKER_OPTIONS.forkScanLimit,
    ),
    recommendedForkLimit: parsePositiveIntegerSetting(
      "DISCOFORK_RECOMMENDED_FORK_LIMIT",
      env.DISCOFORK_RECOMMENDED_FORK_LIMIT,
      DEFAULT_WORKER_OPTIONS.recommendedForkLimit,
    ),
    compareConcurrency: parsePositiveIntegerSetting(
      "DISCOFORK_COMPARE_CONCURRENCY",
      env.DISCOFORK_COMPARE_CONCURRENCY,
      DEFAULT_WORKER_OPTIONS.compareConcurrency,
    ),
  }
}
