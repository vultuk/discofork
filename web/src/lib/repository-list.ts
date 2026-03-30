export const REPO_LIST_PAGE_SIZE = 25

export const REPO_LIST_ORDER_VALUES = ["updated", "forks", "stars"] as const

export type RepoListOrder = (typeof REPO_LIST_ORDER_VALUES)[number]

export const REPO_LIST_STATUS_FILTER_VALUES = ["all", "queued", "ready", "processing", "failed"] as const

export type RepoListStatusFilter = (typeof REPO_LIST_STATUS_FILTER_VALUES)[number]

export type RepoListItem = {
  fullName: string
  owner: string
  repo: string
  githubUrl: string
  status: "queued" | "processing" | "ready" | "failed"
  queuedAt: string | null
  processingStartedAt: string | null
  cachedAt: string | null
  updatedAt: string
  stars: number | null
  forks: number | null
  defaultBranch: string | null
  lastPushedAt: string | null
  upstreamSummary: string | null
  forkBriefCount: number
}

export type RepoListStats = {
  total: number
  queued: number
  processing: number
  pending: number
  cached: number
  failed: number
}

export type RepoListView = {
  items: RepoListItem[]
  stats: RepoListStats
  order: RepoListOrder
  statusFilter: RepoListStatusFilter
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
  databaseEnabled: boolean
  queueEnabled: boolean
}
