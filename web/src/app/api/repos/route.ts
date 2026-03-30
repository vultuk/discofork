import { NextRequest, NextResponse } from "next/server"

import {
  REPO_LIST_ORDER_VALUES,
  REPO_LIST_PAGE_SIZE,
  REPO_LIST_STATUS_FILTER_VALUES,
  type RepoListOrder,
  type RepoListStatusFilter,
  type RepoListView,
} from "@/lib/repository-list"
import { databaseConfigured } from "@/lib/server/database"
import { queueConfigured } from "@/lib/server/queue"
import { listRepoRecords } from "@/lib/server/reports"

function parsePage(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseOrder(rawValue: string | null): RepoListOrder {
  return REPO_LIST_ORDER_VALUES.includes((rawValue ?? "") as RepoListOrder)
    ? ((rawValue ?? "updated") as RepoListOrder)
    : "updated"
}

function parseStatusFilter(rawValue: string | null): RepoListStatusFilter {
  return REPO_LIST_STATUS_FILTER_VALUES.includes((rawValue ?? "") as RepoListStatusFilter)
    ? ((rawValue ?? "all") as RepoListStatusFilter)
    : "all"
}

export async function GET(request: NextRequest) {
  const page = parsePage(request.nextUrl.searchParams.get("page"))
  const order = parseOrder(request.nextUrl.searchParams.get("order"))
  const statusFilter = parseStatusFilter(request.nextUrl.searchParams.get("status"))

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

  const { items, stats, total } = await listRepoRecords(page, REPO_LIST_PAGE_SIZE, order, statusFilter)
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
