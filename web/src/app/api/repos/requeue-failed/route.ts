import { NextRequest, NextResponse } from "next/server"

import { authorizeAdminRequest } from "@/lib/server/admin-auth"
import { getFailedRepoRequeueAvailabilityError, requeueFailedRepos } from "@/lib/server/admin-operations"

export async function POST(request: NextRequest) {
  const authResult = authorizeAdminRequest(request.headers)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const availabilityError = getFailedRepoRequeueAvailabilityError()
  if (availabilityError) {
    return NextResponse.json({ error: availabilityError.error }, { status: availabilityError.status })
  }

  return NextResponse.json(await requeueFailedRepos())
}
