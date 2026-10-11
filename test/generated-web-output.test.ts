import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const repoRoot = fileURLToPath(new URL("../", import.meta.url))

function git(args: string[], input?: string): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    input,
  })
}

describe("generated web output", () => {
  test("keeps Next.js build and cache artifacts out of the tracked tree", () => {
    // Inspect paths only; generated cache contents can contain sensitive values.
    const trackedPaths = git(["ls-files", "--cached", "-z", "--", "web/.next"])
      .split("\0")
      .filter(Boolean)

    expect(trackedPaths).toEqual([])
  })

  test("ignores regenerated artifacts throughout the Next.js output directory", () => {
    const generatedPaths = [
      "web/.next/BUILD_ID",
      "web/.next/cache/generated-state.json",
      "web/.next/server/app/page.js",
      "web/.next/static/chunks/app.js",
      "web/.next/types/app/page.ts",
      "web/.next/standalone/server.js",
    ]

    // --no-index also verifies the policy if someone force-adds an artifact.
    const ignoredPaths = git(
      ["check-ignore", "--no-index", "-z", "--stdin"],
      `${generatedPaths.join("\0")}\0`,
    )
      .split("\0")
      .filter(Boolean)

    expect(ignoredPaths).toEqual(generatedPaths)
  })
})
