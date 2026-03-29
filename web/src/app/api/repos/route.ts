import { NextRequest, NextResponse } from "next/server"

import { REPO_LIST_PAGE_SIZE, type RepoListView } from "@/lib/repository-list"
import { databaseConfigured } from "@/lib/server/database"
import { listRepoRecords } from "@/lib/server/reports"

function parsePage(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue ?? "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export async function GET(request: NextRequest) {
  const page = parsePage(request.nextUrl.searchParams.get("page"))

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
      page,
      pageSize: REPO_LIST_PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasPrevious: page > 1,
      hasNext: false,
      databaseEnabled: false,
    }

    return NextResponse.json(payload)
  }

  const { items, stats } = await listRepoRecords(page, REPO_LIST_PAGE_SIZE)
  const totalPages = stats.total === 0 ? 0 : Math.ceil(stats.total / REPO_LIST_PAGE_SIZE)

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
    page,
    pageSize: REPO_LIST_PAGE_SIZE,
    total: stats.total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    databaseEnabled: true,
  }

  return NextResponse.json(payload)
}
