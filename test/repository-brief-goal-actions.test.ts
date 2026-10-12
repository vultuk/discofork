import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import * as ts from "typescript"

type Goal = { fork: { fullName: string } | null }
type Action = "onOpen" | "onCompare"

const source = ts.createSourceFile(
  "repository-brief.tsx",
  readFileSync(new URL("../web/src/components/repository-brief.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

const card = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "VisitorGoalCard",
)

if (!card) {
  throw new Error("VisitorGoalCard was not found")
}

const callbackSources = new Map<Action, string>()

function visit(node: ts.Node): void {
  if (
    ts.isJsxAttribute(node) &&
    node.name.getText(source) === "onClick" &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression &&
    ts.isArrowFunction(node.initializer.expression)
  ) {
    const callback = node.initializer.expression.getText(source)
    for (const action of ["onOpen", "onCompare"] as const) {
      if (callback.includes(`${action}(`)) {
        callbackSources.set(action, callback)
      }
    }
  }

  ts.forEachChild(node, visit)
}

visit(card)

function createAction(action: Action, goal: Goal, calls: string[]): () => void {
  const callback = callbackSources.get(action)
  if (!callback) {
    throw new Error(`${action} callback was not found`)
  }

  const compiled = ts.transpileModule(`const callback = ${callback}`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText
  const record = (fullName: string) => calls.push(fullName)

  return new Function(
    "goal",
    "onOpen",
    "onCompare",
    `${compiled}\nreturn callback`,
  )(
    goal,
    action === "onOpen" ? record : () => { throw new Error("Unexpected Open dispatch") },
    action === "onCompare" ? record : () => { throw new Error("Unexpected Compare dispatch") },
  ) as () => void
}

describe("repository brief goal callbacks", () => {
  for (const action of ["onOpen", "onCompare"] as const) {
    test(`${action} preserves the selected fork when it exists`, () => {
      const calls: string[] = []
      const callback = createAction(action, { fork: { fullName: "openai/codex" } }, calls)

      callback()

      expect(calls).toEqual(["openai/codex"])
    })

    test(`${action} safely handles a fork becoming null before the click`, () => {
      const goal: Goal = { fork: { fullName: "openai/codex" } }
      const calls: string[] = []
      const callback = createAction(action, goal, calls)

      goal.fork = null

      expect(callback).not.toThrow()
      expect(calls).toEqual([])
    })
  }
})
