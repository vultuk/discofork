import type { DiffFacts, ForkAnalysis, ForkMetadata, RecommendationSummary } from "../core/types.ts"

export function daysSince(isoTimestamp: string | null): number | null {
  if (!isoTimestamp) {
    return null
  }

  const timestamp = Date.parse(isoTimestamp)
  if (Number.isNaN(timestamp)) {
    return null
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)))
}

export function scoreForkCandidate(input: {
  stargazerCount: number
  pushedDaysAgo: number | null
  isArchived: boolean
  parentFullName: string | null
}): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (input.isArchived) {
    score -= 50
    reasons.push("archived")
  }

  if (input.pushedDaysAgo !== null) {
    if (input.pushedDaysAgo <= 30) {
      score += 35
      reasons.push("recently pushed")
    } else if (input.pushedDaysAgo <= 90) {
      score += 20
      reasons.push("active within 90 days")
    } else if (input.pushedDaysAgo <= 365) {
      score += 8
      reasons.push("updated within a year")
    } else {
      score -= 10
      reasons.push("stale activity")
    }
  }

  if (input.stargazerCount >= 100) {
    score += 25
    reasons.push("high-star fork")
  } else if (input.stargazerCount >= 20) {
    score += 15
    reasons.push("notable stars")
  } else if (input.stargazerCount >= 5) {
    score += 8
    reasons.push("some community traction")
  }

  if (input.parentFullName) {
    score += 5
    reasons.push("proper fork metadata")
  }

  return {
    score,
    reasons,
  }
}

export function recommendForks(
  forks: ForkMetadata[],
  limit: number,
): Map<string, boolean> {
  return new Map(
    forks
      .slice()
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((fork) => [fork.fullName, true]),
  )
}

export function deriveMaintenanceLabel(pushedDaysAgo: number | null): ForkAnalysis["maintenance"] {
  if (pushedDaysAgo === null) {
    return "unknown"
  }

  if (pushedDaysAgo <= 45) {
    return "active"
  }

  if (pushedDaysAgo <= 180) {
    return "slowing"
  }

  return "stale"
}

export function deriveMagnitude(diff: DiffFacts): ForkAnalysis["changeMagnitude"] {
  const totalChanges = diff.insertions + diff.deletions
  if (diff.aheadCount <= 5 && diff.changedFiles <= 15 && totalChanges <= 400) {
    return "minor"
  }

  if (diff.aheadCount <= 25 && diff.changedFiles <= 80 && totalChanges <= 3000) {
    return "moderate"
  }

  if (diff.aheadCount <= 100 && diff.changedFiles <= 250 && totalChanges <= 15000) {
    return "substantial"
  }

  return "significant_divergence"
}

export function computeRecommendations(
  forks: Array<{
    metadata: ForkMetadata
    diffFacts: DiffFacts
    analysis: ForkAnalysis
  }>,
): RecommendationSummary {
  const activeForks = forks
    .filter((fork) => fork.analysis.maintenance === "active")
    .sort((left, right) => right.metadata.score - left.metadata.score)

  const closestToUpstream = forks
    .slice()
    .sort((left, right) => {
      const leftDistance = left.diffFacts.aheadCount + left.diffFacts.behindCount
      const rightDistance = right.diffFacts.aheadCount + right.diffFacts.behindCount
      return leftDistance - rightDistance
    })[0]

  const mostFeatureRich = forks
    .filter((fork) => fork.analysis.changeCategories.includes("features"))
    .sort((left, right) => right.diffFacts.changedFiles - left.diffFacts.changedFiles)[0]

  const mostOpinionated = forks
    .filter((fork) =>
      fork.analysis.changeCategories.some((category) =>
        ["branding", "architectural_experiment", "removes_features", "significant_divergence"].includes(
          category,
        ),
      ),
    )
    .sort((left, right) => {
      const leftMagnitude = left.diffFacts.insertions + left.diffFacts.deletions
      const rightMagnitude = right.diffFacts.insertions + right.diffFacts.deletions
      return rightMagnitude - leftMagnitude
    })[0]

  return {
    bestMaintained: activeForks[0]?.metadata.fullName ?? null,
    closestToUpstream: closestToUpstream?.metadata.fullName ?? null,
    mostFeatureRich: mostFeatureRich?.metadata.fullName ?? null,
    mostOpinionated: mostOpinionated?.metadata.fullName ?? null,
  }
}
