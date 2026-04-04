import { beforeEach, describe, expect, mock, test } from "bun:test"

const databaseModulePath = new URL("../src/server/database.ts", import.meta.url).href
const reportsModulePath = new URL("../src/server/reports.ts?failure-history-test", import.meta.url).href

const queryCalls: Array<{ sql: string; params: unknown[] }> = []

mock.module(databaseModulePath, () => ({
  query: async <T>(sql: string, params: unknown[] = []) => {
    queryCalls.push({ sql, params })
    return [] as T[]
  },
}))

const { markRepoFailedTerminal, markRepoRetrying } = await import(reportsModulePath)

beforeEach(() => {
  queryCalls.length = 0
})

describe("failure history persistence", () => {
  test("markRepoRetrying appends the actual error message placeholder as text", async () => {
    await markRepoRetrying("schema-labs-ltd/discofork", 2, "2026-04-04T12:00:00.000Z", "GitHub timed out")

    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0]?.sql).toContain(`'message', $4::text`)
    expect(queryCalls[0]?.sql).not.toContain(`'message', $2`)
    expect(queryCalls[0]?.params).toEqual([
      "schema-labs-ltd/discofork",
      2,
      "2026-04-04T12:00:00.000Z",
      "GitHub timed out",
    ])
  })

  test("markRepoFailedTerminal appends the actual terminal error message placeholder as text", async () => {
    await markRepoFailedTerminal("schema-labs-ltd/discofork", 3, "Retry budget exhausted")

    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0]?.sql).toContain(`'message', $3::text`)
    expect(queryCalls[0]?.sql).not.toContain(`'message', $2`)
    expect(queryCalls[0]?.params).toEqual([
      "schema-labs-ltd/discofork",
      3,
      "Retry budget exhausted",
    ])
  })
})
