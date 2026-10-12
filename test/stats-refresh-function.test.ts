import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { refreshStats } from "../stats-refresh-function/refresh.ts"

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const sourceEntrypoint = join(repositoryRoot, "stats-refresh-function/index.ts")
const syntheticToken = "synthetic-refresh-token"
const syntheticPayload = "synthetic-private-response-body"
const defaultUrl = "https://discofork.ai/api/stats/refresh"

type Scenario = "primary" | "legacy" | "missing-token" | "invalid-url" | "http-failure" | "network-failure"

type ChildReport = {
  calls: Array<{ url: string; method: string; authorization: string | null }>
  errors: string[]
  importThrew: boolean
  exitCode: number
}

let bundleDirectory: string
let bundledEntrypoint: string

beforeAll(() => {
  bundleDirectory = mkdtempSync(join(tmpdir(), "discofork-stats-refresh-"))
  bundledEntrypoint = join(bundleDirectory, "update-cached-stats.mjs")
  const build = spawnSync(
    process.execPath,
    ["build", sourceEntrypoint, "--outfile", bundledEntrypoint, "--target", "bun"],
    { cwd: repositoryRoot, encoding: "utf8" },
  )

  if (build.error) throw build.error
  if (build.status !== 0) {
    throw new Error(`Local stats refresh bundle failed: ${build.stderr || build.stdout}`)
  }
})

afterAll(() => {
  if (bundleDirectory) rmSync(bundleDirectory, { recursive: true, force: true })
})

function runEntrypoint(entrypoint: string, scenario: Scenario): { status: number | null; report: ChildReport; stdout: string; stderr: string } {
  const harness = `
    const calls = []
    const errors = []
    let importThrew = false
    const scenario = process.env.TEST_SCENARIO
    const token = process.env.DISCOFORK_ADMIN_TOKEN || process.env.STATS_REFRESH_ADMIN_TOKEN || ""

    globalThis.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method || "GET",
        authorization: new Headers(init?.headers).get("authorization"),
      })
      if (scenario === "network-failure") {
        throw new Error("synthetic credential-bearing failure: " + token)
      }
      return new Response("synthetic-private-response-body", {
        status: scenario === "http-failure" ? 503 : 200,
      })
    }
    console.error = (...parts) => errors.push(parts.map(String).join(" "))

    try {
      await import(process.env.TEST_ENTRYPOINT)
    } catch {
      importThrew = true
      process.exitCode = 1
    }

    console.log(JSON.stringify({ calls, errors, importThrew, exitCode: process.exitCode ?? 0 }))
  `

  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    TEST_ENTRYPOINT: pathToFileURL(entrypoint).href,
    TEST_SCENARIO: scenario,
    PORT: "0",
  }
  if (scenario === "primary" || scenario === "http-failure" || scenario === "network-failure") {
    env.DISCOFORK_ADMIN_TOKEN = syntheticToken
    env.STATS_REFRESH_URL = "https://example.test/custom-refresh"
  } else if (scenario === "legacy") {
    env.STATS_REFRESH_ADMIN_TOKEN = syntheticToken
  } else if (scenario === "invalid-url") {
    env.DISCOFORK_ADMIN_TOKEN = syntheticToken
    env.STATS_REFRESH_URL = "http://example.test/insecure-refresh"
  }

  const result = spawnSync(process.execPath, ["-e", harness], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    timeout: 5000,
  })

  if (result.error) throw result.error
  const reportLine = result.stdout.trim().split("\n").at(-1)
  if (!reportLine) throw new Error(`Stats refresh entrypoint produced no report (status ${result.status}).`)

  return {
    status: result.status,
    report: JSON.parse(reportLine) as ChildReport,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function expectSafeReport(result: ReturnType<typeof runEntrypoint>) {
  expect(result.report.importThrew).toBe(false)
  expect(`${result.report.errors.join(" ")}\n${result.stderr}`).not.toContain(syntheticToken)
  expect(`${result.report.errors.join(" ")}\n${result.stderr}`).not.toContain(syntheticPayload)
  expect(result.report.errors.join(" ")).not.toContain("credential-bearing failure")
}

describe("stats refresh sender", () => {
  test("sends one configured GET with the bearer token", async () => {
    const requests: Array<{ url: string; authorization: string | null; method: string | undefined; redirect: string | undefined }> = []
    const result = await refreshStats(
      { url: "https://example.test/refresh", token: syntheticToken },
      async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization"),
          method: init?.method,
          redirect: init?.redirect,
        })
        return new Response(syntheticPayload, { status: 200 })
      },
    )

    expect(result).toEqual({ ok: true })
    expect(requests).toEqual([
      {
        url: "https://example.test/refresh",
        authorization: `Bearer ${syntheticToken}`,
        method: "GET",
        redirect: "error",
      },
    ])
  })

  test("makes no request for missing or invalid configuration", async () => {
    let calls = 0
    const fetchStub = async () => {
      calls += 1
      return new Response(null, { status: 200 })
    }

    const missingToken = await refreshStats({ url: "https://example.test/refresh", token: null }, fetchStub)
    const invalidUrl = await refreshStats({ url: "http://example.test/refresh", token: syntheticToken }, fetchStub)
    const invalidToken = await refreshStats({ url: "https://example.test/refresh", token: "invalid token" }, fetchStub)

    expect(missingToken).toEqual({ ok: false, error: "Stats refresh skipped: admin token is not configured." })
    expect(invalidUrl.ok).toBe(false)
    expect(invalidToken.ok).toBe(false)
    expect(calls).toBe(0)
  })

  test("returns safe failures without reading response bodies or logging thrown details", async () => {
    const failedResponse = await refreshStats(
      { url: "https://example.test/refresh", token: syntheticToken },
      async () => new Response(syntheticPayload, { status: 503 }),
    )
    const networkFailure = await refreshStats(
      { url: "https://example.test/refresh", token: syntheticToken },
      async () => {
        throw new Error(`synthetic credential-bearing failure: ${syntheticToken}`)
      },
    )

    expect(failedResponse).toEqual({ ok: false, error: "Stats refresh endpoint returned HTTP 503." })
    expect(networkFailure).toEqual({ ok: false, error: "Stats refresh request failed." })
    expect(JSON.stringify([failedResponse, networkFailure])).not.toContain(syntheticToken)
    expect(JSON.stringify([failedResponse, networkFailure])).not.toContain(syntheticPayload)
  })
})

