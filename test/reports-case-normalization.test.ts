import { beforeEach, describe, expect, mock, test } from "bun:test"

const databaseModulePath = new URL("../src/server/database.ts", import.meta.url).href
const reportsModulePath = new URL("../src/server/reports.ts?case-normalization-test", import.meta.url).href

const queryCalls: Array<{ sql: string; params: unknown[] }> = []

mock.module(databaseModulePath, () => ({
  query: async <T>(sql: string, params: unknown[] = []) => {
    queryCalls.push({ sql, params })
    return [] as T[]
  },
}))

const { touchQueuedRepo, markRepoProcessing, markRepoReady } = await import(reportsModulePath)

beforeEach(() => {
  queryCalls.length = 0
})

describe("repo report key normalization", () => {
  test("touchQueuedRepo stores canonical lowercase identifiers", async () => {
    await touchQueuedRepo("Schema-Labs-Ltd", "DiscoFork", true)

    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0]?.params.slice(0, 4)).toEqual([
      "schema-labs-ltd/discofork",
      "schema-labs-ltd",
      "discofork",
      "https://github.com/schema-labs-ltd/discofork",
    ])
  })

  test("markRepoProcessing updates repo rows through the canonical lowercase key", async () => {
    await markRepoProcessing("Schema-Labs-Ltd/DiscoFork")

    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0]?.sql).toContain("where lower(full_name) = lower($1)")
    expect(queryCalls[0]?.params).toEqual(["schema-labs-ltd/discofork"])
  })

  test("markRepoReady canonicalizes the report repo key before persisting", async () => {
    await markRepoReady({ repository: { fullName: "Schema-Labs-Ltd/DiscoFork" } } as never)

    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0]?.sql).toContain("where lower(full_name) = lower($1)")
    expect(queryCalls[0]?.params[0]).toBe("schema-labs-ltd/discofork")
  })
})
