import { setTimeout as sleep } from "node:timers/promises"

import { toErrorMessage } from "../core/errors.ts"

const retryableMessagePatterns = [
  /rate limit/i,
  /secondary rate limit/i,
  /timeout/i,
  /timed out/i,
  /service unavailable/i,
  /temporarily unavailable/i,
  /fetch failed/i,
  /econnreset/i,
  /enotfound/i,
  /connection reset/i,
  /socket hang up/i,
  /network/i,
  /429/,
  /502/,
  /503/,
  /504/,
]

export function isRetryableWorkerError(message: string): boolean {
  return retryableMessagePatterns.some((pattern) => pattern.test(message))
}

export function computeRetryDelayMs(retryCount: number, baseDelayMs: number): number {
  const safeRetryCount = Math.max(1, retryCount)
  const safeBaseDelayMs = Math.max(1000, baseDelayMs)
  return safeBaseDelayMs * 2 ** (safeRetryCount - 1)
}

export async function runWithRetries<T>(options: {
  maxRetries: number
  baseDelayMs: number
  shouldRetry: (message: string) => boolean
  operation: (context: { retryCount: number }) => Promise<T>
  onRetry?: (context: { retryCount: number; delayMs: number; message: string; maxRetries: number }) => Promise<void> | void
  onTerminalFailure?: (context: { retryCount: number; message: string; maxRetries: number }) => Promise<void> | void
}): Promise<T> {
  let retryCount = 0

  while (true) {
    try {
      return await options.operation({ retryCount })
    } catch (error) {
      const message = toErrorMessage(error)
      const canRetry = retryCount < Math.max(0, options.maxRetries) && options.shouldRetry(message)

      if (!canRetry) {
        await options.onTerminalFailure?.({
          retryCount,
          message,
          maxRetries: options.maxRetries,
        })
        throw error
      }

      retryCount += 1
      const delayMs = computeRetryDelayMs(retryCount, options.baseDelayMs)
      await options.onRetry?.({
        retryCount,
        delayMs,
        message,
        maxRetries: options.maxRetries,
      })
      await sleep(delayMs)
    }
  }
}
