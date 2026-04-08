import { beforeEach, describe, expect, mock, test } from "bun:test"

const liveStatusModulePath = new URL("../web/src/lib/server/live-status.ts", import.meta.url).href
const statusRouteModulePath = new URL("../web/src/app/api/repo/[owner]/[repo]/status/route.ts", import.meta.url).href

type Snapshot = {
  status: "queued" | "processing" | "ready" | "failed"
  queuePosition: number | null
  progress: {
    phase: string | null
    detail: string | null
    current: number | null
    total: number | null
    updatedAt: string | null
  } | null
  errorMessage: string | null
  queuedAt: string | null
  processingStartedAt: string | null
  cachedAt: string | null
  retryCount: number
  retryState: "none" | "retrying" | "terminal"
  nextRetryAt: string | null
  lastFailedAt: string | null
}

type SnapshotResult = Snapshot | Promise<Snapshot | null> | null

type StreamRead =
  | { done: false; value: Uint8Array }
  | { done: true; value: undefined }

const snapshotSequence: SnapshotResult[] = []
let snapshotCallCount = 0

mock.module(liveStatusModulePath, () => ({
  getRepoStatusSnapshot: async () => {
    const index = Math.min(snapshotCallCount, Math.max(0, snapshotSequence.length - 1))
    snapshotCallCount += 1
    return await snapshotSequence[index]
  },
}))

const { GET } = await import(statusRouteModulePath)

function baseSnapshot(status: Snapshot["status"]): Snapshot {
  return {
    status,
    queuePosition: status === "queued" ? 2 : null,
    progress:
      status === "processing"
        ? {
            phase: "analysis",
            detail: "Processing repository",
            current: 1,
            total: 3,
            updatedAt: "2026-04-06T23:00:00Z",
          }
        : null,
    errorMessage: null,
    queuedAt: "2026-04-06T23:00:00Z",
    processingStartedAt: status === "processing" ? "2026-04-06T23:01:00Z" : null,
    cachedAt: status === "ready" ? "2026-04-06T23:02:00Z" : null,
    retryCount: 0,
    retryState: "none",
    nextRetryAt: null,
    lastFailedAt: null,
  }
}

async function readWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    Bun.sleep(timeoutMs).then(() => {
      throw new Error(`Timed out waiting for ${label}`)
    }),
  ])
}

beforeEach(() => {
  snapshotSequence.length = 0
  snapshotCallCount = 0
})

describe("repository status SSE route", () => {
  test("emits a first ready snapshot and closes cleanly", async () => {
    snapshotSequence.push(baseSnapshot("ready"))

    const response = await GET(new Request("http://localhost/api/repo/schema-labs-ltd/discofork/status"), {
      params: Promise.resolve({ owner: "schema-labs-ltd", repo: "discofork" }),
    })

    expect(response.headers.get("Content-Type")).toBe("text/event-stream")

    const body = await readWithTimeout(response.text(), 1000, "the ready SSE body")
    expect(body).toContain('"fullName":"schema-labs-ltd/discofork"')
    expect(body).toContain('"status":"ready"')
    expect(snapshotCallCount).toBe(1)
  })

  test("continues polling when the first snapshot is not ready", async () => {
    snapshotSequence.push(baseSnapshot("queued"), baseSnapshot("processing"))

    const abortController = new AbortController() as unknown as { signal: AbortSignal; abort: () => void }
    const response = await GET(
      new Request("http://localhost/api/repo/schema-labs-ltd/discofork/status", {
        signal: abortController.signal,
      }),
      {
        params: Promise.resolve({ owner: "schema-labs-ltd", repo: "discofork" }),
      },
    )

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    const decoder = new TextDecoder()
    const first = await readWithTimeout<StreamRead>(reader!.read(), 1000, "the initial queued snapshot")
    expect(first.done).toBeFalse()
    expect(decoder.decode(first.value)).toContain('"status":"queued"')

    const second = await readWithTimeout<StreamRead>(reader!.read(), 2500, "the polled processing snapshot")
    expect(second.done).toBeFalse()
    expect(decoder.decode(second.value)).toContain('"status":"processing"')
    expect(snapshotCallCount).toBeGreaterThanOrEqual(2)

    abortController.abort()

    const finalRead = await readWithTimeout<StreamRead>(reader!.read(), 1000, "stream shutdown after abort")
    expect(finalRead.done).toBeTrue()
  })

  test("closes without emitting when the client aborts during the initial snapshot", async () => {
    let resolveSnapshot: ((snapshot: Snapshot | null) => void) | null = null
    const delayedSnapshot = new Promise<Snapshot | null>((resolve) => {
      resolveSnapshot = resolve
    })
    snapshotSequence.push(delayedSnapshot)

    const abortController = new AbortController() as unknown as { signal: AbortSignal; abort: () => void }
    const response = await GET(
      new Request("http://localhost/api/repo/schema-labs-ltd/discofork/status", {
        signal: abortController.signal,
      }),
      {
        params: Promise.resolve({ owner: "schema-labs-ltd", repo: "discofork" }),
      },
    )

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    abortController.abort()
    if (!resolveSnapshot) {
      throw new Error("Expected the delayed snapshot resolver to be set")
    }
    const deliverSnapshot = resolveSnapshot as (snapshot: Snapshot | null) => void
    deliverSnapshot(baseSnapshot("queued"))

    const finalRead = await readWithTimeout<StreamRead>(reader!.read(), 1000, "stream shutdown during the initial snapshot")
    expect(finalRead.done).toBeTrue()
    expect(snapshotCallCount).toBe(1)
  })
})
