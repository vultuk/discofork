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

describe("repo API route", () => {
  test("returns a 404 payload when repository lookup rejects the route", () => {
    const result = runBunScript<{ status: number; body: unknown }>(`
      import { mock } from "bun:test"
      const repositoryServiceModulePath = new URL("./web/src/lib/repository-service.ts", import.meta.url).href
      const routeModulePath = new URL("./web/src/app/api/repo/[owner]/[repo]/route.ts", import.meta.url).href
      class MockRepositoryNotFoundError extends Error {
        constructor(fullName) {
          super(\`Repository not found on GitHub: \${fullName}\`)
          this.name = "RepositoryNotFoundError"
        }
      }
      mock.module(repositoryServiceModulePath, () => ({
        RepositoryNotFoundError: MockRepositoryNotFoundError,
        getRepositoryPageView: async (owner, repo) => {
          throw new MockRepositoryNotFoundError(\`\${owner}/\${repo}\`)
        },
      }))
      const { GET } = await import(routeModulePath)
      const response = await GET(new Request("https://discofork.ai/api/repo/admin/.env"), {
        params: Promise.resolve({ owner: "admin", repo: ".env" }),
      })
      console.log(JSON.stringify({ status: response.status, body: await response.json() }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toEqual({
      status: 404,
      body: { error: "Repository not found." },
    })
  })

  test("returns the repository payload for valid routes", () => {
    const result = runBunScript<{ status: number; body: unknown }>(`
      import { mock } from "bun:test"
      const repositoryServiceModulePath = new URL("./web/src/lib/repository-service.ts", import.meta.url).href
      const routeModulePath = new URL("./web/src/app/api/repo/[owner]/[repo]/route.ts", import.meta.url).href
      const nextResult = {
        kind: "queued",
        fullName: "openai/codex",
      }
      class MockRepositoryNotFoundError extends Error {}
      mock.module(repositoryServiceModulePath, () => ({
        RepositoryNotFoundError: MockRepositoryNotFoundError,
        getRepositoryPageView: async () => nextResult,
      }))
      const { GET } = await import(routeModulePath)
      const response = await GET(new Request("https://discofork.ai/api/repo/openai/codex"), {
        params: Promise.resolve({ owner: "openai", repo: "codex" }),
      })
      console.log(JSON.stringify({ status: response.status, body: await response.json() }))
    `)

    expect(result.code).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toEqual({
      status: 200,
      body: {
        kind: "queued",
        fullName: "openai/codex",
      },
    })
  })
})
