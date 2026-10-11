import { NextRequest, NextResponse } from "next/server"

import {
  REPO_LIST_PAGE_SIZE,
  type RepoListView,
} from "@/lib/repository-list"
import { normalizeRepoListQuery, parseRepoListOrder, parseRepoListPage, parseRepoListStatusFilter } from "@/lib/repository-list-query"
import { databaseConfigured } from "@/lib/server/database"
import { queueConfigured } from "@/lib/server/queue"
import { listRepoRecords } from "@/lib/server/reports"

export async function GET(request: NextRequest) {
  const page = parseRepoListPage(request.nextUrl.searchParams.get("page"))
  const order = parseRepoListOrder(request.nextUrl.searchParams.get("order"))
  const statusFilter = parseRepoListStatusFilter(request.nextUrl.searchParams.get("status"))
  const query = normalizeRepoListQuery(request.nextUrl.searchParams.get("query"))

  if (!databaseConfigured()) {
    const payload: RepoListView = {
      items: [],
      stats: {
        total: 0,
        queued: 0,
        processing: 0,
        pending: 0,
        cached: 0,
        failed: 0,
      },
      order,
      statusFilter,
      query,
      page,
      pageSize: REPO_LIST_PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasPrevious: page > 1,
      hasNext: false,
      databaseEnabled: false,
      queueEnabled: queueConfigured(),
    }

    return NextResponse.json(payload)
  }

  const { items, stats, total } = await listRepoRecords(page, REPO_LIST_PAGE_SIZE, order, statusFilter, query)
  const totalPages = total === 0 ? 0 : Math.ceil(total / REPO_LIST_PAGE_SIZE)

  const payload: RepoListView = {
    items: items.map((item) => ({
      fullName: item.full_name,
      owner: item.owner,
      repo: item.repo,
      githubUrl: item.github_url,
      status: item.status,
      queuedAt: item.queued_at,
      processingStartedAt: item.processing_started_at,
      cachedAt: item.cached_at,
      updatedAt: item.updated_at,
      retryCount: item.retry_count,
      retryState: item.retry_state,
      nextRetryAt: item.next_retry_at,
      lastFailedAt: item.last_failed_at,
      stars: item.stars,
      forks: item.forks,
      defaultBranch: item.default_branch,
      lastPushedAt: item.last_pushed_at,
      upstreamSummary: item.upstream_summary,
      forkBriefCount: item.fork_brief_count,
    })),
    stats,
    order,
    statusFilter,
    query,
    page,
    pageSize: REPO_LIST_PAGE_SIZE,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    databaseEnabled: true,
    queueEnabled: queueConfigured(),
  }

  return NextResponse.json(payload)
}
