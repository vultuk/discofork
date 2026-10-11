import { describe, expect, test } from "bun:test"

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
      analysisCommand: "discofork analyze openai/codex",
    })
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
