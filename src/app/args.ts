import { parseArgs } from "node:util"

export type CliOptions = {
  repoUrl?: string
  includeArchived: boolean
  forkScanLimit: number
  recommendedForkLimit: number
}

export function parseCliOptions(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      repo: {
        type: "string",
        short: "r",
      },
      "include-archived": {
        type: "boolean",
        default: false,
      },
      "fork-scan-limit": {
        type: "string",
        default: "40",
      },
      "recommended-fork-limit": {
        type: "string",
        default: "6",
      },
    },
    allowPositionals: true,
  })

  const repoUrl = values.repo ?? positionals[0]

  return {
    repoUrl,
    includeArchived: values["include-archived"],
    forkScanLimit: Number(values["fork-scan-limit"]),
    recommendedForkLimit: Number(values["recommended-fork-limit"]),
  }
}
