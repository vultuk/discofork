"use server"

import { revalidatePath } from "next/cache"

import { getFailedRepoRequeueAvailabilityError, requeueFailedRepos } from "@/lib/server/admin-operations"

export type RequeueFailedReposActionResult =
  | { ok: true }
  | {
      ok: false
      error: string
    }

export async function requeueFailedReposAction(): Promise<RequeueFailedReposActionResult> {
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
  } catch (caughtError) {
    return {
      ok: false,
      error: caughtError instanceof Error ? caughtError.message : "Could not requeue failed jobs.",
    }
  }
}
