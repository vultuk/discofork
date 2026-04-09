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

const repoExistenceCache = new Map<string, string>()
const enqueueCalls: string[] = []
const touchCalls: Array<{ owner: string; repo: string; queuedNow: boolean }> = []
const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
const repoRecordLookups: string[] = []

let databaseEnabled = true
let queueEnabled = true
let repoRecord: any = null
let statusSnapshot: any = null
let fetchStatus = 200
let fetchHeaders: Record<string, string> | undefined

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
  getRedisClient: async () =>
    ({
      get: async (key: string) => repoExistenceCache.get(key) ?? null,
      set: async (key: string, value: string) => {
        repoExistenceCache.set(key, value)
        return "OK"
      },
    }) as unknown,
  queueConfigured: () => queueEnabled,
}))

mock.module(reportsModulePath, () => ({
  getRepoRecord: async (fullName: string) => {
    repoRecordLookups.push(fullName)
    return repoRecord
  },
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
  fetchHeaders = undefined
  repoExistenceCache.clear()
  enqueueCalls.length = 0
  touchCalls.length = 0
  fetchCalls.length = 0
  repoRecordLookups.length = 0
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  process.env.REDIS_URL = "redis://example.test:6379"

  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    fetchCalls.push({ url, init })
    return new Response(null, { status: fetchStatus, headers: fetchHeaders })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.GH_TOKEN
  delete process.env.GITHUB_TOKEN
  delete process.env.REDIS_URL
  mock.module(databaseModulePath, () => originalDatabaseModule)
  mock.module(liveStatusModulePath, () => originalLiveStatusModule)
  mock.module(queueModulePath, () => originalQueueModule)
  mock.module(reportsModulePath, () => originalReportsModule)
})

describe("repository page view loading", () => {
  test("uses the tokenless HEAD probe, caches positive hits, and keeps read-only reuse side-effect free", async () => {
    const firstView = await getRepositoryPageView("schema-labs-ltd", "discofork")

    repoRecord = null
    statusSnapshot = null

    const secondView = await readRepositoryView("schema-labs-ltd", "discofork")

    expect(firstView.kind).toBe("queued")
    expect(secondView.kind).toBe("queued")
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]).toMatchObject({
      url: "https://github.com/schema-labs-ltd/discofork",
      init: expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    })
    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/discofork")).toBe("1")
    expect(enqueueCalls).toEqual(["schema-labs-ltd/discofork"])
    expect(touchCalls).toEqual([{ owner: "schema-labs-ltd", repo: "discofork", queuedNow: true }])
  })

  test("accepts case-only redirects from the public GitHub probe", async () => {
    fetchStatus = 301
    fetchHeaders = { location: "https://github.com/Schema-Labs-Ltd/DiscoFork" }

    const view = await readRepositoryView("schema-labs-ltd", "discofork")

    expect(view.kind).toBe("queued")
    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/discofork")).toBe("1")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("rejects redirects that land on a different repository", async () => {
    fetchStatus = 301
    fetchHeaders = { location: "https://github.com/schema-labs-ltd/discofork-renamed" }

    await expect(readRepositoryView("schema-labs-ltd", "discofork")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/discofork")).toBe("0")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("keeps tokenless reads available when the anonymous probe gets a transient failure", async () => {
    fetchStatus = 429

    const view = await readRepositoryView("schema-labs-ltd", "rate-limited")

    expect(view.kind).toBe("queued")
    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/rate-limited")).toBeUndefined()
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("readRepositoryView stays side-effect free for uncached repos", async () => {
    const view = await readRepositoryView("schema-labs-ltd", "readonly-check")

    expect(view.kind).toBe("queued")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]).toMatchObject({
      url: "https://github.com/schema-labs-ltd/readonly-check",
      init: expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    })
  })

  test("fails closed for missing repos without a token, caches the negative result, and skips queue writes", async () => {
    fetchStatus = 404

    await expect(getRepositoryPageView("schema-labs-ltd", "missing-repo")).rejects.toBeInstanceOf(RepositoryNotFoundError)
    await expect(readRepositoryView("schema-labs-ltd", "missing-repo")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]).toMatchObject({
      url: "https://github.com/schema-labs-ltd/missing-repo",
      init: expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    })
    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/missing-repo")).toBe("0")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("does not let a tokenless negative cache block a later authenticated lookup", async () => {
    fetchStatus = 404

    await expect(getRepositoryPageView("schema-labs-ltd", "needs-auth")).rejects.toBeInstanceOf(RepositoryNotFoundError)

    process.env.GH_TOKEN = "***"
    fetchStatus = 200

    const view = await readRepositoryView("schema-labs-ltd", "needs-auth")

    expect(view.kind).toBe("queued")
    expect(fetchCalls).toHaveLength(2)
    expect(fetchCalls[0]).toMatchObject({
      url: "https://github.com/schema-labs-ltd/needs-auth",
      init: expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    })
    expect(fetchCalls[1]).toMatchObject({
      url: "https://api.github.com/repos/schema-labs-ltd/needs-auth",
      init: expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer ***" }),
      }),
    })
    expect(repoExistenceCache.get("discofork:github-repo-exists:schema-labs-ltd/needs-auth")).toBe("1")
    expect(enqueueCalls).toEqual([])
    expect(touchCalls).toEqual([])
  })

  test("keeps the authenticated GitHub API validation path when a token is configured", async () => {
    process.env.GH_TOKEN = "***"

    const view = await getRepositoryPageView("schema-labs-ltd", "token-check")

    expect(view.kind).toBe("queued")
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]).toMatchObject({
      url: "https://api.github.com/repos/schema-labs-ltd/token-check",
      init: expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
          Authorization: "Bearer ***",
          "X-GitHub-Api-Version": "2026-03-10",
        }),
      }),
    })
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
    repoRecord = {
      full_name: ".well-known/nodeinfo",
      owner: ".well-known",
      repo: "nodeinfo",
      github_url: "https://github.com/.well-known/nodeinfo",
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
