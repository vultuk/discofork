import { describe, expect, test } from "bun:test"

import { parseCliOptions } from "../src/app/args.ts"
import { buildRepoLaunchArtifacts } from "../web/src/lib/repo-launch-artifacts"

describe("repo launch artifacts", () => {
  test("builds web, GitHub, and CLI targets from pasted repository input", () => {
    expect(buildRepoLaunchArtifacts("https://github.com/openai/codex")).toEqual({
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      canonicalPath: "/openai/codex",
      discoforkUrl: "https://discofork.ai/openai/codex",
      githubUrl: "https://github.com/openai/codex",
      analysisCommand: "discofork --repo openai/codex",
    })
  })

  for (const input of ["openai/codex", "https://github.com/CLI/go-gh", "https://discofork.ai/org/repo.name"]) {
    test(`generated command selects the intended repository through the real parser: ${input}`, () => {
      const artifacts = buildRepoLaunchArtifacts(input)!
      const [executable, ...argv] = artifacts.analysisCommand.split(" ")

      expect(executable).toBe("discofork")
      expect(parseCliOptions(argv)).toMatchObject({ command: "app", repoUrl: artifacts.fullName, help: false })
    })
  }

  test("the former unsupported command does not select its intended repository", () => {
    expect(parseCliOptions(["analyze", "openai/codex"]).repoUrl).not.toBe("openai/codex")
  })

  test("allows previewing against another deployment origin", () => {
    expect(buildRepoLaunchArtifacts("openai/codex", "https://preview.discofork.ai/")?.discoforkUrl).toBe(
      "https://preview.discofork.ai/openai/codex",
    )
  })

  test("rejects inputs that the shared repo launcher rejects", () => {
    expect(buildRepoLaunchArtifacts("https://example.com/openai/codex")).toBeNull()
    expect(buildRepoLaunchArtifacts("admin/.env")).toBeNull()
  })
})
