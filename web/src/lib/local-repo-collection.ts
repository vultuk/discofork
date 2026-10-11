export type LocalRepoCollectionEntry = {
  fullName: string
  owner: string
  repo: string
  savedAt: string
  secondaryLabel: string
}

export function filterLocalRepoCollection<T extends LocalRepoCollectionEntry>(entries: T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return entries
  }

  return entries.filter((entry) => {
    const haystacks = [entry.fullName, entry.owner, entry.repo]
    return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
  })
}

export function summarizeLocalRepoCollection(filteredCount: number, totalCount: number, query: string): string {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return `${totalCount} ${totalCount === 1 ? "repository" : "repositories"}`
  }

  return `${filteredCount} ${filteredCount === 1 ? "match" : "matches"} for “${normalizedQuery}”`
}
