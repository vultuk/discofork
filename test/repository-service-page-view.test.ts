import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

const databaseModulePath = new URL("../web/src/lib/server/database.ts", import.meta.url).href
const liveStatusModulePath = new URL("../web/src/lib/server/live-status.ts", import.meta.url).href
const queueModulePath = new URL("../web/src/lib/server/queue.ts", import.meta.url).href
const reportsModulePath = new URL("../web/src/lib/server/reports.ts", import.meta.url).href
const repositoryServiceModulePath = new URL("../web/src/lib/repository-service.ts", import.meta.url).href

const originalDatabaseModule = await import(new URL("../web/src/lib/server/database.ts?repository-service-original", import.meta.url).href)
const originalLiveStatusModule = await import(new URL("../web/src/lib/server/live-status.ts?repository-service-original", import.meta.url).href)
const originalQueueModule = await import(new URL("../web/src/lib/server/queue.ts?repository-service-original", import.meta.url).href)
const originalReportsModule = await import(new URL("../web/src/lib/server/reports.ts?repository-service-original", import.meta.url).href)

const enqueueCalls: string[] = []
const touchCalls: Array<{ owner: string; repo: string; queuedNow: boolean }> = []
const fetchCalls: string[] = []
const repoRecordLookups: string[] = []

let databaseEnabled = true
let queueEnabled = true
let repoRecord: any = null
let statusSnapshot: any = null
let fetchStatus = 200
let repositoryServiceImportVersion = 0

let RepositoryNotFoundError: typeof Error
let getRepositoryPageView: (owner: string, repo: string) => Promise<any>
let readRepositoryView: (owner: string, repo: string) => Promise<any>

function createRepoRecord(overrides: Record<string, unknown> = {}): any {
  const owner = (overrides.owner as string | undefined) ?? "schema-labs-ltd"
  const repo = (overrides.repo as string | undefined) ?? "discofork"
  const fullName = (overrides.full_name as string | undefined) ?? `${owner}/${repo}`

  return {
    full_name: fullName,
    owner,
    repo,
    github_url: (overrides.github_url as string | undefined) ?? `https://github.com/${fullName}`,
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
    ...overrides,
  }
}

function applyRepositoryServiceMocks() {
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
    getRepoRecord: async (fullName: string) => {
      repoRecordLookups.push(fullName)
      return repoRecord
    },
    touchQueuedRepo: async (owner: string, repo: string, queuedNow: boolean) => {
      touchCalls.push({ owner, repo, queuedNow })
      repoRecord = createRepoRecord({
        owner,
        repo,
        status: "queued",
      })
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
}

async function loadRepositoryServiceModule() {
  repositoryServiceImportVersion += 1
  return import(`${repositoryServiceModulePath}?repository-service-test=${repositoryServiceImportVersion}`)
}

const originalFetch = globalThis.fetch

beforeEach(async () => {
  databaseEnabled = true
  queueEnabled = true
  repoRecord = null
  statusSnapshot = null
  fetchStatus = 200
  enqueueCalls.length = 0
  touchCalls.length = 0
  fetchCalls.length = 0
  repoRecordLookups.length = 0
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  process.env.REDIS_URL = "redis://example.test:6379"

  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    fetchCalls.push(url)
    return new Response(null, { status: fetchStatus })
  }) as typeof fetch

  applyRepositoryServiceMocks()
  const repositoryServiceModule = await loadRepositoryServiceModule()
  RepositoryNotFoundError = repositoryServiceModule.RepositoryNotFoundError
  getRepositoryPageView = repositoryServiceModule.getRepositoryPageView
  readRepositoryView = repositoryServiceModule.readRepositoryView
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.REDIS_URL
  mock.module(databaseModulePath, () => originalDatabaseModule)
  mock.module(liveStatusModulePath, () => originalLiveStatusModule)
  mock.module(queueModulePath, () => originalQueueModule)
  mock.module(reportsModulePath, () => originalReportsModule)
})

