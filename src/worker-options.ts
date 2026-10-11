export type WorkerOptions = {
  includeArchived: boolean
  forkScanLimit: number
  recommendedForkLimit: number
  compareConcurrency: number
  maxRetries: number
  retryBaseDelayMs: number
}

export const DEFAULT_WORKER_OPTIONS: WorkerOptions = {
  includeArchived: false,
  forkScanLimit: 25,
  recommendedForkLimit: 6,
  compareConcurrency: 3,
  maxRetries: 2,
  retryBaseDelayMs: 5000,
}

type WorkerEnv = Record<string, string | undefined>

function parseIntegerSetting(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  description: string,
): number {
  if (value === undefined) {
    return fallback
  }

  const trimmed = value.trim()
  const parsed = Number(trimmed)
  if (!trimmed || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be ${description}. Received ${JSON.stringify(value)}.`)
  }

  return parsed
}

function parsePositiveIntegerSetting(name: string, value: string | undefined, fallback: number): number {
  return parseIntegerSetting(name, value, fallback, 1, "a positive integer")
}

function parseNonNegativeIntegerSetting(name: string, value: string | undefined, fallback: number): number {
  return parseIntegerSetting(name, value, fallback, 0, "a non-negative integer")
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
    maxRetries: parseNonNegativeIntegerSetting(
      "DISCOFORK_WORKER_MAX_RETRIES",
      env.DISCOFORK_WORKER_MAX_RETRIES,
      DEFAULT_WORKER_OPTIONS.maxRetries,
    ),
    retryBaseDelayMs: parseNonNegativeIntegerSetting(
      "DISCOFORK_WORKER_RETRY_BASE_DELAY_MS",
      env.DISCOFORK_WORKER_RETRY_BASE_DELAY_MS,
      DEFAULT_WORKER_OPTIONS.retryBaseDelayMs,
    ),
  }
}
