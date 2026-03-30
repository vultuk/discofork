import path from "node:path"

import { toErrorMessage } from "./core/errors.ts"
import { loadDiscovery, runAnalysis } from "./services/analysis.ts"
import { parseGitHubRepoInput } from "./services/github.ts"
import { writeRepoLiveStatus } from "./server/live-status.ts"
import { acknowledgeRepoJob, dequeueRepoJob, requeueProcessingJob } from "./server/queue.ts"
import { markRepoFailed, markRepoProcessing, markRepoQueued, markRepoReady } from "./server/reports.ts"

const workerOptions = {
  includeArchived: false,
  forkScanLimit: Number(process.env.DISCOFORK_FORK_SCAN_LIMIT ?? "25"),
  recommendedForkLimit: Number(process.env.DISCOFORK_RECOMMENDED_FORK_LIMIT ?? "6"),
  compareConcurrency: Number(process.env.DISCOFORK_COMPARE_CONCURRENCY ?? "3"),
}

const DEQUEUE_TIMEOUT_SECONDS = 5

let stopRequested = false
let currentJob: string | null = null
let shutdownRequested = false

async function processRepo(fullName: string): Promise<void> {
  const repo = parseGitHubRepoInput(fullName)
  await markRepoProcessing(repo.fullName)
  await writeRepoLiveStatus(repo.fullName, {
    status: "processing",
    phase: "discovery",
    detail: "Discovering upstream metadata and candidate forks",
    current: null,
    total: null,
  })

  const discovery = await loadDiscovery(
    repo,
    {
      includeArchived: workerOptions.includeArchived,
      forkScanLimit: workerOptions.forkScanLimit,
      recommendedForkLimit: workerOptions.recommendedForkLimit,
    },
    process.cwd(),
    `worker-discovery-${Date.now()}`,
  )

  const selectedForks =
    discovery.forks.filter((fork) => fork.defaultSelected).length > 0
      ? discovery.forks.filter((fork) => fork.defaultSelected)
      : discovery.forks.slice(0, Math.min(workerOptions.recommendedForkLimit, discovery.forks.length))

  await writeRepoLiveStatus(repo.fullName, {
    status: "processing",
    phase: "planning",
    detail: `Selected ${selectedForks.length} forks for analysis`,
    current: 0,
    total: Math.max(2, selectedForks.length + 2),
  })

  const result = await runAnalysis(
    repo,
    selectedForks,
    {
      includeArchived: workerOptions.includeArchived,
      forkScanLimit: workerOptions.forkScanLimit,
      recommendedForkLimit: workerOptions.recommendedForkLimit,
      compareConcurrency: workerOptions.compareConcurrency,
      selectedForks: selectedForks.map((fork) => fork.fullName),
      maxCommitSamples: 12,
      maxChangedFiles: 12,
      workspaceRoot: path.join(process.cwd(), ".discofork"),
      runId: `worker-${Date.now()}`,
    },
    process.cwd(),
    (event) => {
      if (event.type === "phase") {
        console.log(`[${repo.fullName}] ${event.phase}: ${event.detail}`)
      } else if (event.type === "fork") {
        console.log(`[${repo.fullName}] fork ${event.fork}: ${event.detail}`)
      } else if (event.type === "progress") {
        console.log(`[${repo.fullName}] ${event.phase}: ${event.detail} (${event.current}/${event.total})`)
      } else {
        console.log(`[${repo.fullName}] ${event.message}`)
      }

      if (event.type === "phase") {
        void writeRepoLiveStatus(repo.fullName, {
          status: "processing",
          phase: event.phase,
          detail: event.detail,
          current: null,
          total: null,
        })
      } else if (event.type === "fork") {
        void writeRepoLiveStatus(repo.fullName, {
          status: "processing",
          phase: "forks",
          detail: `${event.fork}: ${event.detail}`,
          current: null,
          total: null,
        })
      } else if (event.type === "progress") {
        void writeRepoLiveStatus(repo.fullName, {
          status: "processing",
          phase: event.phase,
          detail: event.detail,
          current: event.current,
          total: event.total,
        })
      } else if (event.type === "warning" || event.type === "error") {
        void writeRepoLiveStatus(repo.fullName, {
          status: "processing",
          phase: "warning",
          detail: event.message,
          current: null,
          total: null,
        })
      }
    },
  )

  await markRepoReady(result.report)
  await writeRepoLiveStatus(repo.fullName, {
    status: "ready",
    phase: "ready",
    detail: "Cached analysis is ready",
    current: 1,
    total: 1,
  })
}

async function main(): Promise<void> {
  console.log("Discofork worker started")

  while (!stopRequested) {
    const fullName = await dequeueRepoJob(DEQUEUE_TIMEOUT_SECONDS)
    if (!fullName) {
      continue
    }

    currentJob = fullName
    console.log(`Dequeued ${fullName}`)

    try {
      await processRepo(fullName)
      console.log(`Completed ${fullName}`)
    } catch (error) {
      const message = toErrorMessage(error)
      console.error(`Failed ${fullName}: ${message}`)
      await markRepoFailed(fullName, message)
      await writeRepoLiveStatus(fullName, {
        status: "failed",
        phase: "failed",
        detail: message,
        current: null,
        total: null,
      })
    } finally {
      currentJob = null
      await acknowledgeRepoJob(fullName)
    }
  }

  console.log("Discofork worker stopped accepting new jobs")
}

async function handleShutdown(signal: string): Promise<void> {
  if (shutdownRequested) {
    return
  }

  shutdownRequested = true
  stopRequested = true
  console.log(`Received ${signal}, preparing worker shutdown`)

  if (!currentJob) {
    return
  }

  try {
    console.log(`Requeueing in-flight job ${currentJob}`)
    await requeueProcessingJob(currentJob)
    await markRepoQueued(currentJob)
    await writeRepoLiveStatus(currentJob, {
      status: "queued",
      phase: "queued",
      detail: "Requeued after worker shutdown",
      current: null,
      total: null,
    })
    console.log(`Requeued ${currentJob}`)
  } catch (error) {
    console.error(`Failed to requeue ${currentJob}: ${toErrorMessage(error)}`)
  } finally {
    process.exit(0)
  }
}

process.on("SIGTERM", () => {
  void handleShutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void handleShutdown("SIGINT")
})

await main()