for (const [label, getEntrypoint] of [
  ["TypeScript source", () => sourceEntrypoint],
  ["locally bundled deployment entrypoint", () => bundledEntrypoint],
] as const) {
  describe(label, () => {
    test("makes one configured request and completes with the primary token", () => {
      const result = runEntrypoint(getEntrypoint(), "primary")
      expect(result.status).toBe(0)
      expect(result.report.exitCode).toBe(0)
      expect(result.report.calls).toEqual([
        {
          url: "https://example.test/custom-refresh",
          method: "GET",
          authorization: `Bearer ${syntheticToken}`,
        },
      ])
      expect(result.report.errors).toEqual([])
      expectSafeReport(result)
    })

    test("preserves the legacy token fallback and default URL", () => {
      const result = runEntrypoint(getEntrypoint(), "legacy")
      expect(result.status).toBe(0)
      expect(result.report.exitCode).toBe(0)
      expect(result.report.calls).toEqual([
        { url: defaultUrl, method: "GET", authorization: `Bearer ${syntheticToken}` },
      ])
      expectSafeReport(result)
    })

    test("exits nonzero without a request when the token is missing", () => {
      const result = runEntrypoint(getEntrypoint(), "missing-token")
      expect(result.status).toBe(1)
      expect(result.report.exitCode).toBe(1)
      expect(result.report.calls).toEqual([])
      expect(result.report.errors).toEqual(["Stats refresh skipped: admin token is not configured."])
      expectSafeReport(result)
    })

    test("exits nonzero without a request when the URL is invalid", () => {
      const result = runEntrypoint(getEntrypoint(), "invalid-url")
      expect(result.status).toBe(1)
      expect(result.report.exitCode).toBe(1)
      expect(result.report.calls).toEqual([])
      expect(result.report.errors).toEqual(["Stats refresh skipped: target URL or admin token is invalid."])
      expectSafeReport(result)
    })

    test("exits nonzero on upstream and network failures without logging response or exception details", () => {
      const httpFailure = runEntrypoint(getEntrypoint(), "http-failure")
      const networkFailure = runEntrypoint(getEntrypoint(), "network-failure")

      expect(httpFailure.status).toBe(1)
      expect(httpFailure.report.exitCode).toBe(1)
      expect(httpFailure.report.calls).toHaveLength(1)
      expect(httpFailure.report.errors).toEqual(["Stats refresh endpoint returned HTTP 503."])
      expectSafeReport(httpFailure)

      expect(networkFailure.status).toBe(1)
      expect(networkFailure.report.exitCode).toBe(1)
      expect(networkFailure.report.calls).toHaveLength(1)
      expect(networkFailure.report.errors).toEqual(["Stats refresh request failed."])
      expectSafeReport(networkFailure)
    })
  })
}
