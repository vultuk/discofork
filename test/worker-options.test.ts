import { describe, expect, test } from "bun:test"

import { DEFAULT_WORKER_OPTIONS, loadWorkerOptions } from "../src/worker-options.ts"

describe("loadWorkerOptions", () => {
  test("falls back to defaults when env values are missing", () => {
    expect(loadWorkerOptions({})).toEqual(DEFAULT_WORKER_OPTIONS)
  })

  test("accepts valid integer overrides", () => {
    expect(
      loadWorkerOptions({
        DISCOFORK_FORK_SCAN_LIMIT: "40",
        DISCOFORK_RECOMMENDED_FORK_LIMIT: "8",
        DISCOFORK_COMPARE_CONCURRENCY: "5",
      }),
    ).toEqual({
      ...DEFAULT_WORKER_OPTIONS,
      forkScanLimit: 40,
      recommendedForkLimit: 8,
      compareConcurrency: 5,
    })
  })

  for (const [name, value] of [
    ["DISCOFORK_FORK_SCAN_LIMIT", "not-a-number"],
    ["DISCOFORK_FORK_SCAN_LIMIT", "0"],
    ["DISCOFORK_RECOMMENDED_FORK_LIMIT", "-1"],
    ["DISCOFORK_COMPARE_CONCURRENCY", "1.5"],
    ["DISCOFORK_COMPARE_CONCURRENCY", "   "],
  ] satisfies Array<[string, string]>) {
    test(`rejects ${name}=${JSON.stringify(value)}`, () => {
      expect(() => loadWorkerOptions({ [name]: value })).toThrow(name)
    })
  }
})
