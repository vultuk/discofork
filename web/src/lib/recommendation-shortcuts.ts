import type { CachedForkView, RepoRecommendationSet } from "./repository-service"

export type RepoRecommendationKey = keyof RepoRecommendationSet

export type RecommendationShortcut = {
  key: RepoRecommendationKey
  label: string
  forkName: string
  available: boolean
}

export type RecommendationCompareShortcut = {
  leftKey: RepoRecommendationKey
  rightKey: RepoRecommendationKey
  label: string
  forkPair: [string, string]
}

const RECOMMENDATION_LABELS: Record<RepoRecommendationKey, string> = {
  bestMaintained: "Best maintained",
  closestToUpstream: "Closest to upstream",
  mostFeatureRich: "Most feature-rich",
  mostOpinionated: "Most opinionated",
}

const COMPARE_PRIORITY: Array<[RepoRecommendationKey, RepoRecommendationKey]> = [
  ["bestMaintained", "mostFeatureRich"],
  ["bestMaintained", "mostOpinionated"],
  ["closestToUpstream", "mostFeatureRich"],
  ["closestToUpstream", "mostOpinionated"],
]

export function buildRecommendationShortcuts(
  recommendations: RepoRecommendationSet,
  forks: Pick<CachedForkView, "fullName">[],
): {
  shortcuts: RecommendationShortcut[]
  compareShortcut: RecommendationCompareShortcut | null
} {
  const availableForks = new Set(forks.map((fork) => fork.fullName))
  const shortcuts = (Object.keys(RECOMMENDATION_LABELS) as RepoRecommendationKey[]).map((key) => ({
    key,
    label: RECOMMENDATION_LABELS[key],
    forkName: recommendations[key],
    available: availableForks.has(recommendations[key]),
  }))

  for (const [leftKey, rightKey] of COMPARE_PRIORITY) {
    const leftFork = recommendations[leftKey]
    const rightFork = recommendations[rightKey]

    if (!leftFork || !rightFork || leftFork === rightFork) {
      continue
    }

    if (!availableForks.has(leftFork) || !availableForks.has(rightFork)) {
      continue
    }

    return {
      shortcuts,
      compareShortcut: {
        leftKey,
        rightKey,
        label: `Compare ${RECOMMENDATION_LABELS[leftKey]} vs ${RECOMMENDATION_LABELS[rightKey]}`,
        forkPair: [leftFork, rightFork],
      },
    }
  }

  return {
    shortcuts,
    compareShortcut: null,
  }
}
