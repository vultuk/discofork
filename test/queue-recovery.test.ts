import { spawnSync } from "node:child_process"
import { describe, expect, test } from "bun:test"

// Real Lua semantics are tested against an explicitly supplied disposable
// loopback Redis. Default unit runs report these integrations as skipped.
const redisUrl = process.env.DISCOFORK_TEST_REDIS_URL
const root = process.cwd()

function runScenario(body: string, realRedis = false) {
  const script = `
    import assert from "node:assert/strict"
    const queue = await import(${JSON.stringify(root + "/src/server/queue.ts")})
    const constants = await import(${JSON.stringify(root + "/src/server/constants.ts")})
    const { REPO_QUEUE_KEY:q, REPO_PROCESSING_QUEUE_KEY:p, REPO_QUEUE_DEDUPE_PREFIX:d, REPO_QUEUE_DEDUPE_TTL_SECONDS:ttl } = constants
    ${realRedis ? `
      const url = ${JSON.stringify(redisUrl)}
      const parsedUrl = new URL(url)
      assert.equal(parsedUrl.protocol, "redis:")
      assert.equal(parsedUrl.hostname, "127.0.0.1")
      assert.ok(parsedUrl.port)
      assert.equal(parsedUrl.pathname, "")
      assert.equal(parsedUrl.username, "")
      assert.equal(parsedUrl.password, "")
      process.env.REDIS_URL = url
      const { createClient } = await import("redis")
      const client = createClient({url})
      await client.connect()
      await client.flushDb()
    ` : ""}
    try { ${body} } finally { ${realRedis ? "await client.quit()" : ""} }
    console.log("PASS")
  `
  const result = spawnSync(process.execPath, ["-e", script], { cwd: root, encoding: "utf8", timeout: 5000 })
  expect(result.stderr).toBe("")
  expect(result.status).toBe(0)
  expect(result.stdout.trim()).toBe("PASS")
}

describe("recoverProcessingRepoJobsWithClient", () => {
  test("uses one atomic Redis operation and returns canonical recovery results", () => {
    runScenario(`
      const calls = []
      const result = await queue.recoverProcessingRepoJobsWithClient({sendCommand: async args => {calls.push(args);return ["org/repo"]}})
      assert.deepEqual(result,["org/repo"])
      assert.equal(calls.length,1)
      assert.equal(calls[0][0],"EVAL")
      assert.deepEqual(calls[0].slice(2),["2",q,p,d,String(ttl)])
    `)
  })

  test("propagates Redis failure instead of reporting successful recovery", () => {
    runScenario(`await assert.rejects(queue.recoverProcessingRepoJobsWithClient({sendCommand:async()=>{throw Error("redis unavailable")}}), /redis unavailable/)`)
  })

  test.skipIf(!redisUrl)("real Redis recovers unique case identities and refreshes their dedupe TTL", () => {
    runScenario(`
      await client.lPush(q,"newer/job")
      await client.rPush(p,["Org/Repo-B","org/repo-a","ORG/REPO-B"])
      assert.deepEqual(await queue.recoverProcessingRepoJobsWithClient(client),["org/repo-b","org/repo-a"])
      assert.deepEqual(await client.lRange(q,0,-1),["newer/job","org/repo-b","org/repo-a"])
      assert.equal(await client.lLen(p),0)
      assert.equal(await client.get(d+"org/repo-b"),"1")
      assert.ok((await client.ttl(d+"org/repo-b"))>=ttl-1)
    `, true)
  })

  test.skipIf(!redisUrl)("real Redis no-op leaves queued work untouched when processing is empty", () => {
    runScenario(`
      await client.lPush(q,"Org/Retained")
      assert.deepEqual(await queue.recoverProcessingRepoJobsWithClient(client),[])
      assert.deepEqual(await client.lRange(q,0,-1),["Org/Retained"])
    `, true)
  })

  test.skipIf(!redisUrl)("real Redis removes queued/processing case duplicates while preserving oldest queue positions", () => {
    runScenario(`
      await client.rPush(q,["Org/Repo","other/newer","ORG/REPO","oldest/retained"])
      await client.rPush(p,["org/repo","Recover/Only","RECOVER/ONLY"])
      await client.set(d+"Org/Repo","1")
      await client.set(d+"RECOVER/ONLY","1")
      assert.deepEqual(await queue.recoverProcessingRepoJobsWithClient(client),["org/repo","recover/only"])
      assert.deepEqual(await client.lRange(q,0,-1),["other/newer","org/repo","oldest/retained","recover/only"])
      assert.equal(await client.lLen(p),0)
      assert.equal(await client.exists(d+"Org/Repo"),0)
      assert.equal(await client.exists(d+"RECOVER/ONLY"),0)
    `, true)
  })

  test.skipIf(!redisUrl)("real Redis concurrent recovery and enqueue retain one logical job", () => {
    runScenario(`
      await client.lPush(q,"Org/Repo")
      await client.lPush(p,"ORG/REPO")
      const web = await import(${JSON.stringify(root + "/web/src/lib/server/queue.ts")})
      await Promise.all([
        queue.recoverProcessingRepoJobsWithClient(client),
        queue.recoverProcessingRepoJobsWithClient(client),
        web.enqueueRepoJob("org/repo"),
      ])
      assert.deepEqual(await client.lRange(q,0,-1),["org/repo"])
      assert.equal(await client.lLen(p),0)
      await (await web.getRedisClient()).quit()
    `, true)
  })
})
