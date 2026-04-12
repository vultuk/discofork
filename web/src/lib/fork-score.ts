/**
 * Composite fork score (0-100) calculated client-side from
 * maintenance status, change magnitude, and feature assessment signals.
 */

const MAINTENANCE_SCORES: Record<string, number> = {
  active: 100,
  slowing: 60,
  stale: 20,
  unknown: 40,
}

const MAGNITUDE_SCORES: Record<string, number> = {
  "minor divergence": 90,
  "moderate divergence": 70,
  "significant divergence": 40,
  unknown: 50,
}

type ForkSignals = {
  maintenance: string
  changeMagnitude: string
  additionalFeatures: string[]
  missingFeatures: string[]
  strengths: string[]
  risks: string[]
}

export function calculateForkScore(fork: ForkSignals): number {
  const maintenanceScore = MAINTENANCE_SCORES[fork.maintenance.toLowerCase()] ?? MAINTENANCE_SCORES.unknown
  const magnitudeScore = MAGNITUDE_SCORES[fork.changeMagnitude.toLowerCase()] ?? MAGNITUDE_SCORES.unknown

  // Feature richness: more features and strengths = higher score, more missing/risks = lower
  const featureBonus = Math.min(20, fork.additionalFeatures.length * 4 + fork.strengths.length * 3)
  const riskPenalty = Math.min(20, fork.missingFeatures.length * 4 + fork.risks.length * 3)

  // Weighted composite: maintenance 40%, magnitude 30%, feature assessment 30%
  const raw = maintenanceScore * 0.4 + magnitudeScore * 0.3 + (50 + featureBonus - riskPenalty) * 0.3

  return Math.round(Math.max(0, Math.min(100, raw)))
}

export type ScoreColor = "green" | "yellow" | "red"

export function getScoreColor(score: number): ScoreColor {
  if (score >= 70) return "green"
  if (score >= 40) return "yellow"
  return "red"
}

export function getScoreBadgeVariant(score: number): "success" | "warning" | "muted" {
  const color = getScoreColor(score)
  if (color === "green") return "success"
  if (color === "yellow") return "warning"
  return "muted"
}
