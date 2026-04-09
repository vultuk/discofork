import { beforeEach, describe, expect, mock, test } from "bun:test"

const liveStatusModulePath = new URL("../src/server/live-status.ts", import.meta.url).href
const queueModulePath = new URL("../src/server/queue.ts", import.meta.url).href
const reportsModulePath = new URL("../src/server/reports.ts", import.meta.url).href
const workerStartupModulePath = new URL("../src/services/worker-startup.ts?worker-startup-test", import.meta.url).href

const recoveredJobs: string[][] = []
const markedQueued: string[] = []
const liveStatusWrites: Array<{ fullName: string; payload: Record<string, unknown> }> = []

let queuedJobsToRecover: string[] = []

mock.module(queueModulePath, () => ({
  recoverProcessingRepoJobs: async () => {
    recoveredJobs.push([...queuedJobsToRecover])
    return [...queuedJobsToRecover]
  },
}))

mock.module(reportsModulePath, () => ({
  markRepoQueued: async (fullName: string) => {
    markedQueued.push(fullName)
  },
}))

mock.module(liveStatusModulePath, () => ({
  writeRepoLiveStatus: async (fullName: string, payload: Record<string, unknown>) => {
    liveStatusWrites.push({ fullName, payload })
  },
}))

const { recoverInterruptedProcessingJobs } = await import(workerStartupModulePath)

beforeEach(() => {
  queuedJobsToRecover = []
  recoveredJobs.length = 0
  markedQueued.length = 0
  liveStatusWrites.length = 0
})

describe("recoverInterruptedProcessingJobs", () => {
  test("restores queued repo status and live status for each recovered repo once", async () => {
    queuedJobsToRecover = [
      "schema-labs-ltd/discofork",
      "schema-labs-ltd/discofork",
      "schema-labs-ltd/worker",
    ]

    const recovered = await recoverInterruptedProcessingJobs()

    expect(recoveredJobs).toEqual([["schema-labs-ltd/discofork", "schema-labs-ltd/discofork", "schema-labs-ltd/worker"]])
    expect(recovered).toEqual(["schema-labs-ltd/discofork", "schema-labs-ltd/worker"])
    expect(markedQueued).toEqual(["schema-labs-ltd/discofork", "schema-labs-ltd/worker"])
    expect(liveStatusWrites).toEqual([
      {
        fullName: "schema-labs-ltd/discofork",
        payload: {
          status: "queued",
          phase: "queued",
          detail: "Requeued after worker startup recovery",
          current: null,
          total: null,
        },
      },
      {
        fullName: "schema-labs-ltd/worker",
        payload: {
          status: "queued",
          phase: "queued",
          detail: "Requeued after worker startup recovery",
          current: null,
          total: null,
        },
      },
    ])
  })

  test("does nothing when startup recovery finds no interrupted jobs", async () => {
    const recovered = await recoverInterruptedProcessingJobs()

    expect(recovered).toEqual([])
    expect(markedQueued).toEqual([])
    expect(liveStatusWrites).toEqual([])
  })
})
