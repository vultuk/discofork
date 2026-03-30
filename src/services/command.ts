import { AppError } from "../core/errors.ts"
import type { CommandResult, CommandSpec } from "../core/types.ts"
import type { Logger } from "../core/logger.ts"

export function parseTimeoutSetting(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return parsed > 0 ? Math.floor(parsed) : 0
}

const DEFAULT_COMMAND_TIMEOUT_MS = parseTimeoutSetting(process.env.DISCOFORK_COMMAND_TIMEOUT_MS, 900000)

type RunOptions = {
  logger?: Logger
  allowFailure?: boolean
  timeoutMs?: number
}

function normalizeTimeoutMs(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export async function runCommand(
  spec: CommandSpec,
  options: RunOptions = {},
): Promise<CommandResult> {
  const start = Date.now()
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS)
  await options.logger?.debug("run_command:start", {
    ...spec,
    timeoutMs: timeoutMs > 0 ? timeoutMs : null,
  })

  const proc = Bun.spawn({
    cmd: [spec.command, ...spec.args],
    cwd: spec.cwd,
    env: {
      ...process.env,
      ...spec.env,
    },
    stdin: spec.input ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: timeoutMs > 0 ? timeoutMs : undefined,
  })

  if (spec.input) {
    proc.stdin?.write(spec.input)
    proc.stdin?.end()
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  const timedOut = timeoutMs > 0 && proc.killed && exitCode !== 0
  const timeoutSuffix = timedOut ? `\nCommand timed out after ${timeoutMs}ms.` : ""
  const result: CommandResult = {
    exitCode,
    stdout,
    stderr: `${stderr}${timeoutSuffix}`,
    durationMs: Date.now() - start,
  }

  await options.logger?.debug("run_command:finish", {
    command: spec.command,
    args: spec.args,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    timedOut,
  })

  if (result.exitCode !== 0 && !options.allowFailure) {
    const stderrTail = result.stderr.trim().split("\n").filter(Boolean).at(-1)
    await options.logger?.error("run_command:error", {
      command: spec.command,
      args: spec.args,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      timedOut,
    })
    throw new AppError(
      "COMMAND_FAILED",
      `${spec.command} ${spec.args.join(" ")} failed with exit code ${result.exitCode}${stderrTail ? `: ${stderrTail}` : ""}`,
      result,
    )
  }

  return result
}

export async function commandExists(command: string): Promise<boolean> {
  const result = await runCommand(
    {
      command: "sh",
      args: ["-lc", `command -v ${command}`],
    },
    { allowFailure: true },
  )

  return result.exitCode === 0
}
