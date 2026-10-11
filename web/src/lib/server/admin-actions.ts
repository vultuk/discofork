"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { authorizeAdminRequest, DISCOFORK_ADMIN_TOKEN_HEADER } from "@/lib/server/admin-auth"
import { getFailedRepoRequeueAvailabilityError, requeueFailedRepos } from "@/lib/server/admin-operations"

export type RequeueFailedReposActionResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

export async function requeueFailedReposAction(adminToken?: string): Promise<RequeueFailedReposActionResult> {
  let requestHeaders: Headers
  if (adminToken === undefined) {
    requestHeaders = new Headers(await headers())
  } else {
    // The browser presents the operator's existing token for this invocation.
    // Never substitute the server's configured token for an anonymous caller.
    requestHeaders = new Headers()
    try {
      if (typeof adminToken !== "string") {
        return { ok: false, error: "Invalid admin credentials." }
      }
      requestHeaders.set(DISCOFORK_ADMIN_TOKEN_HEADER, adminToken)
    } catch {
      return { ok: false, error: "Invalid admin credentials." }
    }
  }
  const authResult = authorizeAdminRequest(requestHeaders)
  if (!authResult.ok) {
    return { ok: false, error: authResult.error }
  }

  const availabilityError = getFailedRepoRequeueAvailabilityError()
  if (availabilityError) {
    return {
      ok: false,
      error: availabilityError.error,
    }
  }

  try {
    await requeueFailedRepos()
    revalidatePath("/stats")
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: "Could not requeue failed jobs.",
    }
  }
}
