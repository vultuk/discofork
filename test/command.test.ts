import { describe, expect, test } from "bun:test"

import { runCommand } from "../src/services/command.ts"

describe("runCommand timeouts", () => {
  test("stops a long-running command when timeoutMs is set", async () => {
    const started = Date.now()

    const result = await runCommand(
      {
        command: "sh",
        args: ["-lc", "sleep 5"],
      },
      {
        allowFailure: true,
        timeoutMs: 50,
      },
    )

    expect(Date.now() - started).toBeLessThan(2000)
    expect(result.exitCode).not.toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain("timed out")
  })
})
