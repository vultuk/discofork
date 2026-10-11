import { spawnSync } from "node:child_process"
import { describe, expect, test } from "bun:test"

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
      if (args[0] === "LPOS") {
        const list = args[1]?.includes("processing") ? state.processing : state.queued
        const index = list.indexOf(args[2]!)
        return index < 0 ? null : index
      }
      if (args[0] === "EVAL") {
        const key = args[3]!
        if (state.keys.has(key)) return 0
        state.keys.set(key, "1")
        state.queued.unshift(args[5]!)
        return 1
      }
      if (args[0] !== "BRPOPLPUSH") {
        throw new Error(`Unexpected command: ${args[0]}`)
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

function runScenario(scenario: string, web = false) {
  const modulePath = `${process.cwd()}/${web ? "web/src/lib/server/queue.ts" : "src/server/queue.ts"}`
  const result = spawnSync(process.execPath, ["-e", `
    import { mock } from "bun:test"
    const state = { queued: [], processing: [], keys: new Map() }
    const createRedisStub = ${createRedisStub.toString()}
    mock.module(Bun.resolveSync("redis", ${JSON.stringify(modulePath.slice(0, modulePath.lastIndexOf("/")))}), () => ({ createClient: () => createRedisStub(state) }))
    process.env.REDIS_URL = "redis://example.test:6379"
    const queue = await import(${JSON.stringify(modulePath)})
    let result
    ${scenario}
    console.log(JSON.stringify({ result, queued: state.queued, processing: state.processing, keys: Object.fromEntries(state.keys) }))
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 5000 })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout)
}

describe("queue case normalization", () => {
  test("listQueuedRepoJobs returns canonical lowercase names", () => {
    expect(runScenario(`
      state.queued = ["Schema-Labs-Ltd/DiscoFork"]
      state.processing = ["SCHEMA-LABS-LTD/Another-Repo"]
      result = await queue.listQueuedRepoJobs()
    `).result).toEqual(["schema-labs-ltd/discofork", "schema-labs-ltd/another-repo"])
  })

  for (const web of [false, true]) {
    test(`${web ? "web" : "worker"} mixed-case new requests create one canonical job`, () => {
      const result = runScenario(`result = await Promise.all([
        queue.enqueueRepoJob("Schema-Labs-Ltd/DiscoFork"), queue.enqueueRepoJob("SCHEMA-LABS-LTD/DISCOFORK")
      ])`, web)
      expect(result.result.filter(Boolean)).toHaveLength(1)
      expect(result.queued).toEqual(["schema-labs-ltd/discofork"])
    })

    for (const list of ["queued", "processing"]) {
      test(`${web ? "web" : "worker"} reuses a legacy mixed-case ${list} entry`, () => {
        const result = runScenario(`state.${list} = ["Schema-Labs-Ltd/DiscoFork"];
          result = await queue.enqueueRepoJob("schema-labs-ltd/discofork")`, web)
        expect(result.result).toBe(false)
        expect(result[list]).toEqual(["Schema-Labs-Ltd/DiscoFork"])
        expect(result.keys["discofork:repo-job:schema-labs-ltd/discofork"]).toBe("1")
      })
    }
  }

  test("drop removes legacy mixed-case entries and both dedupe spellings", () => {
    const result = runScenario(`
      state.queued = ["Schema-Labs-Ltd/DiscoFork"]
      state.processing = ["Schema-Labs-Ltd/DiscoFork"]
      state.keys.set("discofork:repo-job:Schema-Labs-Ltd/DiscoFork", "1")
      state.keys.set(queue.queueDedupeKey("Schema-Labs-Ltd/DiscoFork"), "1")
      await queue.dropRepoJob("schema-labs-ltd/discofork")
    `)
    expect(result.queued).toEqual([])
    expect(result.processing).toEqual([])
    expect(result.keys).toEqual({})
  })

  test("acknowledge removes legacy mixed-case processing and dedupe keys", () => {
    const result = runScenario(`
      state.processing = ["Schema-Labs-Ltd/DiscoFork"]
      state.keys.set("discofork:repo-job:Schema-Labs-Ltd/DiscoFork", "1")
      await queue.acknowledgeRepoJob("schema-labs-ltd/discofork")
    `)
    expect(result.processing).toEqual([])
    expect(result.keys).toEqual({})
  })

  test("requeue moves a legacy processing entry under the canonical name", () => {
    const result = runScenario(`state.processing = ["Schema-Labs-Ltd/DiscoFork"];
      await queue.requeueProcessingJob("schema-labs-ltd/discofork")`)
    expect(result.processing).toEqual([])
    expect(result.queued).toEqual(["schema-labs-ltd/discofork"])
  })
})
