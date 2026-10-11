import { describe, expect, test } from "bun:test"

import { createLatestRequestGuard } from "../web/src/lib/latest-request-guard"

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return {
    promise,
    resolve,
  }
}

describe("command palette latest-request guard", () => {
  test("only the newest overlapping search response can apply results", async () => {
    const guard = createLatestRequestGuard()
    const applied: string[] = []

    const firstResponse = createDeferred<string>()
    const firstRequest = guard.begin()
    const firstTask = firstResponse.promise.then((value) => {
      if (firstRequest.isCurrent()) {
        applied.push(value)
      }
    })

    const secondResponse = createDeferred<string>()
    const secondRequest = guard.begin()
    const secondTask = secondResponse.promise.then((value) => {
      if (secondRequest.isCurrent()) {
        applied.push(value)
      }
    })

    secondResponse.resolve("newer")
    firstResponse.resolve("older")
    await Promise.all([firstTask, secondTask])

    expect(applied).toEqual(["newer"])
    expect(firstRequest.isAborted()).toBe(true)
    expect(firstRequest.isCurrent()).toBe(false)
    expect(secondRequest.isAborted()).toBe(false)
    expect(secondRequest.isCurrent()).toBe(true)
  })

  test("invalidate aborts the active request so cleared or changed queries ignore late results", async () => {
    const guard = createLatestRequestGuard()
    const applied: string[] = []

    const response = createDeferred<string>()
    const request = guard.begin()
    const task = response.promise.then((value) => {
      if (request.isCurrent()) {
        applied.push(value)
      }
    })

    guard.invalidate()
    response.resolve("stale")
    await task

    expect(applied).toEqual([])
    expect(request.isAborted()).toBe(true)
    expect(request.isCurrent()).toBe(false)
  })
})
