import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

const databaseModulePath = new URL("../web/src/lib/server/database.ts", import.meta.url).href
const liveStatusModulePath = new URL("../web/src/lib/server/live-status.ts", import.meta.url).href
const queueModulePath = new URL("../web/src/lib/server/queue.ts", import.meta.url).href
const reportsModulePath = new URL("../web/src/lib/server/reports.ts", import.meta.url).href
const repositoryServiceModulePath = new URL("../web/src/lib/repository-service.ts", import.meta.url).href

const enqueueCalls: string[] = []
const touchCalls: Array<{ owner: string; repo: string; queuedNow: boolean }> = []
const fetchCalls: string[] = []

let databaseEnabled = true
let queueEnabled = true
let repoRecord: any = null
let statusSnapshot: any = null
let fetchStatus = 200

mock.module(databaseModulePath, () => ({
  databaseConfigured: () => databaseEnabled,
}))

mock.module(liveStatusModulePath, () => ({
  getRepoStatusSnapshot: async () => statusSnapshot,
}))

mock.module(queueModulePath, () => ({
  enqueueRepoJob: async (fullName: string) => {
    enqueueCalls.push(fullName)
    return true
  },
  getRedisClient: async () => ({ get: async () => null, set: async () => "OK" }) as unknown,
  queueConfigured: () => queueEnabled,
}))

mock.module(reportsModulePath, () => ({
  getRepoRecord: async () => repoRecord,
  touchQueuedRepo: async (owner: string, repo: string, queuedNow: boolean) => {
    touchCalls.push({ owner, repo, queuedNow })
    repoRecord = {
      full_name: `${owner}/${repo}`,
      owner,
      repo,
      github_url: `https://github.com/${owner}/${repo}`,
      status: "queued",
      report_json: null,
      error_message: null,
      last_requested_at: "2026-04-04T00:00:00Z",
      queued_at: "2026-04-04T00:00:00Z",
      processing_started_at: null,
      cached_at: null,
      created_at: "2026-04-04T00:00:00Z",
      updated_at: "2026-04-04T00:00:00Z",
    }
    statusSnapshot = {
      status: "queued",
      queuePosition: 1,
      progress: null,
      errorMessage: null,
      queuedAt: "2026-04-04T00:00:00Z",
      processingStartedAt: null,
      cachedAt: null,
    }
  },
}))

const { RepositoryNotFoundError, getRepositoryPageView, readRepositoryView } = await import(repositoryServiceModulePath)
const originalFetch = globalThis.fetch

beforeEach(() => {
  databaseEnabled = true
  queueEnabled = true
  repoRecord = null
  statusSnapshot = null
  fetchStatus = 200
  enqueueCalls.length = 0
  touchCalls.length = 0
  fetchCalls.length = 0
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  process.env.REDIS_URL = "redis://example.test:6379"

  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    fetchCalls.push(url)
    return new Response(null, { status: fetchStatus })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.REDIS_URL
})

describe("repository page view loading", () => {
  test("queues a missing repo once and reuses stored queued state on later reads", async () => {
    const firstView = await getRepositoryPageView("schema-labs-ltd", "discofork")
    const secondView = await getRepositoryPageView("schema-labs-ltd", "discofork")

    expect(firstView.kind).toBe("queued")
    expect(secondView.kind).toBe("queued")
    expect(enqueueCalls).toEqual(["schema-labs-ltd/discofork"])
    expect(touchCalls).toEqual([{ owner: "schema-labs-ltd", repo: "discofork", queuedNow: true }])
  })

  test("readRepositoryView stays side-effect free for uncached repos", async () => {
    const view = await readRepositoryView("schema-labs-ltd", "readonly-check")

    expect(view.kind).toBe("queued")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })
})
