"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { authorizeAdminRequest } from "@/lib/server/admin-auth"
import { getFailedRepoRequeueAvailabilityError, requeueFailedRepos } from "@/lib/server/admin-operations"

export type RequeueFailedReposActionResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

export async function requeueFailedReposAction(): Promise<RequeueFailedReposActionResult> {
  const authResult = authorizeAdminRequest(await headers())
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
