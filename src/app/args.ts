import { parseArgs } from "node:util"

export type CliOptions = {
  command: "app" | "doctor"
  repoUrl?: string
  includeArchived: boolean
  forkScanLimit: number
  recommendedForkLimit: number
  compareConcurrency: number
  help: boolean
}

export function renderHelpText(): string {
  return [
    "Discofork",
    "",
    "Usage:",
    "  bun run start -- [options] [owner/repo|https://github.com/owner/repo]",
    "  bun run start -- doctor",
    "",
    "Options:",
    "  -r, --repo <value>                 Repository URL or owner/name shorthand",
    "      --include-archived            Include archived forks in discovery",
    "      --fork-scan-limit <number>    Changed-fork candidate limit to surface (default: 25)",
    "      --recommended-fork-limit <n>  Number of forks preselected by default (default: 6)",
    "      --compare-concurrency <n>     Fork clone/compare/analyze concurrency (default: 3)",
    "  -h, --help                        Show this help text",
    "",
    "Examples:",
    "  bun run start -- doctor",
    "  bun run start -- --repo cli/go-gh",
    "  bun run start -- https://github.com/cli/go-gh",
    "  bun run start -- --repo cli/go-gh --fork-scan-limit 40 --compare-concurrency 5",
  ].join("\n")
}

export function parseCliOptions(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      repo: {
        type: "string",
        short: "r",
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      "include-archived": {
        type: "boolean",
        default: false,
      },
      "fork-scan-limit": {
        type: "string",
        default: "25",
      },
      "recommended-fork-limit": {
        type: "string",
        default: "6",
      },
      "compare-concurrency": {
        type: "string",
        default: "3",
      },
    },
    allowPositionals: true,
  })

  const command = positionals[0] === "doctor" ? "doctor" : "app"
  const repoUrl = values.repo ?? (command === "doctor" ? positionals[1] : positionals[0])

  return {
    command,
    repoUrl,
    includeArchived: values["include-archived"],
    forkScanLimit: Number(values["fork-scan-limit"]),
    recommendedForkLimit: Number(values["recommended-fork-limit"]),
    compareConcurrency: Number(values["compare-concurrency"]),
    help: values.help,
  }
}
