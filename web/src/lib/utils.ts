import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export type FreshnessVariant = "success" | "warning" | "muted"

export function formatRelativeTime(isoDate: string | null): {
  label: string
  variant: FreshnessVariant
  exactDate: string
} | null {
  if (!isoDate) return null

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return null

  const exactDate = date.toISOString().slice(0, 10)
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (diffMs < 0) return { label: "just now", variant: "success", exactDate }

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  let label: string
  if (seconds < 60) label = "just now"
  else if (minutes < 60) label = `${minutes}m ago`
  else if (hours < 24) label = `${hours}h ago`
  else if (days < 7) label = `${days}d ago`
  else if (weeks < 5) label = `${weeks}w ago`
  else label = `${months}mo ago`

  const variant: FreshnessVariant = days < 3 ? "success" : days < 14 ? "warning" : "muted"

  return { label, variant, exactDate }
}
