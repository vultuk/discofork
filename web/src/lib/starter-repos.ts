export type StarterRepoCard = {
  owner: string
  repo: string
  fullName: string
  canonicalPath: string
  collectionSlug: string
  collectionLabel: string
  title: string
  description: string
}

export type StarterRepoCollection = {
  slug: string
  label: string
  description: string
  repos: StarterRepoCard[]
}

const STARTER_REPO_COLLECTIONS: StarterRepoCollection[] = [
  {
    slug: "ai-tooling",
    label: "AI tooling",
    description: "Strong starter repos for people exploring coding agents, inference tooling, and model workflows.",
    repos: [
      {
        owner: "openai",
        repo: "codex",
        fullName: "openai/codex",
        canonicalPath: "/openai/codex",
        collectionSlug: "ai-tooling",
        collectionLabel: "AI tooling",
        title: "Codex CLI",
        description: "Agentic coding from the terminal, with a repo route that makes Discofork's cached summary useful immediately.",
      },
      {
        owner: "anthropics",
        repo: "claude-code",
        fullName: "anthropics/claude-code",
        canonicalPath: "/anthropics/claude-code",
        collectionSlug: "ai-tooling",
        collectionLabel: "AI tooling",
        title: "Claude Code",
        description: "Another agent-oriented coding repo that helps visitors compare workflow trade-offs quickly.",
      },
    ],
  },
  {
    slug: "developer-tools",
    label: "Developer tools",
    description: "Widely recognized repos that make the product legible for new visitors fast.",
    repos: [
      {
        owner: "vercel",
        repo: "next.js",
        fullName: "vercel/next.js",
        canonicalPath: "/vercel/next.js",
        collectionSlug: "developer-tools",
        collectionLabel: "Developer tools",
        title: "Next.js",
        description: "A familiar high-signal repo for testing cached briefs, summaries, and queue behavior.",
      },
      {
        owner: "oven-sh",
        repo: "bun",
        fullName: "oven-sh/bun",
        canonicalPath: "/oven-sh/bun",
        collectionSlug: "developer-tools",
        collectionLabel: "Developer tools",
        title: "Bun",
        description: "Useful for seeing how Discofork handles a fast-moving runtime with lots of forks and stars.",
      },
    ],
  },
  {
    slug: "infrastructure",
    label: "Infrastructure",
    description: "Ops-heavy repos for testing summary depth and comparison workflows on backend-focused projects.",
    repos: [
      {
        owner: "grafana",
        repo: "grafana",
        fullName: "grafana/grafana",
        canonicalPath: "/grafana/grafana",
        collectionSlug: "infrastructure",
        collectionLabel: "Infrastructure",
        title: "Grafana",
        description: "A large mature platform repo that makes fork triage and cached summaries more tangible.",
      },
      {
        owner: "redis",
        repo: "redis",
        fullName: "redis/redis",
        canonicalPath: "/redis/redis",
        collectionSlug: "infrastructure",
        collectionLabel: "Infrastructure",
        title: "Redis",
        description: "A foundational infra project that gives first-time visitors another recognizable comparison candidate.",
      },
    ],
  },
]

export function getStarterRepoCollections(): StarterRepoCollection[] {
  return STARTER_REPO_COLLECTIONS.map((collection) => ({
    ...collection,
    repos: collection.repos.map((repo) => ({ ...repo })),
  }))
}

export function getStarterRepoCards(limit?: number): StarterRepoCard[] {
  const cards = STARTER_REPO_COLLECTIONS.flatMap((collection) => collection.repos.map((repo) => ({ ...repo })))
  return typeof limit === "number" ? cards.slice(0, limit) : cards
}

export function buildStarterRepoLookup(): Record<string, StarterRepoCard> {
  return Object.fromEntries(getStarterRepoCards().map((repo) => [repo.fullName, repo]))
}
