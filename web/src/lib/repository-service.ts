export type RepoRecommendationSet = {
  bestMaintained: string
  closestToUpstream: string
  mostFeatureRich: string
  mostOpinionated: string
}

export type RepoStats = {
  stars: number
  forks: number
  defaultBranch: string
  lastPushedAt: string
}

export type CachedForkView = {
  fullName: string
  maintenance: string
  changeMagnitude: string
  summary: string
  likelyPurpose: string
  bestFor: string
  additionalFeatures: string[]
  missingFeatures: string[]
  strengths: string[]
  risks: string[]
}

export type CachedRepoView = {
  kind: "cached"
  owner: string
  repo: string
  fullName: string
  githubUrl: string
  cachedAt: string
  stats: RepoStats
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
    "vultuk/discofork",
    {
      kind: "cached",
      owner: "vultuk",
      repo: "discofork",
      fullName: "vultuk/discofork",
      githubUrl: "https://github.com/vultuk/discofork",
      cachedAt: "2026-03-29T18:05:00Z",
      stats: {
        stars: 18,
        forks: 9,
        defaultBranch: "main",
        lastPushedAt: "2026-03-29",
      },
      upstreamSummary:
        "Discofork is a local-first CLI for evaluating GitHub forks with `gh`, `git`, and `codex`. The upstream is focused on practical fork triage: discover forks, exclude low-value mirrors, gather structured diff facts locally, then turn the result into a concise decision brief.",
      recommendations: {
        bestMaintained: "someuser/discofork-plus",
        closestToUpstream: "team/discofork-lite",
        mostFeatureRich: "infra/discofork-studio",
        mostOpinionated: "infra/discofork-studio",
      },
      forks: [
        {
          fullName: "someuser/discofork-plus",
          maintenance: "active",
          changeMagnitude: "moderate divergence",
          summary:
            "Stays close to upstream while extending export, filtering, and report handling. It looks like a practical operator-focused fork rather than a rewrite.",
          likelyPurpose:
            "Keep the core Discofork workflow intact while adding more polished reporting and operator-friendly controls.",
          bestFor:
            "Teams that want the upstream CLI workflow but need richer exports, slightly more automation, and a still-manageable merge surface.",
          additionalFeatures: [
            "Extended report export formats and richer saved run metadata.",
            "More fork filtering presets and stronger default selection controls.",
            "Extra diagnostics around cached analyses and run artifacts.",
          ],
          missingFeatures: [
            "Does not appear to push Discofork beyond its local-first terminal focus.",
            "No sign of a broader hosted or web-backed architecture compared with more ambitious forks.",
          ],
          strengths: [
            "Likely the safest upgrade path for users who already like upstream Discofork.",
            "Adds useful workflow polish without turning the codebase into a different product.",
            "Maintenance posture looks healthier than most forks in this sample.",
          ],
          risks: [
            "Still creates some merge debt relative to upstream.",
            "The extra export and workflow surface adds operational complexity compared with vanilla Discofork.",
          ],
        },
        {
          fullName: "team/discofork-lite",
          maintenance: "active",
          changeMagnitude: "minor divergence",
          summary:
            "Trims the product down toward a simpler review flow and stays visually and structurally close to upstream.",
          likelyPurpose:
            "Minimize complexity for users who only need the core repository summary and a lightweight fork comparison workflow.",
          bestFor:
            "Users who want the smallest delta from upstream and prefer predictability over feature growth.",
          additionalFeatures: [
            "Cleaner defaults and reduced UI surface for straightforward comparisons.",
            "Simplified operator flow for teams that do not need advanced export or queueing behavior.",
          ],
          missingFeatures: [
            "Less ambitious reporting and recommendation output than upstream or more feature-heavy forks.",
            "Fewer advanced workflow and debugging affordances.",
          ],
          strengths: [
            "Probably the lowest-risk branch for people who care about staying aligned with upstream.",
            "Easier to understand and maintain than heavily customized forks.",
          ],
          risks: [
            "The reduced surface may feel limiting for users who want deeper analysis artifacts.",
            "A simplification-first fork can lag behind upstream feature additions if scope narrows too far.",
          ],
        },
        {
          fullName: "infra/discofork-studio",
          maintenance: "slowing",
          changeMagnitude: "significant divergence",
          summary:
            "Pushes Discofork toward a broader platform with heavier workflow orchestration, presentation layers, and more opinionated reporting.",
          likelyPurpose:
            "Turn Discofork from a focused CLI into a more expansive analysis product with stronger workflow control and presentation features.",
          bestFor:
            "Teams that want a more productized fork-analysis stack and are willing to own a larger, more opinionated downstream codebase.",
          additionalFeatures: [
            "Broader reporting and workflow orchestration beyond the CLI-first upstream shape.",
            "More opinionated presentation and result surfacing for repeated analysis work.",
            "Stronger emphasis on product workflow over minimal local tooling.",
          ],
          missingFeatures: [
            "Less of the upstream tool's simplicity and low-friction local-first feel.",
            "Likely harder to keep tightly synchronized with upstream improvements.",
          ],
          strengths: [
            "Most feature-rich option in this sample.",
            "Could suit teams that want Discofork as a foundation rather than just a terminal tool.",
          ],
          risks: [
            "Merge debt and maintenance cost will be materially higher.",
            "The project may drift away from the original clarity and practicality that make upstream attractive.",
          ],
        },
      ],
    },
  ],
  [
    "openai/codex",
    {
      kind: "cached",
      owner: "openai",
      repo: "codex",
      fullName: "openai/codex",
      githubUrl: "https://github.com/openai/codex",
      cachedAt: "2026-03-29T16:40:00Z",
      stats: {
        stars: 132207,
        forks: 14162,
        defaultBranch: "dev",
        lastPushedAt: "2026-03-29",
      },
      upstreamSummary:
        "Codex is OpenAI’s open source coding agent repo. The upstream is geared toward practical agent execution, terminal workflows, and tool-driven software changes rather than a thin SDK or demo shell.",
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
          likelyPurpose:
            "Turn Codex into a more productized downstream agent with mobile, pairing, and notification-oriented workflows.",
          bestFor:
            "Teams shipping a Codex derivative with notification, pairing, or mobile distribution requirements.",
          additionalFeatures: [
            "Push and pairing-oriented workflow changes.",
            "Mobile and distribution-specific additions beyond the upstream baseline.",
            "Broader downstream product surface around the core agent workflow.",
          ],
          missingFeatures: [
            "Less alignment with the simplest upstream maintenance path.",
            "Potentially misses some upstream polish while it carries its own product concerns.",
          ],
          strengths: [
            "Likely the strongest maintained fork in the current sample.",
            "Adds meaningful capabilities instead of superficial branding changes.",
            "Useful for teams who want a base for productization, not just experimentation.",
          ],
          risks: [
            "The downstream surface is much larger, so merge cost rises.",
            "Product-specific behavior can pull the codebase away from upstream expectations.",
          ],
        },
        {
          fullName: "winmin/evil-opencode",
          maintenance: "stale",
          changeMagnitude: "significant divergence",
          summary:
            "Looks intentionally less constrained than upstream, with guardrail removal, CI changes, and a much wider compatibility and maintenance risk profile.",
          likelyPurpose:
            "Provide a more permissive or less restricted agent variant for users who explicitly want fewer upstream constraints.",
          bestFor:
            "Researchers or advanced users looking for a more permissive variant and willing to absorb the maintenance gap.",
          additionalFeatures: [
            "More permissive downstream behavior than upstream.",
            "Custom CI and packaging adjustments for its own distribution path.",
          ],
          missingFeatures: [
            "Likely lacks some recent upstream fixes and refinements.",
            "May not preserve the same safety and maintenance posture as the parent project.",
          ],
          strengths: [
            "Clearly differentiated from upstream for users with that specific goal.",
            "Can be useful for experimentation where the upstream guardrails are too constraining.",
          ],
          risks: [
            "Staleness materially increases integration risk.",
            "The divergence appears large enough to make future sync work expensive.",
          ],
        },
      ],
    },
  ],
])

export async function resolveRepositoryView(owner: string, repo: string): Promise<RepoView> {
  const fullName = `${owner}/${repo}`

  const cached = mockCache.get(fullName)
  if (cached) {
    return cached
  }

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
