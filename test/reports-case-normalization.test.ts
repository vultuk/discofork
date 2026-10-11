import { spawnSync } from "node:child_process"
import { describe, expect, test } from "bun:test"

function runScript(script: string) {
  const result = spawnSync(process.execPath, ["-e", script], { cwd: process.cwd(), encoding: "utf8", timeout: 5000 })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout)
}

function captureQueries(body: string, web = false) {
  const root = `${process.cwd()}/${web ? "web/src/lib/server" : "src/server"}`
  return runScript(`
    import { mock } from "bun:test"
    const calls = []
    mock.module(${JSON.stringify(root + "/database.ts")}, () => ({
      query: async (sql, params = []) => { calls.push({ sql, params }); return [] },
    }))
    const reports = await import(${JSON.stringify(root + "/reports.ts")})
    ${body}
    console.log(JSON.stringify(calls))
  `)
}

describe("repo report key normalization", () => {
  for (const web of [false, true]) {
    test(`${web ? "web" : "worker"} stores one canonical identity`, () => {
      const calls = captureQueries('await reports.touchQueuedRepo("Schema-Labs-Ltd", "DiscoFork", true)', web)
      expect(calls).toHaveLength(1)
      expect(calls[0].params.slice(0, 4)).toEqual([
        "schema-labs-ltd/discofork", "schema-labs-ltd", "discofork", "https://github.com/schema-labs-ltd/discofork",
      ])
    })

    test(`${web ? "web" : "worker"} reads case-insensitively with the canonical key`, () => {
      const calls = captureQueries('await reports.getRepoRecord("Schema-Labs-Ltd/DiscoFork")', web)
      expect(calls[0].sql).toContain("where lower(full_name) = lower($1)")
      expect(calls[0].params).toEqual(["schema-labs-ltd/discofork"])
    })
  }

  test("worker lifecycle updates use the same canonical stored key", () => {
    const calls = captureQueries(`
      await reports.markRepoProcessing("Schema-Labs-Ltd/DiscoFork")
      await reports.markRepoRetrying("Schema-Labs-Ltd/DiscoFork",1,"2026-10-11T18:00:00Z","retry")
      await reports.markRepoReady({ repository: { fullName: "Schema-Labs-Ltd/DiscoFork" } })
      await reports.markRepoFailedTerminal("Schema-Labs-Ltd/DiscoFork",2,"failed")
    `)
    expect(calls).toHaveLength(4)
    for (const call of calls) {
      expect(call.sql).toContain("where lower(full_name) = lower($1)")
      expect(call.params[0]).toBe("schema-labs-ltd/discofork")
    }
  })

  test("worker progress writes use a canonical Redis key", () => {
    const root = `${process.cwd()}/src/server`
    const calls = runScript(`
      import { mock } from "bun:test"
      const calls = []
      mock.module(${JSON.stringify(root + "/queue.ts")}, () => ({
        getRedisClient: async () => ({ set: async (key, value) => calls.push({key, value: JSON.parse(value)}) }),
      }))
      const { writeRepoLiveStatus } = await import(${JSON.stringify(root + "/live-status.ts")})
      await writeRepoLiveStatus("Schema-Labs-Ltd/DiscoFork", {status:"processing",phase:"analysis",detail:null,current:1,total:2})
      console.log(JSON.stringify(calls))
    `)
    expect(calls[0].key).toBe("discofork:repo-progress:schema-labs-ltd/discofork")
    expect(calls[0].value.status).toBe("processing")
  })

  test("web status retains legacy mixed-case progress via the stored row identity", () => {
    const root = `${process.cwd()}/web/src/lib/server`
    const result = runScript(`
      import { mock } from "bun:test"
      const calls = []
      mock.module(${JSON.stringify(root + "/database.ts")}, () => ({
        query: async (sql, params) => {
          calls.push({sql,params})
          return [{ full_name:"Schema-Labs-Ltd/DiscoFork", status:"queued" }]
        },
      }))
      mock.module(${JSON.stringify(root + "/queue.ts")}, () => ({
        queueConfigured: () => true,
        getRepoQueueState: async () => ({queuePosition:null,processing:false}),
        getRedisClient: async () => ({ get: async key => key === "discofork:repo-progress:Schema-Labs-Ltd/DiscoFork"
          ? JSON.stringify({status:"processing",phase:"analysis",detail:"legacy",current:1,total:2}) : null }),
      }))
      const { getRepoStatusSnapshot } = await import(${JSON.stringify(root + "/live-status.ts")})
      const snapshot = await getRepoStatusSnapshot("schema-labs-ltd/discofork")
      console.log(JSON.stringify({snapshot,calls}))
    `)
    expect(result.snapshot).toMatchObject({status:"processing",progress:{phase:"analysis",detail:"legacy",current:1,total:2}})
    expect(result.calls[0].params).toEqual(["schema-labs-ltd/discofork"])
    expect(result.calls[0].sql).toContain("where lower(full_name) = lower($1)")
  })

  test("watch activity canonicalises the database batch and returns every original alias", () => {
    const root = `${process.cwd()}/web/src/lib/server`
    const result = runScript(`
      import { mock } from "bun:test"
      const calls = []
      mock.module(${JSON.stringify(root + "/database.ts")}, () => ({
        query: async (sql, params) => {
          calls.push({sql,params})
          return [{ full_name:"org/repo", status:"ready", cached_at:"2026-10-11T17:00:00Z" }]
        },
      }))
      const { getRepoCacheActivities } = await import(${JSON.stringify(root + "/reports.ts")})
      const activities = await getRepoCacheActivities(["Org/Repo", "ORG/REPO", "org/repo", "Missing/Repo"])
      console.log(JSON.stringify({activities,calls}))
    `)
    expect(result.calls[0].params).toEqual([["org/repo", "missing/repo"]])
    expect(result.calls[0].sql).toContain("where lower(full_name) = any($1::text[])")
    expect(result.activities).toEqual({
      "Org/Repo": { status: "cached", cachedAt: "2026-10-11T17:00:00Z" },
      "ORG/REPO": { status: "cached", cachedAt: "2026-10-11T17:00:00Z" },
      "org/repo": { status: "cached", cachedAt: "2026-10-11T17:00:00Z" },
      "Missing/Repo": { status: "missing", cachedAt: null },
    })
  })
})
