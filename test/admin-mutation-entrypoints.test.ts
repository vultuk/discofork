import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"

type Result = {
  status: number | null
  body: Record<string, unknown>
  calls: string[]
  logs: unknown[]
}

// Each invocation has its own module registry: auth and effects cannot leak between routes or tests.
function invoke(entry: string, auth: string | null, configured = true, failRequeue = false, explicitHeader = false, actionToken?: unknown): Result {
  const script = `
    import { mock } from "bun:test"
    const calls = []
    const logs = []
    console.error = (...args) => logs.push(args)
    ${configured ? 'process.env.DISCOFORK_ADMIN_TOKEN = "test-operator-token"' : 'delete process.env.DISCOFORK_ADMIN_TOKEN'}
    const requestHeaders = new Headers(${JSON.stringify(explicitHeader ? { "x-discofork-admin-token": "test-operator-token" } : auth ? { authorization: auth } : {})})
    mock.module("next/headers", () => ({ headers: async () => requestHeaders }))
    mock.module("next/cache", () => ({ revalidatePath: (path) => calls.push("revalidate:" + path) }))
    mock.module("@/lib/server/admin-operations", () => ({
      getFailedRepoRequeueAvailabilityError: () => { calls.push("availability"); return null },
      requeueFailedRepos: async () => {
        calls.push("requeue")
        if (${failRequeue}) throw new Error("private test-operator-token connection details")
        return { failedCount: 2, requeuedCount: 1 }
      },
    }))
    mock.module("@/lib/server/queue", () => ({
      queueConfigured: () => { calls.push("queue-config"); return true },
    }))
    mock.module("@/lib/server/stats", () => ({
      refreshStatsSnapshot: async () => {
        calls.push("refresh")
        return { generatedAt: "2026-10-11T00:00:00Z", openAIStats: { available: false, reason: "not configured" } }
      },
    }))
    let status = null
    let body
    if (${JSON.stringify(entry)} === "action") {
      const { requeueFailedReposAction } = await import("./src/lib/server/admin-actions.ts")
      body = await requeueFailedReposAction(${JSON.stringify(actionToken) ?? "undefined"})
    } else {
      const route = ${JSON.stringify(entry)} === "requeue"
        ? await import("./src/app/api/repos/requeue-failed/route.ts")
        : await import("./src/app/api/stats/refresh/route.ts")
      const method = ${JSON.stringify(entry)} === "refresh-get" ? "GET" : "POST"
      const response = await route[method](new Request("https://discofork.test/api/admin", { method, headers: requestHeaders }))
      status = response.status
      body = await response.json()
    }
    console.log(JSON.stringify({ status, body, calls, logs }))
  `
  const result = spawnSync(process.execPath, ["-e", script], { cwd: join(process.cwd(), "web"), encoding: "utf8" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  expect(result.stdout).not.toContain("test-operator-token")
  return JSON.parse(result.stdout) as Result
}

describe("operational mutation entry points", () => {
  for (const entry of ["action", "requeue", "refresh-get", "refresh-post"]) {
    for (const [label, auth, configured, status, error] of [
      ["unauthenticated", null, true, 401, "Missing admin credentials."],
      ["invalid credentials", "Bearer wrong-token", true, 403, "Invalid admin credentials."],
      ["unconfigured authorisation", "Bearer test-operator-token", false, 503, "DISCOFORK_ADMIN_TOKEN is not configured."],
    ] as const) {
      test(`${entry} rejects ${label} before any operational work`, () => {
        const result = invoke(entry, auth, configured)
        expect(result.status).toBe(entry === "action" ? null : status)
        expect(result.body).toEqual(entry === "action" ? { ok: false, error } : { error })
        expect(result.calls).toEqual([])
        expect(result.logs).toEqual([])
      })
    }

    test(`${entry} preserves authorised operator/scheduler behaviour`, () => {
      const result = invoke(entry, "Bearer test-operator-token")
      expect(result.status).toBe(entry === "action" ? null : 200)
      if (entry === "action") {
        expect(result.body).toEqual({ ok: true })
        expect(result.calls).toEqual(["availability", "requeue", "revalidate:/stats"])
      } else if (entry === "requeue") {
        expect(result.body).toEqual({ failedCount: 2, requeuedCount: 1 })
        expect(result.calls).toEqual(["availability", "requeue"])
      } else {
        expect(result.body).toEqual({ ok: true, generatedAt: "2026-10-11T00:00:00Z", openAIStats: { available: false, reason: "not configured" } })
        expect(result.calls).toEqual(["queue-config", "refresh"])
      }
      expect(result.logs).toEqual([])
    })

    test(`${entry} accepts the existing explicit admin-header contract`, () => {
      const result = invoke(entry, null, true, false, true)
      expect(result.status).toBe(entry === "action" ? null : 200)
      expect(result.calls).toContain(entry.startsWith("refresh") ? "refresh" : "requeue")
      expect(result.logs).toEqual([])
    })
  }

  test("the direct server action returns a safe error when operational work fails", () => {
    const result = invoke("action", "Bearer test-operator-token", true, true)
    expect(result.body).toEqual({ ok: false, error: "Could not requeue failed jobs." })
    expect(result.calls).toEqual(["availability", "requeue"])
    expect(result.logs).toEqual([])
  })

  test("the browser's one-invocation existing token authorises the action without request credentials", () => {
    const result = invoke("action", null, true, false, false, "test-operator-token")
    expect(result.body).toEqual({ ok: true })
    expect(result.calls).toEqual(["availability", "requeue", "revalidate:/stats"])
  })

  for (const token of ["", "wrong-token", "wrong\r\ntoken", { token: "test-operator-token" }]) {
    test(`invalid one-invocation token ${JSON.stringify(token)} rejects before effects`, () => {
      const result = invoke("action", "Bearer test-operator-token", true, false, false, token)
      expect(result.body.ok).toBe(false)
      expect(result.calls).toEqual([])
      expect(result.logs).toEqual([])
    })
  }
})
