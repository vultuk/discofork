const TAGS_STORAGE_KEY = "discofork-tags"

export type TagsMap = Record<string, string[]>

export function getTags(): TagsMap {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as TagsMap
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function getRepoTags(fullName: string): string[] {
  const tags = getTags()
  return tags[fullName] ?? []
}

export function setRepoTags(fullName: string, repoTags: string[]): void {
  const tags = getTags()
  const cleaned = [...new Set(repoTags.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort()
  if (cleaned.length === 0) {
    delete tags[fullName]
  } else {
    tags[fullName] = cleaned
  }
  localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
}

export function addTag(fullName: string, tag: string): string[] {
  const current = getRepoTags(fullName)
  const normalized = tag.trim().toLowerCase()
  if (!normalized || current.includes(normalized)) {
    return current
  }
  const updated = [...current, normalized].sort()
  setRepoTags(fullName, updated)
  return updated
}

export function removeTag(fullName: string, tag: string): string[] {
  const current = getRepoTags(fullName)
  const updated = current.filter((t) => t !== tag)
  setRepoTags(fullName, updated)
  return updated
}

export function getAllTags(): string[] {
  const tags = getTags()
  const allTags = new Set<string>()
  for (const repoTags of Object.values(tags)) {
    for (const tag of repoTags) {
      allTags.add(tag)
    }
  }
  return [...allTags].sort()
}

export function getReposByTag(tag: string): string[] {
  const tags = getTags()
  return Object.entries(tags)
    .filter(([, repoTags]) => repoTags.includes(tag))
    .map(([fullName]) => fullName)
}
