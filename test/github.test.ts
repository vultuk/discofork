import { describe, expect, test } from "bun:test"

import { parseGitHubRepoInput } from "../src/services/github.ts"

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
