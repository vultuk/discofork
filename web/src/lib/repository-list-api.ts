import { headers } from "next/headers"

import type { RepoListOrder, RepoListStatusFilter, RepoListView } from "./repository-list"

export async function fetchRepositoryList(
  page: number,
  order: RepoListOrder,
  statusFilter: RepoListStatusFilter,
): Promise<RepoListView> {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const proto = headerStore.get("x-forwarded-proto") ?? "http"

  if (!host) {
    throw new Error("Could not determine request host for repository index lookup.")
  }

  const response = await fetch(`${proto}://${host}/api/repos?page=${page}&order=${order}&status=${statusFilter}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Repository index lookup failed with status ${response.status}.`)
  }

  return (await response.json()) as RepoListView
}