describe("repository page view loading", () => {
  test("queues a missing repo once and reuses stored queued state on later reads", async () => {
    const firstView = await getRepositoryPageView("schema-labs-ltd", "discofork")
    const secondView = await getRepositoryPageView("schema-labs-ltd", "discofork")

    expect(firstView.kind).toBe("queued")
    expect(secondView.kind).toBe("queued")
    expect(firstView.liveStatusEnabled).toBeTrue()
    expect(secondView.liveStatusEnabled).toBeTrue()
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

  test("readRepositoryView returns a stored ready report when Redis is unavailable", async () => {
    queueEnabled = false
    repoRecord = createRepoRecord({
      status: "ready",
      report_json: {
        generatedAt: "2026-04-05T00:00:00Z",
        upstream: {
          metadata: {
            stargazerCount: 7,
            forkCount: 3,
            defaultBranch: "main",
            pushedAt: "2026-04-03T00:00:00Z",
          },
          analysis: {
            summary: "Cached summary from Postgres",
          },
        },
        recommendations: {
          bestMaintained: "schema-labs-ltd/discofork",
        },
      },
      cached_at: "2026-04-05T00:00:00Z",
    })

    const view = await readRepositoryView("schema-labs-ltd", "discofork")

    expect(view.kind).toBe("cached")
    expect(view.upstreamSummary).toBe("Cached summary from Postgres")
    expect(view.recommendations.bestMaintained).toBe("schema-labs-ltd/discofork")
    expect(repoRecordLookups).toEqual(["schema-labs-ltd/discofork"])
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })

  for (const status of ["queued", "failed"] as const) {
    test(`getRepositoryPageView returns a stored ${status} row without enqueueing when Redis is unavailable`, async () => {
      queueEnabled = false
      repoRecord = createRepoRecord({
        status,
        error_message: status === "failed" ? "Worker crashed" : null,
        retry_count: status === "failed" ? 3 : 0,
        retry_state: status === "failed" ? "terminal" : "none",
        last_failed_at: status === "failed" ? "2026-04-04T01:00:00Z" : null,
      })

      const view = await getRepositoryPageView("schema-labs-ltd", "discofork")

      expect(view.kind).toBe("queued")
      expect(view.status).toBe(status)
      expect(view.liveStatusEnabled).toBeFalse()
      expect(view.errorMessage).toBe(status === "failed" ? "Worker crashed" : null)
      expect(repoRecordLookups).toEqual(["schema-labs-ltd/discofork"])
      expect(enqueueCalls).toEqual([])
      expect(touchCalls).toEqual([])
      expect(fetchCalls).toEqual([])
    })
  }

  test("getRepositoryPageView keeps live status polling enabled for stored processing rows without Redis", async () => {
    queueEnabled = false
    repoRecord = createRepoRecord({
      status: "processing",
      processing_started_at: "2026-04-04T00:05:00Z",
    })

    const view = await getRepositoryPageView("schema-labs-ltd", "discofork")

    expect(view.kind).toBe("queued")
    expect(view.status).toBe("processing")
    expect(view.liveStatusEnabled).toBeTrue()
    expect(view.queueHint).toContain("currently being analyzed")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("getRepositoryPageView stays non-mutating for uncached repos when Redis is unavailable", async () => {
    queueEnabled = false

    const view = await getRepositoryPageView("schema-labs-ltd", "uncached-without-redis")

    expect(view.kind).toBe("queued")
    expect(view.liveStatusEnabled).toBeFalse()
    expect(view.queueHint).toContain("queueing is unavailable")
    expect(repoRecordLookups).toEqual(["schema-labs-ltd/uncached-without-redis"])
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })

  test("getRepositoryPageView still rejects missing repos without Redis when GitHub says they do not exist", async () => {
    queueEnabled = false
    process.env.GH_TOKEN = "***"
    fetchStatus = 404

    await expect(getRepositoryPageView("schema-labs-ltd", "missing-without-redis")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    expect(repoRecordLookups).toEqual(["schema-labs-ltd/missing-without-redis"])
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual(["https://api.github.com/repos/schema-labs-ltd/missing-without-redis"])
  })

  test("rejects suspicious page routes before stored lookups, fetches, or queue mutations", async () => {
    process.env.GH_TOKEN = "***"

    await expect(getRepositoryPageView("admin", ".env")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    expect(repoRecordLookups).toEqual([])
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })

  test("rejects suspicious read-only routes before stored lookup side effects", async () => {
    process.env.GH_TOKEN = "***"
    repoRecord = createRepoRecord({
      owner: ".well-known",
      repo: "nodeinfo",
      status: "queued",
    })

    await expect(readRepositoryView(".well-known", "nodeinfo")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    expect(repoRecordLookups).toEqual([])
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toEqual([])
  })
})

afterAll(() => {
  mock.restore()
})
