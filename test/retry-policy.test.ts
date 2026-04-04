import { describe, expect, test } from "bun:test"

import { computeRetryDelayMs, isRetryableWorkerError, runWithRetries } from "../src/services/retry-policy.ts"

describe("retry-policy", () => {
  test("classifies common transient worker errors as retryable", () => {
    expect(isRetryableWorkerError("GitHub API rate limit exceeded")).toBe(true)
    expect(isRetryableWorkerError("request timed out after 30000ms")).toBe(true)
    expect(isRetryableWorkerError("Service Unavailable")).toBe(true)
    expect(isRetryableWorkerError("Validation failed for required input")).toBe(false)
  })

  test("backs off exponentially from the configured base delay", () => {
    expect(computeRetryDelayMs(1, 1000)).toBe(1000)
    expect(computeRetryDelayMs(2, 1000)).toBe(2000)
    expect(computeRetryDelayMs(3, 1000)).toBe(4000)
  })

  test("retries transient failures until the operation succeeds", async () => {
    const attempts: number[] = []
    const retries: number[] = []

    const result = await runWithRetries({
      maxRetries: 2,
      baseDelayMs: 1,
      shouldRetry: isRetryableWorkerError,
      operation: async ({ retryCount }) => {
        attempts.push(retryCount)
        if (attempts.length < 2) {
          throw new Error("request timed out")
        }
        return "ok"
      },
      onRetry: async ({ retryCount }) => {
        retries.push(retryCount)
      },
    })

    expect(result).toBe("ok")
    expect(attempts).toEqual([0, 1])
    expect(retries).toEqual([1])
  })

  test("surfaces terminal failures after exhausting the retry budget", async () => {
    const retries: number[] = []
    const terminal: Array<{ retryCount: number; message: string }> = []

    await expect(
      runWithRetries({
        maxRetries: 2,
        baseDelayMs: 1,
        shouldRetry: isRetryableWorkerError,
        operation: async () => {
          throw new Error("429 from upstream")
        },
        onRetry: async ({ retryCount }) => {
          retries.push(retryCount)
        },
        onTerminalFailure: async ({ retryCount, message }) => {
          terminal.push({ retryCount, message })
        },
      }),
    ).rejects.toThrow("429 from upstream")

    expect(retries).toEqual([1, 2])
    expect(terminal).toEqual([{ retryCount: 2, message: "429 from upstream" }])
  })
})
