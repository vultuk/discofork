import { afterEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { RepoMetadata } from "../src/core/types.ts"
import { collectRepoFacts } from "../src/services/git.ts"

const metadata: RepoMetadata = {
  fullName: "example/monorepo",
  description: "Example monorepo",
  homepageUrl: null,
  defaultBranch: "main",
  isArchived: false,
  forkCount: 0,
  stargazerCount: 0,
  pushedAt: "2026-03-29T10:00:00Z",
  updatedAt: "2026-03-29T10:00:00Z",
}

let tempDir: string | null = null

function runGit(repoDir: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: repoDir, stdio: "ignore" })
}

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

describe("collectRepoFacts", () => {
  test("captures bounded monorepo workspace structure and nested manifests", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "discofork-git-facts-"))

    await Bun.write(path.join(tempDir, "README.md"), "# Monorepo\n")
    await Bun.write(
      path.join(tempDir, "package.json"),
      JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }, null, 2),
    )
    await Bun.write(path.join(tempDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n  - packages/*\n")
    await Bun.write(path.join(tempDir, "turbo.json"), JSON.stringify({ pipeline: {} }, null, 2))
    await Bun.write(path.join(tempDir, "apps/web/package.json"), JSON.stringify({ name: "web" }, null, 2))
    await Bun.write(path.join(tempDir, "packages/sdk/package.json"), JSON.stringify({ name: "sdk" }, null, 2))
    await Bun.write(path.join(tempDir, "services/api/pyproject.toml"), '[project]\nname = "api"\n')

    runGit(tempDir, "init", "-b", "main")
    runGit(tempDir, "config", "user.email", "test@example.com")
    runGit(tempDir, "config", "user.name", "Discofork Test")
    runGit(tempDir, "add", ".")
    runGit(tempDir, "commit", "-m", "initial")

    const repoFacts = await collectRepoFacts(tempDir, metadata)

    expect(repoFacts.workspaceSignals).toContain("package.json workspaces")
    expect(repoFacts.workspaceSignals).toContain("pnpm workspace")
    expect(repoFacts.workspaceSignals).toContain("Turborepo")
    expect(repoFacts.workspaceDirectories).toEqual(expect.arrayContaining(["apps/web", "packages/sdk", "services/api"]))
    expect(repoFacts.nestedManifestFiles.map((manifest) => manifest.path)).toEqual(
      expect.arrayContaining(["apps/web/package.json", "packages/sdk/package.json", "services/api/pyproject.toml"]),
    )
    expect(repoFacts.detectedTech).toContain("Monorepo / multi-package workspace")
  })
})
