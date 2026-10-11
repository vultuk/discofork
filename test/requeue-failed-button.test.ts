import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { expect, test } from "bun:test"

function exerciseButton(options: { confirmed?: boolean; failedCount?: number; queueEnabled?: boolean; result?: { ok: boolean; error?: string } } = {}) {
  const script = `
    import assert from "node:assert/strict"
    import { mock } from "bun:test"
    const React = await import("react")
    const input = { value: "test-operator-token" }
    const states = []
    const calls = []
    let refreshes = 0
    mock.module("react", () => ({ ...React, useId: () => "token-input", useRef: () => ({current:input}),
      useState: initial => [initial, next => states.push(next)], startTransition: action => action() }))
    mock.module("next/navigation", () => ({ useRouter: () => ({ refresh: () => refreshes++ }) }))
    mock.module("@/components/ui/button", () => ({ Button: "button" }))
    mock.module("@/lib/server/admin-actions", () => ({ requeueFailedReposAction: async token => {
      assert.equal(input.value, "", "input must clear before invocation")
      assert.equal(token, "test-operator-token")
      calls.push("authorised-invocation")
      return ${JSON.stringify(options.result ?? { ok: true })}
    } }))
    globalThis.window = { confirm: () => ${options.confirmed ?? true} }
    Object.defineProperty(globalThis, "localStorage", { get: () => { throw new Error("token must not be stored") } })
    const { RequeueFailedButton } = await import("./src/components/requeue-failed-button.tsx")
    const tree = RequeueFailedButton({failedCount:${options.failedCount ?? 2},queueEnabled:${options.queueEnabled ?? true}})
    function elements(node) {
      if (!node || typeof node !== "object") return []
      const children = node.props?.children
      return [node, ...(Array.isArray(children) ? children : [children]).flatMap(elements)]
    }
    const nodes = elements(tree)
    const password = nodes.find(node => node.type === "input")
    assert.equal(password.props.type, "password")
    assert.equal(password.props.autoComplete, "off")
    const button = nodes.find(node => node.type === "button")
    await button.props.onClick()
    console.log(JSON.stringify({calls,refreshes,states,cleared:input.value === "",disabled:button.props.disabled}))
  `
  const result = spawnSync(process.execPath, ["-e", script], { cwd: join(process.cwd(), "web"), encoding: "utf8", timeout: 5000 })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  expect(result.stdout).not.toContain("test-operator-token")
  return JSON.parse(result.stdout)
}

test("operator button passes the existing token once, clears before awaiting, and refreshes on success", () => {
  expect(exerciseButton()).toEqual({ calls: ["authorised-invocation"], refreshes: 1, states: [true, null, false], cleared: true, disabled: false })
})

test("rejected invocation leaves the input cleared and displays a safe error without refresh", () => {
  expect(exerciseButton({ result: { ok: false, error: "Invalid admin credentials." } })).toEqual({ calls: ["authorised-invocation"], refreshes: 0, states: [true, null, "Invalid admin credentials.", false], cleared: true, disabled: false })
})

test("cancelling confirmation does not submit the credential", () => {
  expect(exerciseButton({ confirmed: false }).calls).toEqual([])
})

test("disabled queue/no-failure buttons do not invoke the action", () => {
  for (const options of [{ queueEnabled: false }, { failedCount: 0 }]) {
    const result = exerciseButton(options)
    expect(result.disabled).toBe(true)
    expect(result.calls).toEqual([])
  }
})
