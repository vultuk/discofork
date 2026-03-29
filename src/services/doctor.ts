import { commandExists, runCommand } from "./command.ts"

type CheckStatus = "ok" | "warn" | "fail"

type DoctorCheck = {
  label: string
  status: CheckStatus
  detail: string
  fix?: string
}

const STATUS_ICON: Record<CheckStatus, string> = {
  ok: "OK",
  warn: "WARN",
  fail: "FAIL",
}

function firstLine(text: string): string {
  return text.trim().split("\n").filter(Boolean)[0] ?? ""
}

function clean(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

async function checkBinary(label: string, command: string, versionCommand: string[]): Promise<DoctorCheck> {
  const exists = await commandExists(command)
  if (!exists) {
    return {
      label,
      status: "fail",
      detail: "Not found on PATH.",
      fix: `Install ${command} and rerun \`discofork doctor\`.`,
    }
  }

  const result = await runCommand(
    {
      command,
      args: versionCommand,
    },
    { allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return {
      label,
      status: "warn",
      detail: `Found on PATH, but version check failed with exit code ${result.exitCode}.`,
    }
  }

  return {
    label,
    status: "ok",
    detail: firstLine(result.stdout || result.stderr),
  }
}

async function checkGhAuth(): Promise<DoctorCheck> {
  const exists = await commandExists("gh")
  if (!exists) {
    return {
      label: "gh auth",
      status: "fail",
      detail: "GitHub CLI is not installed.",
      fix: "Install `gh`, then run `gh auth login`.",
    }
  }

  const result = await runCommand(
    {
      command: "gh",
      args: ["auth", "status"],
    },
    { allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return {
      label: "gh auth",
      status: "fail",
      detail: clean(result.stderr || result.stdout || "Not logged in."),
      fix: "Run `gh auth login`.",
    }
  }

  const accountLine =
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.includes("Logged in to github.com account")) ?? "Logged in."

  return {
    label: "gh auth",
    status: "ok",
    detail: accountLine.replace(/^✓\s*/, ""),
  }
}

async function checkGhRateLimit(): Promise<DoctorCheck> {
  const exists = await commandExists("gh")
  if (!exists) {
    return {
      label: "gh rate limit",
      status: "warn",
      detail: "Skipped because `gh` is missing.",
    }
  }

  const result = await runCommand(
    {
      command: "gh",
      args: [
        "api",
        "rate_limit",
        "--jq",
        "{remaining:.resources.core.remaining, limit:.resources.core.limit, reset:.resources.core.reset}",
      ],
    },
    { allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return {
      label: "gh rate limit",
      status: "warn",
      detail: "Could not read GitHub API rate limit.",
    }
  }

  try {
    const parsed = JSON.parse(result.stdout) as { remaining?: number; limit?: number; reset?: number }
    const remaining = parsed.remaining ?? 0
    const limit = parsed.limit ?? 0
    const resetIso = parsed.reset ? new Date(parsed.reset * 1000).toISOString() : "unknown"

    return {
      label: "gh rate limit",
      status: remaining > 0 ? "ok" : "warn",
      detail: `${remaining}/${limit} core requests remaining; resets at ${resetIso}.`,
    }
  } catch {
    return {
      label: "gh rate limit",
      status: "warn",
      detail: "Could not parse GitHub API rate limit output.",
    }
  }
}

async function checkCodexLogin(): Promise<DoctorCheck> {
  const exists = await commandExists("codex")
  if (!exists) {
    return {
      label: "codex login",
      status: "fail",
      detail: "Codex CLI is not installed.",
      fix: "Install `codex`, then run `codex login`.",
    }
  }

  const result = await runCommand(
    {
      command: "codex",
      args: ["login", "status"],
    },
    { allowFailure: true },
  )

  if (result.exitCode !== 0) {
    return {
      label: "codex login",
      status: "fail",
      detail: clean(result.stderr || result.stdout || "Not logged in."),
      fix: "Run `codex login`.",
    }
  }

  return {
    label: "codex login",
    status: "ok",
    detail: clean(result.stdout || "Logged in."),
  }
}

export async function runDoctor(): Promise<number> {
  const checks: DoctorCheck[] = []

  checks.push(await checkBinary("bun", "bun", ["--version"]))
  checks.push(await checkBinary("git", "git", ["--version"]))
  checks.push(await checkBinary("gh", "gh", ["--version"]))
  checks.push(await checkGhAuth())
  checks.push(await checkGhRateLimit())
  checks.push(await checkBinary("codex", "codex", ["--version"]))
  checks.push(await checkCodexLogin())

  console.log("Discofork doctor")
  console.log("")

  for (const check of checks) {
    console.log(`[${STATUS_ICON[check.status]}] ${check.label}: ${check.detail}`)
    if (check.fix) {
      console.log(`      ${check.fix}`)
    }
  }

  const failed = checks.some((check) => check.status === "fail")
  if (failed) {
    console.log("")
    console.log("Doctor found blocking issues.")
    return 1
  }

  const warned = checks.some((check) => check.status === "warn")
  if (warned) {
    console.log("")
    console.log("Doctor found non-blocking warnings.")
    return 0
  }

  console.log("")
  console.log("Doctor checks passed.")
  return 0
}
