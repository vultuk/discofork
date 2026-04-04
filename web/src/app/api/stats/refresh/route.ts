import { NextRequest, NextResponse } from "next/server"

import { authorizeAdminRequest } from "@/lib/server/admin-auth"
import { queueConfigured } from "@/lib/server/queue"
import { refreshStatsSnapshot } from "@/lib/server/stats"

async function handleRefresh(request: NextRequest) {
  const authResult = authorizeAdminRequest(request.headers)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  if (!queueConfigured()) {
    return NextResponse.json({ error: "REDIS_URL is not configured." }, { status: 503 })
  }

  const snapshot = await refreshStatsSnapshot()
  return NextResponse.json({
    ok: true,
    generatedAt: snapshot.generatedAt,
  })
}

export async function GET(request: NextRequest) {
  return handleRefresh(request)
}

export async function POST(request: NextRequest) {
  return handleRefresh(request)
}
