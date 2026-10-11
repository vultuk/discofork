import { createMapStore } from "./local-storage"

export type TagsMap = Record<string, string[]>

export type TagSummary = {
  tag: string
  repoCount: number
  repos: string[]
}

export const TAGS_STORAGE_KEY = "discofork-tags"
export const TAGS_CHANGE_EVENT = "discofork:tags-changed"

const store = createMapStore<string[]>({
  storageKey: TAGS_STORAGE_KEY,
})

function emitTagsChange(): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent(TAGS_CHANGE_EVENT))
}

function sameTags(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index])
}

export const getTags = store.getAll

export function getRepoTags(fullName: string): string[] {
  return store.get(fullName) ?? []
}

export function setRepoTags(fullName: string, repoTags: string[]): void {
  const cleaned = [...new Set(repoTags.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort()
  const current = getRepoTags(fullName)

  if (sameTags(current, cleaned)) {
    return
  }

  if (cleaned.length === 0) {
    store.remove(fullName)
  } else {
    store.set(fullName, cleaned)
  }
  emitTagsChange()
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

export function getAllTags(tagsMap: TagsMap = getTags()): string[] {
  const allTags = new Set<string>()
  for (const repoTags of Object.values(tagsMap)) {
    for (const tag of repoTags) {
      allTags.add(tag)
    }
  }
  return [...allTags].sort((a, b) => a.localeCompare(b))
}

export function getReposByTag(tag: string, tagsMap: TagsMap = getTags()): string[] {
  return Object.entries(tagsMap)
    .filter(([, repoTags]) => repoTags.includes(tag))
    .map(([fullName]) => fullName)
    .sort((a, b) => a.localeCompare(b))
}

export function getTagSummaries(tagsMap: TagsMap = getTags()): TagSummary[] {
  return getAllTags(tagsMap).map((tag) => {
    const repos = getReposByTag(tag, tagsMap)
    return {
      tag,
      repoCount: repos.length,
      repos,
    }
  })
}

export function getTagSummary(tag: string | null, tagsMap: TagsMap = getTags()): TagSummary | null {
  if (!tag) {
    return null
  }

  return getTagSummaries(tagsMap).find((summary) => summary.tag === tag) ?? null
}
