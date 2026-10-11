import { headers } from "next/headers"

import type { RepoListOrder, RepoListStatusFilter, RepoListView } from "./repository-list"
import { normalizeRepoListQuery } from "./repository-list-query"

export async function fetchRepositoryList(
  page: number,
  order: RepoListOrder,
  statusFilter: RepoListStatusFilter,
  query = "",
): Promise<RepoListView> {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto = headerStore.get("x-forwarded-proto") ?? "http"

  if (!host) {
    throw new Error("Could not determine request host for repository index lookup.")
  }

  const params = new URLSearchParams({
    page: String(page),
    order,
    status: statusFilter,
  })
  const normalizedQuery = normalizeRepoListQuery(query)
  if (normalizedQuery) {
    params.set("query", normalizedQuery)
  }

  const response = await fetch(`${proto}://${host}/api/repos?${params.toString()}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Repository index lookup failed with status ${response.status}.`)
  }

  return (await response.json()) as RepoListView
}
