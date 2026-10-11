export type CanonicalRepoIdentity = {
  owner: string
  repo: string
  fullName: string
  githubUrl: string
}

function normalizeRepoSegment(value: string): string {
  return value.trim().toLowerCase()
}

export function canonicalizeRepoIdentity(owner: string, repo: string): CanonicalRepoIdentity {
  const canonicalOwner = normalizeRepoSegment(owner)
  const canonicalRepo = normalizeRepoSegment(repo)
  const fullName = `${canonicalOwner}/${canonicalRepo}`

  return {
    owner: canonicalOwner,
    repo: canonicalRepo,
    fullName,
    githubUrl: `https://github.com/${fullName}`,
  }
}

export function canonicalizeRepoFullName(fullName: string): string {
  const [owner = "", repo = ""] = fullName.split("/", 2)

  if (!owner || !repo) {
    return fullName.trim().toLowerCase()
  }

  return canonicalizeRepoIdentity(owner, repo).fullName
}

export function repoIdentifierAliases(fullName: string): string[] {
  const trimmed = fullName.trim()
  const canonical = canonicalizeRepoFullName(trimmed)
  return Array.from(new Set([trimmed, canonical].filter((value) => value.length > 0)))
}
