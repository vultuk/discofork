import { spawnSync } from "node:child_process"
import { describe, expect, test } from "bun:test"

type ScriptResult<T> = {
  code: number | null
  stdout: T
  stderr: string
}

function runBunScript<T>(script: string): ScriptResult<T> {
  const result = spawnSync("npx", ["bun", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  })

  return {
    code: result.status,
    stdout: JSON.parse(result.stdout || "null") as T,
    stderr: result.stderr,
  }
}

describe("failed repo bulk requeue", () => {
  test("listFailedRepoNames excludes suspicious routes from the failed-row query", () => {
    const result = runBunScript<{ names: string[]; queryCalls: Array<{ sql: string; params: unknown[] }> }>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      const queryCalls = []
      mock.module(databaseModulePath, () => ({
        databaseConfigured: () => true,
        query: async (sql, params = []) => {
          queryCalls.push({ sql, params })
          return [{ full_name: "schema-labs-ltd/discofork" }]
        },
      }))
      const { listFailedRepoNames } = await import(new URL("./web/src/lib/server/reports.ts", import.meta.url).href)
      const names = await listFailedRepoNames()
      console.log(JSON.stringify({ names, queryCalls }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.names).toEqual(["schema-labs-ltd/discofork"])
    expect(result.stdout.queryCalls).toHaveLength(1)
    expect(result.stdout.queryCalls[0]?.params).toEqual([])
    expect(result.stdout.queryCalls[0]?.sql).toContain("where not (")
    expect(result.stdout.queryCalls[0]?.sql).toContain("status = 'failed'")
    expect(result.stdout.queryCalls[0]?.sql).toContain("lower(owner) in ('.well-known')")
    expect(result.stdout.queryCalls[0]?.sql).toContain("lower(owner || '/' || repo) in ('admin/.env', 'wp-admin/admin-ajax.php')")
  })

  test("requeueFailedRepos still enqueues legitimate failed repos and marks queued successes", () => {
    const result = runBunScript<{
      requeueResult: { failedCount: number; requeuedCount: number }
      enqueueCalls: string[]
      markQueuedCalls: string[][]
    }>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      const queueModulePath = new URL("./web/src/lib/server/queue.ts", import.meta.url).href
      const reportsModulePath = new URL("./web/src/lib/server/reports.ts", import.meta.url).href
      const enqueueCalls = []
      const markQueuedCalls = []
      mock.module(databaseModulePath, () => ({
        databaseConfigured: () => true,
      }))
      mock.module(queueModulePath, () => ({
        queueConfigured: () => true,
        enqueueRepoJob: async (fullName) => {
          enqueueCalls.push(fullName)
          return fullName !== "schema-labs-ltd/already-tracked"
        },
      }))
      mock.module(reportsModulePath, () => ({
        listFailedRepoNames: async () => ["schema-labs-ltd/discofork", "schema-labs-ltd/already-tracked"],
        markReposQueued: async (fullNames) => {
          markQueuedCalls.push([...fullNames])
        },
      }))
      const { requeueFailedRepos } = await import(new URL("./web/src/lib/server/admin-operations.ts", import.meta.url).href)
      const requeueResult = await requeueFailedRepos()
      console.log(JSON.stringify({ requeueResult, enqueueCalls, markQueuedCalls }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.requeueResult).toEqual({
      failedCount: 2,
      requeuedCount: 1,
    })
    expect(result.stdout.enqueueCalls).toEqual([
      "schema-labs-ltd/discofork",
      "schema-labs-ltd/already-tracked",
    ])
    expect(result.stdout.markQueuedCalls).toEqual([["schema-labs-ltd/discofork"]])
  })
})
