import { REPO_LIST_ORDER_VALUES, REPO_LIST_STATUS_FILTER_VALUES, type RepoListOrder, type RepoListStatusFilter } from "./repository-list"

export function parseRepoListPage(rawValue: string | null | undefined): number {
  const parsed = Number.parseInt(rawValue ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function parseRepoListOrder(rawValue: string | null | undefined): RepoListOrder {
  return REPO_LIST_ORDER_VALUES.includes((rawValue ?? "") as RepoListOrder)
    ? ((rawValue ?? "updated") as RepoListOrder)
    : "updated"
}

export function parseRepoListStatusFilter(rawValue: string | null | undefined): RepoListStatusFilter {
  return REPO_LIST_STATUS_FILTER_VALUES.includes((rawValue ?? "") as RepoListStatusFilter)
    ? ((rawValue ?? "all") as RepoListStatusFilter)
    : "all"
}

export function normalizeRepoListQuery(rawValue: string | null | undefined): string {
  return rawValue?.trim() ?? ""
}

export function buildRepoListHref(page: number, order: RepoListOrder, statusFilter: RepoListStatusFilter, query: string, language = ""): string {
  const params = new URLSearchParams()

  if (page > 1) {
    params.set("page", String(page))
  }

  params.set("order", order)
  params.set("status", statusFilter)

  if (query) {
    params.set("query", query)
  }

  if (language) {
    params.set("language", language)
  }

  return `/repos?${params.toString()}`
}
