export type RepoRecommendationSet = {
  bestMaintained: string
  closestToUpstream: string
  mostFeatureRich: string
  mostOpinionated: string
}

export type CachedForkView = {
  fullName: string
  maintenance: string
  changeMagnitude: string
  summary: string
  bestFor: string
}

export type CachedRepoView = {
  kind: "cached"
  owner: string
  repo: string
  fullName: string
  githubUrl: string
  cachedAt: string
  upstreamSummary: string
  recommendations: RepoRecommendationSet
  forks: CachedForkView[]
}

export type QueuedRepoView = {
  kind: "queued"
  owner: string
  repo: string
  fullName: string
  githubUrl: string
  queuedAt: string
  queueHint: string
}

export type RepoView = CachedRepoView | QueuedRepoView

const mockCache = new Map<string, CachedRepoView>([
  [
    "openai/codex",
    {
      kind: "cached",
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      githubUrl: "https://github.com/openai/codex",
      cachedAt: "2026-03-29T16:40:00Z",
      upstreamSummary:
        "Codex is OpenAI’s open source coding agent repo. The upstream appears geared toward practical agent execution, terminal workflows, and tool-driven software changes rather than a thin SDK or demo shell.",
      recommendations: {
        bestMaintained: "DNGgriffin/whispercode",
        closestToUpstream: "winmin/evil-opencode",
        mostFeatureRich: "DNGgriffin/whispercode",
        mostOpinionated: "winmin/evil-opencode",
      },
      forks: [
        {
          fullName: "DNGgriffin/whispercode",
          maintenance: "active",
          changeMagnitude: "significant divergence",
          summary:
            "Adds mobile and push-oriented workflow changes while keeping the repo viable as a product fork for teams comfortable owning a larger downstream surface.",
          bestFor: "Teams shipping a productized Codex derivative with notification, pairing, or mobile distribution needs.",
        },
        {
          fullName: "winmin/evil-opencode",
          maintenance: "stale",
          changeMagnitude: "significant divergence",
          summary:
            "Looks intentionally less constrained than upstream, with guardrail removal, CI changes, and a much wider compatibility and maintenance risk profile.",
          bestFor: "Researchers or advanced users explicitly looking for a more permissive variant and willing to absorb the maintenance gap.",
        },
      ],
    },
  ],
])

export async function resolveRepositoryView(owner: string, repo: string): Promise<RepoView> {
  const fullName = `${owner}/${repo}`

  // Frontend-only placeholder:
  // replace this with a real HTTP/database lookup when the backend exists.
  const cached = mockCache.get(fullName)
  if (cached) {
    return cached
  }

  // Frontend-only placeholder:
  // replace this with a real queue enqueue response after Redis integration exists.
  return {
    kind: "queued",
    owner,
    repo,
    fullName,
    githubUrl: `https://github.com/${fullName}`,
    queuedAt: new Date().toISOString(),
    queueHint: "No cached analysis was found. This repo would be queued for Discofork processing and shown here once the backend finishes the first run.",
  }
}
