import { describe, expect, test } from "bun:test"

import {
  REPO_PROCESSING_QUEUE_KEY,
  REPO_QUEUE_DEDUPE_PREFIX,
  REPO_QUEUE_DEDUPE_TTL_SECONDS,
  REPO_QUEUE_KEY,
} from "../src/server/constants.ts"
import { recoverProcessingRepoJobsWithClient } from "../src/server/queue.ts"

describe("recoverProcessingRepoJobsWithClient", () => {
  test("moves interrupted processing jobs back to the main queue, refreshes dedupe keys, and clears processing", async () => {
    const queue = ["schema-labs-ltd/newer-job"]
    const processing = ["schema-labs-ltd/repo-b", "schema-labs-ltd/repo-a", "schema-labs-ltd/repo-b"]
    const dedupe = new Map<string, { value: string; options: { EX: number } }>()
    const operations: Array<() => void> = []

    const multi: any = {
      rPush(key: string, value: string) {
        operations.push(() => {
          if (key === REPO_QUEUE_KEY) {
            queue.push(value)
          }
        })
        return multi
      },
      set(key: string, value: string, options: { EX: number }) {
        operations.push(() => {
          dedupe.set(key, { value, options })
        })
        return multi
      },
      del(key: string) {
        operations.push(() => {
          if (key === REPO_PROCESSING_QUEUE_KEY) {
            processing.length = 0
          }
        })
        return multi
      },
      async exec() {
        for (const operation of operations) {
          operation()
        }
        return []
      },
    }

    const redis = {
      lRange: async (key: string) => {
        expect(key).toBe(REPO_PROCESSING_QUEUE_KEY)
        return [...processing]
      },
      multi: () => multi,
    } as any

    const recovered = await recoverProcessingRepoJobsWithClient(redis)

    expect(recovered).toEqual(["schema-labs-ltd/repo-b", "schema-labs-ltd/repo-a"])
    expect(queue).toEqual([
      "schema-labs-ltd/newer-job",
      "schema-labs-ltd/repo-b",
      "schema-labs-ltd/repo-a",
    ])
    expect(processing).toEqual([])
    expect(dedupe).toEqual(
      new Map([
        [`${REPO_QUEUE_DEDUPE_PREFIX}schema-labs-ltd/repo-b`, { value: "1", options: { EX: REPO_QUEUE_DEDUPE_TTL_SECONDS } }],
        [`${REPO_QUEUE_DEDUPE_PREFIX}schema-labs-ltd/repo-a`, { value: "1", options: { EX: REPO_QUEUE_DEDUPE_TTL_SECONDS } }],
      ]),
    )
  })

  test("is a no-op when no interrupted processing jobs exist", async () => {
    let execCalls = 0
    const redis = {
      lRange: async () => [],
      multi: () => ({
        async exec() {
          execCalls += 1
          return []
        },
      }),
    } as any

    const recovered = await recoverProcessingRepoJobsWithClient(redis)

    expect(recovered).toEqual([])
    expect(execCalls).toBe(0)
  })
})
