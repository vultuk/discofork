import { writeRepoLiveStatus } from "../server/live-status.ts"
import { recoverProcessingRepoJobs } from "../server/queue.ts"
import { markRepoQueued } from "../server/reports.ts"

const STARTUP_RECOVERY_DETAIL = "Requeued after worker startup recovery"

export async function recoverInterruptedProcessingJobs(): Promise<string[]> {
  const recoveredJobs = await recoverProcessingRepoJobs()
  const recoveredRepos = Array.from(new Set(recoveredJobs))

  for (const fullName of recoveredRepos) {
    await markRepoQueued(fullName)
    await writeRepoLiveStatus(fullName, {
      status: "queued",
      phase: "queued",
      detail: STARTUP_RECOVERY_DETAIL,
      current: null,
      total: null,
    })
  }

  return recoveredRepos
}
