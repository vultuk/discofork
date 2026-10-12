import { describe, expect, test } from "bun:test"

import { parseCliOptions, renderHelpText } from "../src/app/args.ts"

describe("args", () => {
  test("parses help flag", () => {
    const options = parseCliOptions(["--help"])
    expect(options.help).toBe(true)
  })

  test("parses doctor subcommand", () => {
    const options = parseCliOptions(["doctor"])
    expect(options.command).toBe("doctor")
  })

  for (const argv of [["--repo", "cli/go-gh"], ["-r", "cli/go-gh"], ["cli/go-gh"], ["https://github.com/cli/go-gh"]]) {
    test(`parses supported repository arguments: ${argv.join(" ")}`, () => {
      expect(parseCliOptions(argv)).toMatchObject({ command: "app", repoUrl: argv.at(-1), help: false })
    })
  }

  test("normal entry keeps its default analysis options", () => {
    expect(parseCliOptions([])).toEqual({
      command: "app",
      repoUrl: undefined,
      includeArchived: false,
      forkScanLimit: 25,
      recommendedForkLimit: 6,
      compareConcurrency: 3,
      help: false,
    })
  })

  test("renders help text with key options", () => {
    const helpText = renderHelpText()
    expect(helpText).toContain("doctor")
    expect(helpText).toContain("--fork-scan-limit")
    expect(helpText).toContain("--compare-concurrency")
    expect(helpText).toContain("--help")
  })
})
