import { normalizeCompareSelection, type CompareSelection } from "./compare-selection"

const COMPARE_WORKSPACES_STORAGE_KEY = "discofork-compare-workspaces"

export const COMPARE_WORKSPACES_CHANGE_EVENT = "discofork:compare-workspaces-change"

export type CompareWorkspace = {
  id: string
  name: string
  repos: CompareSelection
  createdAt: string
  updatedAt: string
}

function isCompareWorkspace(value: unknown): value is CompareWorkspace {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.repos)
  )
}

function readStoredCompareWorkspaces(): CompareWorkspace[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = localStorage.getItem(COMPARE_WORKSPACES_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter(isCompareWorkspace)
      .map((workspace) => ({
        ...workspace,
        repos: normalizeCompareSelection(workspace.repos),
      }))
      .filter((workspace) => workspace.repos.length > 0)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  } catch {
    return []
  }
}

function writeCompareWorkspaces(workspaces: CompareWorkspace[]): CompareWorkspace[] {
  const normalized = [...workspaces].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )

  if (typeof window !== "undefined") {
    localStorage.setItem(COMPARE_WORKSPACES_STORAGE_KEY, JSON.stringify(normalized))
    window.dispatchEvent(
      new CustomEvent<{ workspaces: CompareWorkspace[] }>(COMPARE_WORKSPACES_CHANGE_EVENT, {
        detail: { workspaces: normalized },
      }),
    )
  }

  return normalized
}

function buildDefaultWorkspaceName(repos: CompareSelection): string {
  return repos.join(" · ")
}

function buildWorkspaceId(repos: CompareSelection): string {
  return repos.join("__")
}

export function getCompareWorkspaces(): CompareWorkspace[] {
  return readStoredCompareWorkspaces()
}

export function saveCompareWorkspace(repos: CompareSelection, name?: string): CompareWorkspace {
  const normalizedRepos = normalizeCompareSelection(repos)
  if (normalizedRepos.length === 0) {
    throw new Error("Cannot save an empty compare workspace.")
  }

  const now = new Date().toISOString()
  const nextName = name?.trim() || buildDefaultWorkspaceName(normalizedRepos)
  const workspaces = readStoredCompareWorkspaces()
  const existingIndex = workspaces.findIndex((workspace) => workspace.repos.join(",") === normalizedRepos.join(","))

  if (existingIndex >= 0) {
    const updated: CompareWorkspace = {
      ...workspaces[existingIndex],
      name: nextName,
      repos: normalizedRepos,
      updatedAt: now,
    }

    workspaces.splice(existingIndex, 1, updated)
    writeCompareWorkspaces(workspaces)
    return updated
  }

  const created: CompareWorkspace = {
    id: buildWorkspaceId(normalizedRepos),
    name: nextName,
    repos: normalizedRepos,
    createdAt: now,
    updatedAt: now,
  }

  writeCompareWorkspaces([created, ...workspaces])
  return created
}

export function removeCompareWorkspace(id: string): CompareWorkspace[] {
  return writeCompareWorkspaces(readStoredCompareWorkspaces().filter((workspace) => workspace.id !== id))
}
