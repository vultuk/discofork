import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { assertWorkerRepoInputIsActionable, parseGitHubRepoInput, parseLsRemoteHeadSha } from "../src/services/github.ts"

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = originalFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("parseGitHubRepoInput", () => {
  test("parses full GitHub URLs", () => {
    expect(parseGitHubRepoInput("https://github.com/openai/codex").fullName).toBe("openai/codex")
    expect(parseGitHubRepoInput("https://github.com/openai/codex.git").cloneUrl).toBe(
      "https://github.com/openai/codex.git",
    )
  })

  test("parses owner/name shorthand", () => {
    expect(parseGitHubRepoInput("cli/cli")).toEqual({
      owner: "cli",
      name: "cli",
      fullName: "cli/cli",
      url: "https://github.com/cli/cli",
      cloneUrl: "https://github.com/cli/cli.git",
    })
  })
})

describe("assertWorkerRepoInputIsActionable", () => {
  test("rejects obvious path-probe inputs before any network fetch", async () => {
    const fetchCalls: string[] = []
    globalThis.fetch = (async (input: Request | string | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      fetchCalls.push(url)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    await expect(assertWorkerRepoInputIsActionable("admin/.env")).rejects.toThrow("Queued input does not look like a GitHub repository")
    await expect(assertWorkerRepoInputIsActionable(".well-known/nodeinfo")).rejects.toThrow("Queued input does not look like a GitHub repository")

    expect(fetchCalls).toEqual([])
  })

  test("rejects queued inputs that 404 on GitHub before discovery work starts", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch

    await expect(assertWorkerRepoInputIsActionable("api/settings")).rejects.toThrow(
      "Queued input does not resolve to a GitHub repository: api/settings.",
    )
  })

  test("allows valid repositories through when GitHub resolves them", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch

    await expect(assertWorkerRepoInputIsActionable("openai/codex")).resolves.toMatchObject({
      fullName: "openai/codex",
      cloneUrl: "https://github.com/openai/codex.git",
    })
  })
})

describe("parseLsRemoteHeadSha", () => {
  test("extracts the branch head sha from git ls-remote output", () => {
    expect(parseLsRemoteHeadSha("0123456789abcdef0123456789abcdef01234567\trefs/heads/main\n")).toBe(
      "0123456789abcdef0123456789abcdef01234567",
    )
  })

  test("returns null for empty or malformed output", () => {
    expect(parseLsRemoteHeadSha("")).toBeNull()
    expect(parseLsRemoteHeadSha("not-a-sha\trefs/heads/main\n")).toBeNull()
  })
})
