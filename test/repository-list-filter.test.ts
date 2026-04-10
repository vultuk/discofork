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

describe("repository list filtering", () => {
  test("buildRepoListWhereClause excludes suspicious rows and composes status and search filters", () => {
    const result = runBunScript<{
      whereAll: { clause: string; params: unknown[] }
      whereFailed: { clause: string; params: unknown[] }
    }>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      mock.module(databaseModulePath, () => ({ query: async () => [] }))
      const { buildRepoListWhereClause } = await import(new URL("./web/src/lib/server/reports.ts", import.meta.url).href)
      console.log(JSON.stringify({
        whereAll: buildRepoListWhereClause("all"),
        whereFailed: buildRepoListWhereClause("failed", "cli_go%"),
      }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout.whereAll.clause).toContain("not (")
    expect(result.stdout.whereAll.clause).toContain("lower(owner) in ('.well-known')")
    expect(result.stdout.whereAll.clause).toContain("lower(owner || '/' || repo) in ('admin/.env', 'wp-admin/admin-ajax.php')")
    expect(result.stdout.whereAll.clause).toContain("position('/' in repo) > 0")
    expect(result.stdout.whereAll.clause).not.toContain("lower(repo) in")
    expect(result.stdout.whereAll.clause).not.toContain("status =")
    expect(result.stdout.whereAll.params).toEqual([])
    expect(result.stdout.whereFailed.clause).toContain("status = $1")
    expect(result.stdout.whereFailed.clause).toContain("full_name ilike $2 escape")
    expect(result.stdout.whereFailed.params).toEqual(["failed", "%cli\\_go\\%%"])
  })

  test("listRepoRecords applies suspicious-row filtering to stats, totals, and item queries while preserving global stats", () => {
    const result = runBunScript<Array<{ sql: string; params: unknown[] }>>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      const queryCalls = []
      mock.module(databaseModulePath, () => ({
        query: async (sql, params = []) => {
          queryCalls.push({ sql, params })
          if (queryCalls.length === 1) {
            return [{ total: 3, queued: 1, processing: 1, pending: 2, cached: 1, failed: 0 }]
          }
          if (queryCalls.length === 2) {
            return [{ count: "2" }]
          }
          return []
        },
      }))
      const { listRepoRecords } = await import(new URL("./web/src/lib/server/reports.ts", import.meta.url).href)
      await listRepoRecords(1, 20, "updated", "failed", "codex")
      console.log(JSON.stringify(queryCalls))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toHaveLength(3)

    expect(result.stdout[0]?.sql).toContain("not (")
    expect(result.stdout[0]?.sql).not.toContain("status = $1")
    expect(result.stdout[0]?.sql).not.toContain("full_name ilike")
    expect(result.stdout[0]?.params).toEqual([])

    expect(result.stdout[1]?.sql).toContain("not (")
    expect(result.stdout[1]?.sql).toContain("status = $1")
    expect(result.stdout[1]?.sql).toContain("full_name ilike $2 escape")
    expect(result.stdout[1]?.params).toEqual(["failed", "%codex%"])

    expect(result.stdout[2]?.sql).toContain("not (")
    expect(result.stdout[2]?.sql).toContain("status = $1")
    expect(result.stdout[2]?.sql).toContain("full_name ilike $2 escape")
    expect(result.stdout[2]?.sql).toContain("limit $3")
    expect(result.stdout[2]?.sql).toContain("offset $4")
    expect(result.stdout[2]?.params).toEqual(["failed", "%codex%", 20, 0])
  })
})
