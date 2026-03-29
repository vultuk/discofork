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

  test("renders help text with key options", () => {
    const helpText = renderHelpText()
    expect(helpText).toContain("doctor")
    expect(helpText).toContain("--fork-scan-limit")
    expect(helpText).toContain("--compare-concurrency")
    expect(helpText).toContain("--help")
  })
})
