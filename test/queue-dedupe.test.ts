import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const REPO_QUEUE_KEY = "discofork:repo-jobs"
const REPO_PROCESSING_QUEUE_KEY = "discofork:repo-jobs:processing"
const REPO_QUEUE_DEDUPE_PREFIX = "discofork:repo-job:"
const REPO_QUEUE_DEDUPE_TTL_SECONDS = 60 * 30

type SetOptions = {
  NX?: boolean
  EX?: number
}

const kvStore = new Map<string, string>()
const listStore = new Map<string, string[]>()
const setCalls: Array<{ key: string; value: string; options?: SetOptions }> = []
const lPushCalls: Array<{ key: string; value: string }> = []
const connectCalls: string[] = []
const createdTempDirs: string[] = []

const fakeRedis = {
  isOpen: false,
  on: () => undefined,
  connect: async () => {
    fakeRedis.isOpen = true
    connectCalls.push("connect")
  },
  set: async (key: string, value: string, options?: SetOptions) => {
    setCalls.push({ key, value, options })

    if (options?.NX && kvStore.has(key)) {
      return null
    }

    kvStore.set(key, value)
    return "OK"
  },
  lPush: async (key: string, value: string) => {
    lPushCalls.push({ key, value })
    const items = listStore.get(key) ?? []
    items.unshift(value)
    listStore.set(key, items)
    return items.length
  },
  sendCommand: async <T>(args: string[]): Promise<T> => {
    const command = args[0]
    const key = args[1]
    const value = args[2]

    if (!command || !key || !value) {
      throw new Error(`Malformed Redis command: ${args.join(" ")}`)
    }

    if (command === "LPOS") {
      const items = listStore.get(key) ?? []
      const index = items.indexOf(value)
      return (index === -1 ? null : index) as T
    }

    throw new Error(`Unexpected Redis command: ${args.join(" ")}`)
  },
}

mock.module("redis", () => ({
  createClient: () => fakeRedis as unknown,
}))

beforeEach(() => {
  process.env.REDIS_URL = "redis://example.test:6379"
  fakeRedis.isOpen = false
  kvStore.clear()
  listStore.clear()
  setCalls.length = 0
  lPushCalls.length = 0
  connectCalls.length = 0
})

afterEach(() => {
  delete process.env.REDIS_URL
  for (const tempDir of createdTempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

const targets = [
  {
    label: "src/server/queue.ts",
    kind: "direct" as const,
    path: "../src/server/queue.ts",
  },
  {
    label: "web/src/lib/server/queue.ts",
    kind: "copied" as const,
    path: "../web/src/lib/server/queue.ts",
    constantsPath: "../web/src/lib/server/constants.ts",
  },
]

function buildModuleUrl(target: (typeof targets)[number]): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  if (target.kind === "direct") {
    return new URL(`${target.path}?queue-dedupe-${unique}`, import.meta.url).href
  }

  const tempRoot = new URL("./.queue-dedupe-tmp/", import.meta.url)
  mkdirSync(tempRoot, { recursive: true })
  const tempDir = mkdtempSync(join(fileURLToPath(tempRoot), `discofork-queue-${unique}-`))
  createdTempDirs.push(tempDir)
  const queueSource = readFileSync(new URL(target.path, import.meta.url), "utf8")
  const constantsSource = readFileSync(new URL(target.constantsPath, import.meta.url), "utf8")
  writeFileSync(join(tempDir, "queue.ts"), queueSource)
  writeFileSync(join(tempDir, "constants.ts"), constantsSource)
  return `${pathToFileURL(join(tempDir, "queue.ts")).href}?queue-dedupe-${unique}`
}

function dedupeKey(fullName: string): string {
  return `${REPO_QUEUE_DEDUPE_PREFIX}${fullName}`
}

for (const target of targets) {
  describe(target.label, () => {
    test("queues a brand-new repo once with NX dedupe", async () => {
      const { enqueueRepoJob } = await import(buildModuleUrl(target)) as {
        enqueueRepoJob: (fullName: string) => Promise<boolean>
      }
      const fullName = "schema-labs-ltd/discofork"

      const queued = await enqueueRepoJob(fullName)

      expect(queued).toBe(true)
      expect(connectCalls).toEqual(["connect"])
      expect(setCalls).toEqual([
        {
          key: dedupeKey(fullName),
          value: "1",
          options: {
            NX: true,
            EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
          },
        },
      ])
      expect(lPushCalls).toEqual([{ key: REPO_QUEUE_KEY, value: fullName }])
      expect(listStore.get(REPO_QUEUE_KEY)).toEqual([fullName])
    })

    test("treats a queued repo as already tracked even when the dedupe key expired", async () => {
      const { enqueueRepoJob } = await import(buildModuleUrl(target)) as {
        enqueueRepoJob: (fullName: string) => Promise<boolean>
      }
      const fullName = "schema-labs-ltd/discofork"
      listStore.set(REPO_QUEUE_KEY, [fullName])

      const queued = await enqueueRepoJob(fullName)

      expect(queued).toBe(false)
      expect(lPushCalls).toEqual([])
      expect(listStore.get(REPO_QUEUE_KEY)).toEqual([fullName])
      expect(kvStore.get(dedupeKey(fullName))).toBe("1")
      expect(setCalls).toEqual([
        {
          key: dedupeKey(fullName),
          value: "1",
          options: {
            EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
          },
        },
      ])
    })

    test("treats a processing repo as already tracked even when the dedupe key expired", async () => {
      const { enqueueRepoJob } = await import(buildModuleUrl(target)) as {
        enqueueRepoJob: (fullName: string) => Promise<boolean>
      }
      const fullName = "schema-labs-ltd/discofork"
      listStore.set(REPO_PROCESSING_QUEUE_KEY, [fullName])

      const queued = await enqueueRepoJob(fullName)

      expect(queued).toBe(false)
      expect(lPushCalls).toEqual([])
      expect(listStore.get(REPO_PROCESSING_QUEUE_KEY)).toEqual([fullName])
      expect(kvStore.get(dedupeKey(fullName))).toBe("1")
      expect(setCalls).toEqual([
        {
          key: dedupeKey(fullName),
          value: "1",
          options: {
            EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
          },
        },
      ])
    })

    test("allows requeueing again after the tracked job is cleared", async () => {
      const { enqueueRepoJob } = await import(buildModuleUrl(target)) as {
        enqueueRepoJob: (fullName: string) => Promise<boolean>
      }
      const fullName = "schema-labs-ltd/discofork"
      listStore.set(REPO_PROCESSING_QUEUE_KEY, [fullName])

      const firstAttempt = await enqueueRepoJob(fullName)
      expect(firstAttempt).toBe(false)

      listStore.set(REPO_PROCESSING_QUEUE_KEY, [])
      kvStore.delete(dedupeKey(fullName))
      setCalls.length = 0
      lPushCalls.length = 0

      const secondAttempt = await enqueueRepoJob(fullName)

      expect(secondAttempt).toBe(true)
      expect(setCalls).toEqual([
        {
          key: dedupeKey(fullName),
          value: "1",
          options: {
            NX: true,
            EX: REPO_QUEUE_DEDUPE_TTL_SECONDS,
          },
        },
      ])
      expect(lPushCalls).toEqual([{ key: REPO_QUEUE_KEY, value: fullName }])
      expect(listStore.get(REPO_QUEUE_KEY)).toEqual([fullName])
    })
  })
}
