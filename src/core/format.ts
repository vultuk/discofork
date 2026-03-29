export function formatRelativeDays(days: number | null): string {
  if (days === null) {
    return "unknown"
  }

  if (days <= 1) {
    return "today"
  }

  if (days < 30) {
    return `${days}d ago`
  }

  const months = Math.round(days / 30)
  if (months < 12) {
    return `${months}mo ago`
  }

  const years = Math.round(months / 12)
  return `${years}y ago`
}

export function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

export function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n")
}

export function pad(value: string, length: number): string {
  if (value.length >= length) {
    return value
  }

  return value + " ".repeat(length - value.length)
}
