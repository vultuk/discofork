import { parseRepoLauncherInput, type RepoLauncherTarget } from "./repo-launcher"

export type RepoLaunchArtifacts = RepoLauncherTarget & {
  discoforkUrl: string
  githubUrl: string
  analysisCommand: string
}

export function buildRepoLaunchArtifacts(rawInput: string, origin = "https://discofork.ai"): RepoLaunchArtifacts | null {
  const target = parseRepoLauncherInput(rawInput)

  if (!target) {
    return null
  }

  const normalizedOrigin = origin.replace(/\/+$/, "")

  return {
    ...target,
    discoforkUrl: `${normalizedOrigin}${target.canonicalPath}`,
    githubUrl: `https://github.com/${target.fullName}`,
    analysisCommand: `discofork analyze ${target.fullName}`,
  }
}
