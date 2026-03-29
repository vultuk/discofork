import { AppError } from "../core/errors.ts"
import type { CommandResult, CommandSpec } from "../core/types.ts"
import type { Logger } from "../core/logger.ts"

type RunOptions = {
  logger?: Logger
  allowFailure?: boolean
}

export async function runCommand(
  spec: CommandSpec,
  options: RunOptions = {},
): Promise<CommandResult> {
  const start = Date.now()
  await options.logger?.debug("run_command:start", spec)

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

  const result: CommandResult = {
    exitCode,
    stdout,
    stderr,
    durationMs: Date.now() - start,
  }

  await options.logger?.debug("run_command:finish", {
    command: spec.command,
    args: spec.args,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  })

  if (result.exitCode !== 0 && !options.allowFailure) {
    const stderrTail = result.stderr.trim().split("\n").filter(Boolean).at(-1)
    await options.logger?.error("run_command:error", {
      command: spec.command,
      args: spec.args,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
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
