import { calculateForkScore } from "./fork-score"
import type { CachedForkView, RepoRecommendationSet } from "./repository-service"

export type VisitorGoalKey = keyof RepoRecommendationSet

export type VisitorGoalCard = {
  key: VisitorGoalKey
  title: string
  description: string
  fork: CachedForkView | null
}

const VISITOR_GOAL_CONTENT: Record<VisitorGoalKey, { title: string; description: string }> = {
  bestMaintained: {
    title: "Safest starting point",
    description: "Start with the fork that looks healthiest to adopt without betting on heavy downstream churn.",
  },
  closestToUpstream: {
    title: "Stay close to upstream",
    description: "Pick the option with the smallest merge surface when you want easier future upgrades.",
  },
  mostFeatureRich: {
    title: "Need more capability",
    description: "Jump straight to the fork with the broadest upside when feature depth matters more than simplicity.",
  },
  mostOpinionated: {
    title: "Explore the bold bet",
    description: "Open the most opinionated fork when you want to see the strongest product direction or experimentation.",
  },
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function buildForkSearchText(fork: CachedForkView): string {
  return [
    fork.fullName,
    fork.summary,
    fork.likelyPurpose,
    fork.bestFor,
    ...fork.additionalFeatures,
    ...fork.missingFeatures,
    ...fork.strengths,
    ...fork.risks,
  ]
    .join(" ")
    .toLowerCase()
}

export function buildVisitorGoalCards(
  recommendations: RepoRecommendationSet,
  forks: CachedForkView[],
): VisitorGoalCard[] {
  const forksByName = new Map(forks.map((fork) => [fork.fullName, fork]))

  return (Object.keys(VISITOR_GOAL_CONTENT) as VisitorGoalKey[]).map((key) => ({
    key,
    title: VISITOR_GOAL_CONTENT[key].title,
    description: VISITOR_GOAL_CONTENT[key].description,
    fork: forksByName.get(recommendations[key]) ?? null,
  }))
}

export function filterForksByQuery(forks: CachedForkView[], query: string): CachedForkView[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) {
    return forks
  }

  return forks.filter((fork) => buildForkSearchText(fork).includes(normalizedQuery))
}

export function rankForksByScore(forks: CachedForkView[]): CachedForkView[] {
  return [...forks].sort((left, right) => {
    const scoreDifference = calculateForkScore(right) - calculateForkScore(left)
    if (scoreDifference !== 0) {
      return scoreDifference
    }

    const maintenanceDifference = left.maintenance.localeCompare(right.maintenance)
    if (maintenanceDifference !== 0) {
      return maintenanceDifference
    }

    return left.fullName.localeCompare(right.fullName)
  })
}

export function getForkFeatureSignalCount(fork: CachedForkView): number {
  return fork.additionalFeatures.length + fork.strengths.length
}

export function getForkRiskSignalCount(fork: CachedForkView): number {
  return fork.missingFeatures.length + fork.risks.length
}

export function getForkTopPositive(fork: CachedForkView): string {
  return (
    fork.additionalFeatures[0] ??
    fork.strengths[0] ??
    fork.bestFor ??
    "No standout upside was captured in the cached brief."
  )
}

export function getForkTopRisk(fork: CachedForkView): string {
  return (
    fork.risks[0] ??
    fork.missingFeatures[0] ??
    "No major caution was captured in the cached brief."
  )
}
