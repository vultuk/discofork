import { databaseConfigured } from "@/lib/server/database"
import { enqueueRepoJob, queueConfigured } from "@/lib/server/queue"
import { listFailedRepoNames, markReposQueued } from "@/lib/server/reports"

export type RequeueFailedReposResult = {
  failedCount: number
  requeuedCount: number
}

export function getFailedRepoRequeueAvailabilityError(): { error: string; status: 503 } | null {
  if (!databaseConfigured()) {
    return { error: "DATABASE_URL is not configured.", status: 503 }
  }

  if (!queueConfigured()) {
    return { error: "REDIS_URL is not configured.", status: 503 }
  }

  return null
}

export async function requeueFailedRepos(): Promise<RequeueFailedReposResult> {
  const failedRepoNames = await listFailedRepoNames()
  if (failedRepoNames.length === 0) {
    return {
      failedCount: 0,
      requeuedCount: 0,
    }
  }

  const enqueueResults = await Promise.all(
    failedRepoNames.map(async (fullName) => ({
      fullName,
      queued: await enqueueRepoJob(fullName),
    })),
  )
  const requeuedNames = enqueueResults.filter((result) => result.queued).map((result) => result.fullName)

  await markReposQueued(requeuedNames)

  return {
    failedCount: failedRepoNames.length,
    requeuedCount: requeuedNames.length,
  }
}
