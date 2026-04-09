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
let fetchStatus = 200
let repoRecords = new Map<string, any>()
let statusSnapshots = new Map<string, any>()

function canonicalize(owner: string, repo: string) {
  const normalizedOwner = owner.toLowerCase()
  const normalizedRepo = repo.toLowerCase()
  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
    fullName: `${normalizedOwner}/${normalizedRepo}`,
  }
}

mock.module(databaseModulePath, () => ({
  databaseConfigured: () => databaseEnabled,
}))

mock.module(liveStatusModulePath, () => ({
  getRepoStatusSnapshot: async (fullName: string) => statusSnapshots.get(fullName.toLowerCase()) ?? null,
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
  getRepoRecord: async (fullName: string) => repoRecords.get(fullName.toLowerCase()) ?? null,
  touchQueuedRepo: async (owner: string, repo: string, queuedNow: boolean) => {
    touchCalls.push({ owner, repo, queuedNow })
    const canonical = canonicalize(owner, repo)
    repoRecords.set(canonical.fullName, {
      full_name: canonical.fullName,
      owner: canonical.owner,
      repo: canonical.repo,
      github_url: `https://github.com/${canonical.fullName}`,
      status: "queued",
      report_json: null,
      error_message: null,
      last_requested_at: "2026-04-04T00:00:00Z",
      queued_at: "2026-04-04T00:00:00Z",
      processing_started_at: null,
      cached_at: null,
      retry_count: 0,
      retry_state: "none",
      next_retry_at: null,
      last_failed_at: null,
      last_error_message: null,
      failure_history: [],
      created_at: "2026-04-04T00:00:00Z",
      updated_at: "2026-04-04T00:00:00Z",
    })
    statusSnapshots.set(canonical.fullName, {
      status: "queued",
      queuePosition: 1,
      progress: null,
      errorMessage: null,
      queuedAt: "2026-04-04T00:00:00Z",
      processingStartedAt: null,
      cachedAt: null,
      retryCount: 0,
      retryState: "none",
      nextRetryAt: null,
      lastFailedAt: null,
    })
  },
}))

const { RepositoryNotFoundError, getRepositoryPageView, readRepositoryView } = await import(repositoryServiceModulePath)
const originalFetch = globalThis.fetch

beforeEach(() => {
  databaseEnabled = true
  queueEnabled = true
  fetchStatus = 200
  repoRecords = new Map()
  statusSnapshots = new Map()
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
    const firstView = await getRepositoryPageView("schema-labs-ltd", "queued-once")
    const secondView = await getRepositoryPageView("schema-labs-ltd", "queued-once")

    expect(firstView.kind).toBe("queued")
    expect(secondView.kind).toBe("queued")
    expect(enqueueCalls).toEqual(["schema-labs-ltd/queued-once"])
    expect(touchCalls).toEqual([{ owner: "schema-labs-ltd", repo: "queued-once", queuedNow: true }])
  })

  test("mixed-case and lowercase requests reuse one canonical queued record", async () => {
    const firstView = await getRepositoryPageView("Schema-Labs-Ltd", "DiscoFork-Case")
    const secondView = await getRepositoryPageView("schema-labs-ltd", "discofork-case")

    expect(firstView).toMatchObject({
      kind: "queued",
      fullName: "schema-labs-ltd/discofork-case",
      owner: "schema-labs-ltd",
      repo: "discofork-case",
    })
    expect(secondView).toMatchObject({
      kind: "queued",
      fullName: "schema-labs-ltd/discofork-case",
      owner: "schema-labs-ltd",
      repo: "discofork-case",
    })
    expect(enqueueCalls).toEqual(["schema-labs-ltd/discofork-case"])
    expect(touchCalls).toEqual([{ owner: "schema-labs-ltd", repo: "discofork-case", queuedNow: true }])
  })

  test("readRepositoryView stays side-effect free for uncached repos", async () => {
    const view = await readRepositoryView("Schema-Labs-Ltd", "Readonly-Check")

    expect(view).toMatchObject({
      kind: "queued",
      fullName: "schema-labs-ltd/readonly-check",
      owner: "schema-labs-ltd",
      repo: "readonly-check",
    })
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })

  test("still raises RepositoryNotFoundError when GitHub returns 404", async () => {
    process.env.GH_TOKEN = "token"
    fetchStatus = 404

    await expect(getRepositoryPageView("Schema-Labs-Ltd", "Missing-Repo")).rejects.toBeInstanceOf(RepositoryNotFoundError)
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual(["https://api.github.com/repos/schema-labs-ltd/missing-repo"])
  })
})
