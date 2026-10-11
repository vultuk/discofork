import { afterEach, describe, expect, test } from "bun:test"

import { getConfig } from "../stats-refresh-function/config.ts"

const DEFAULT_STATS_REFRESH_URL = "https://discofork.ai/api/stats/refresh"

afterEach(() => {
  delete process.env.DISCOFORK_ADMIN_TOKEN
  delete process.env.STATS_REFRESH_ADMIN_TOKEN
  delete process.env.STATS_REFRESH_URL
})

describe("getConfig", () => {
  test("returns DISCOFORK_ADMIN_TOKEN when set", () => {
    process.env.DISCOFORK_ADMIN_TOKEN = "shared-secret"
    expect(getConfig()).toEqual({ url: DEFAULT_STATS_REFRESH_URL, token: "shared-secret" })
  })

  test("falls back to STATS_REFRESH_ADMIN_TOKEN", () => {
    process.env.STATS_REFRESH_ADMIN_TOKEN = "legacy-secret"
    expect(getConfig()).toEqual({ url: DEFAULT_STATS_REFRESH_URL, token: "legacy-secret" })
  })

  test("prefers DISCOFORK_ADMIN_TOKEN over legacy", () => {
    process.env.DISCOFORK_ADMIN_TOKEN = "shared"
    process.env.STATS_REFRESH_ADMIN_TOKEN = "legacy"
    expect(getConfig()).toEqual({ url: DEFAULT_STATS_REFRESH_URL, token: "shared" })
  })

  test("returns null token when neither is set", () => {
    expect(getConfig()).toEqual({ url: DEFAULT_STATS_REFRESH_URL, token: null })
  })

  test("uses STATS_REFRESH_URL override", () => {
    process.env.STATS_REFRESH_URL = "https://example.com/refresh"
    process.env.DISCOFORK_ADMIN_TOKEN = "secret"
    expect(getConfig()).toEqual({ url: "https://example.com/refresh", token: "secret" })
  })

  test("trims whitespace from env vars", () => {
    process.env.DISCOFORK_ADMIN_TOKEN = "  secret  "
    process.env.STATS_REFRESH_URL = "  https://example.com/refresh  "
    expect(getConfig()).toEqual({ url: "https://example.com/refresh", token: "secret" })
  })
})
