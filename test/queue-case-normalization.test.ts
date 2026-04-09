import { beforeEach, describe, expect, mock, test } from "bun:test"

const queueModulePath = new URL("../src/server/queue.ts?queue-case-normalization-test", import.meta.url).href

type RedisState = {
  queued: string[]
  processing: string[]
  keys: Map<string, string>
}

function createRedisStub(state: RedisState) {
  return {
    isOpen: true,
    connect: async () => {},
    on: () => {},
    set: async (key: string, value: string, options?: { NX?: boolean }) => {
      if (options?.NX && state.keys.has(key)) {
        return null
      }

      state.keys.set(key, value)
      return "OK"
    },
    get: async (key: string) => state.keys.get(key) ?? null,
    lPush: async (key: string, value: string) => {
      const list = key.includes("processing") ? state.processing : state.queued
      list.unshift(value)
      return list.length
    },
    lLen: async (key: string) => (key.includes("processing") ? state.processing.length : state.queued.length),
    lRange: async (key: string) => (key.includes("processing") ? [...state.processing] : [...state.queued]),
    sendCommand: async (args: string[]) => {
      if (args[0] !== "BRPOPLPUSH") {
        return null
      }
      const queuedValue = state.queued.pop() ?? null
      if (queuedValue) {
        state.processing.unshift(queuedValue)
      }
      return queuedValue
    },
    multi: () => {
      const operations: Array<() => void> = []
      return {
        lRem(key: string, count: number, value: string) {
          operations.push(() => {
            const list = key.includes("processing") ? state.processing : state.queued
            if (count === 0) {
              for (let index = list.length - 1; index >= 0; index -= 1) {
                if (list[index] === value) {
                  list.splice(index, 1)
                }
              }
              return
            }

            let remaining = count
            for (let index = 0; index < list.length && remaining > 0; ) {
              if (list[index] === value) {
                list.splice(index, 1)
                remaining -= 1
              } else {
                index += 1
              }
            }
          })
          return this
        },
        del(key: string) {
          operations.push(() => {
            state.keys.delete(key)
          })
          return this
        },
        lPush(key: string, value: string) {
          operations.push(() => {
            const list = key.includes("processing") ? state.processing : state.queued
            list.unshift(value)
          })
          return this
        },
        async exec() {
          for (const operation of operations) {
            operation()
          }
          return []
        },
      }
    },
  }
}

const state: RedisState = {
  queued: [],
  processing: [],
  keys: new Map(),
}

mock.module("redis", () => ({
  createClient: () => createRedisStub(state),
}))

const { acknowledgeRepoJob, dropRepoJob, enqueueRepoJob, listQueuedRepoJobs, queueDedupeKey, requeueProcessingJob } = await import(queueModulePath)

beforeEach(() => {
  state.queued.length = 0
  state.processing.length = 0
  state.keys.clear()
  process.env.REDIS_URL = "redis://example.test:6379"
})

describe("queue case normalization", () => {
  test("listQueuedRepoJobs returns canonical lowercase names", async () => {
    state.queued = ["Schema-Labs-Ltd/DiscoFork"]
    state.processing = ["SCHEMA-LABS-LTD/Another-Repo"]

    await expect(listQueuedRepoJobs()).resolves.toEqual([
      "schema-labs-ltd/discofork",
      "schema-labs-ltd/another-repo",
    ])
  })

  test("enqueueRepoJob reuses a legacy mixed-case queued entry instead of queueing a duplicate", async () => {
    state.queued = ["Schema-Labs-Ltd/DiscoFork"]

    await expect(enqueueRepoJob("schema-labs-ltd/discofork")).resolves.toBe(false)
    expect(state.queued).toEqual(["Schema-Labs-Ltd/DiscoFork"])
    expect(state.keys.get(queueDedupeKey("schema-labs-ltd/discofork"))).toBe("1")
  })

  test("dropRepoJob removes a legacy mixed-case queued entry when called with the canonical name", async () => {
    state.queued = ["Schema-Labs-Ltd/DiscoFork"]
    state.processing = ["Schema-Labs-Ltd/DiscoFork"]
    state.keys.set(queueDedupeKey("Schema-Labs-Ltd/DiscoFork"), "1")

    await dropRepoJob("schema-labs-ltd/discofork")

    expect(state.queued).toEqual([])
    expect(state.processing).toEqual([])
    expect(state.keys.size).toBe(0)
  })

  test("acknowledgeRepoJob removes a legacy mixed-case processing entry when called with the canonical name", async () => {
    state.processing = ["Schema-Labs-Ltd/DiscoFork"]
    state.keys.set(queueDedupeKey("Schema-Labs-Ltd/DiscoFork"), "1")

    await acknowledgeRepoJob("schema-labs-ltd/discofork")

    expect(state.processing).toEqual([])
    expect(state.keys.size).toBe(0)
  })

  test("requeueProcessingJob requeues a legacy mixed-case processing entry under the canonical name", async () => {
    state.processing = ["Schema-Labs-Ltd/DiscoFork"]

    await requeueProcessingJob("schema-labs-ltd/discofork")

    expect(state.processing).toEqual([])
    expect(state.queued).toEqual(["schema-labs-ltd/discofork"])
  })
})
