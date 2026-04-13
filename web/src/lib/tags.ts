import { createMapStore } from "./local-storage"

export type TagsMap = Record<string, string[]>

const store = createMapStore<string[]>({
  storageKey: "discofork-tags",
})

export const getTags = store.getAll

export function getRepoTags(fullName: string): string[] {
  return store.get(fullName) ?? []
}

export function setRepoTags(fullName: string, repoTags: string[]): void {
  const cleaned = [...new Set(repoTags.map((t) => t.trim().toLowerCase()).filter(Boolean))].sort()
  if (cleaned.length === 0) {
    store.remove(fullName)
  } else {
    store.set(fullName, cleaned)
  }
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
