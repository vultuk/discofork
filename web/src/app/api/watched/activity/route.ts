import { NextResponse } from "next/server"

import { WATCH_ACTIVITY_BATCH_SIZE } from "@/lib/watches"
import { getRepoCacheActivities } from "@/lib/server/reports"

type WatchActivityRequest = {
  repos?: unknown
}

function normalizeRepoNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value
    .filter((repo): repo is string => typeof repo === "string")
    .map((repo) => repo.trim())
    .filter(Boolean)

  return [...new Set(normalized)].slice(0, WATCH_ACTIVITY_BATCH_SIZE)
}

export async function POST(request: Request) {
  let payload: WatchActivityRequest | null = null

  try {
    payload = (await request.json()) as WatchActivityRequest
  } catch {
    return NextResponse.json({ error: "Invalid watch activity payload." }, { status: 400 })
  }

  const fullNames = normalizeRepoNames(payload?.repos)

  if (fullNames.length === 0) {
    return NextResponse.json({ activities: {} })
  }

  try {
    const activities = await getRepoCacheActivities(fullNames)
    return NextResponse.json({ activities })
  } catch {
    return NextResponse.json({ error: "Could not load watch activity." }, { status: 500 })
  }
}
