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

describe("repos API route", () => {
  test("passes normalized query params through to listRepoRecords and the JSON payload", () => {
    const result = runBunScript<{
      calls: Array<[number, number, string, string, string]>
      status: number
      body: unknown
    }>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      const queueModulePath = new URL("./web/src/lib/server/queue.ts", import.meta.url).href
      const reportsModulePath = new URL("./web/src/lib/server/reports.ts", import.meta.url).href
      const routeModulePath = new URL("./web/src/app/api/repos/route.ts", import.meta.url).href
      const calls = []
      mock.module(databaseModulePath, () => ({ databaseConfigured: () => true }))
      mock.module(queueModulePath, () => ({ queueConfigured: () => true }))
      mock.module(reportsModulePath, () => ({
        listRepoRecords: async (...args) => {
          calls.push(args)
          return {
            items: [{
              full_name: "openai/codex",
              owner: "openai",
              repo: "codex",
              github_url: "https://github.com/openai/codex",
              status: "ready",
              queued_at: null,
              processing_started_at: null,
              cached_at: "2026-04-10T22:00:00Z",
              updated_at: "2026-04-10T22:00:00Z",
              retry_count: 0,
              retry_state: "none",
              next_retry_at: null,
              last_failed_at: null,
              stars: 123,
              forks: 45,
              default_branch: "main",
              last_pushed_at: "2026-04-10T21:00:00Z",
              upstream_summary: "Codex summary",
              fork_brief_count: 2,
            }],
            stats: {
              total: 10,
              queued: 1,
              processing: 2,
              pending: 3,
              cached: 7,
              failed: 1,
            },
            total: 1,
          }
        },
      }))
      const { GET } = await import(routeModulePath)
      const response = await GET({ nextUrl: new URL("https://discofork.ai/api/repos?page=4&order=forks&status=failed&query=%20codex%20") })
      console.log(JSON.stringify({ calls, status: response.status, body: await response.json() }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toEqual({
      calls: [[4, 25, "forks", "failed", "codex"]],
      status: 200,
      body: {
        items: [
          {
            fullName: "openai/codex",
            owner: "openai",
            repo: "codex",
            githubUrl: "https://github.com/openai/codex",
            status: "ready",
            queuedAt: null,
            processingStartedAt: null,
            cachedAt: "2026-04-10T22:00:00Z",
            updatedAt: "2026-04-10T22:00:00Z",
            retryCount: 0,
            retryState: "none",
            nextRetryAt: null,
            lastFailedAt: null,
            stars: 123,
            forks: 45,
            defaultBranch: "main",
            lastPushedAt: "2026-04-10T21:00:00Z",
            upstreamSummary: "Codex summary",
            forkBriefCount: 2,
          },
        ],
        stats: {
          total: 10,
          queued: 1,
          processing: 2,
          pending: 3,
          cached: 7,
          failed: 1,
        },
        order: "forks",
        statusFilter: "failed",
        query: "codex",
        page: 4,
        pageSize: 25,
        total: 1,
        totalPages: 1,
        hasPrevious: true,
        hasNext: false,
        databaseEnabled: true,
        queueEnabled: true,
      },
    })
  })

  test("returns an empty disabled-database payload with a normalized blank query", () => {
    const result = runBunScript<{ calls: unknown[]; status: number; body: unknown }>(`
      import { mock } from "bun:test"
      const databaseModulePath = new URL("./web/src/lib/server/database.ts", import.meta.url).href
      const queueModulePath = new URL("./web/src/lib/server/queue.ts", import.meta.url).href
      const reportsModulePath = new URL("./web/src/lib/server/reports.ts", import.meta.url).href
      const routeModulePath = new URL("./web/src/app/api/repos/route.ts", import.meta.url).href
      const calls = []
      mock.module(databaseModulePath, () => ({ databaseConfigured: () => false }))
      mock.module(queueModulePath, () => ({ queueConfigured: () => true }))
      mock.module(reportsModulePath, () => ({
        listRepoRecords: async (...args) => {
          calls.push(args)
          return { items: [], stats: { total: 0, queued: 0, processing: 0, pending: 0, cached: 0, failed: 0 }, total: 0 }
        },
      }))
      const { GET } = await import(routeModulePath)
      const response = await GET({ nextUrl: new URL("https://discofork.ai/api/repos?page=2&query=%20%20") })
      console.log(JSON.stringify({ calls, status: response.status, body: await response.json() }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toEqual({
      calls: [],
      status: 200,
      body: {
        items: [],
        stats: {
          total: 0,
          queued: 0,
          processing: 0,
          pending: 0,
          cached: 0,
          failed: 0,
        },
        order: "updated",
        statusFilter: "all",
        query: "",
        page: 2,
        pageSize: 25,
        total: 0,
        totalPages: 0,
        hasPrevious: true,
        hasNext: false,
        databaseEnabled: false,
        queueEnabled: true,
      },
    })
  })
})
