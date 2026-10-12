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

const cachedBrief = source.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "CachedRepositoryBrief",
)

if (!cachedBrief) {
  throw new Error("CachedRepositoryBrief was not found")
}

function findForkRow(node: ts.Node): ts.JsxElement | undefined {
  if (
    ts.isJsxElement(node) &&
    node.openingElement.tagName.getText(source) === "div" &&
    node.openingElement.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(source) === "key" &&
        attribute.initializer?.getText(source) === "{fork.fullName}",
    )
  ) {
    return node
  }

  for (const child of node.getChildren(source)) {
    const match = findForkRow(child)
    if (match) return match
  }
}

const forkRow = findForkRow(cachedBrief)

if (!forkRow) {
  throw new Error("CachedRepositoryBrief fork row was not found")
}

function findButtons(node: ts.Node): ts.JsxElement[] {
  const buttons: ts.JsxElement[] = []

  function visitButtons(current: ts.Node): void {
    if (ts.isJsxElement(current) && current.openingElement.tagName.getText(source) === "button") {
      buttons.push(current)
    }
    ts.forEachChild(current, visitButtons)
  }

  visitButtons(node)
  return buttons
}

function getAttribute(button: ts.JsxElement, name: string): ts.JsxAttribute | undefined {
  return button.openingElement.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(source) === name,
  )
}

function getAttributeSource(button: ts.JsxElement, name: string): string {
  return getAttribute(button, name)?.initializer?.getText(source) ?? ""
}

const forkRowButtons = findButtons(forkRow)
const selectionButton = forkRowButtons.find((button) =>
  getAttributeSource(button, "aria-label").includes("Select fork"),
)
const compareButton = forkRowButtons.find((button) =>
  getAttributeSource(button, "aria-label").includes("Add to comparison"),
)

if (!selectionButton || !compareButton) {
  throw new Error("Fork row selection and Compare controls were not found")
}

function createForkRowAction(button: ts.JsxElement, fullName: string, calls: string[]): () => void {
  const onClick = getAttribute(button, "onClick")
  if (!onClick?.initializer || !ts.isJsxExpression(onClick.initializer) || !onClick.initializer.expression) {
    throw new Error("Fork row action callback was not found")
  }

  const compiled = ts.transpileModule(`const callback = ${onClick.initializer.expression.getText(source)}`, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText

  return new Function(
    "fork",
    "navigateToFork",
    "toggleCompareFork",
    `${compiled}\nreturn callback`,
  )(
    { fullName },
    (forkName: string) => calls.push(`select:${forkName}`),
    (forkName: string) => calls.push(`compare:${forkName}`),
  ) as () => void
}

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

describe("cached repository fork row controls", () => {
  test("keeps selection and Compare as accessible, non-nested controls", () => {
    expect(forkRowButtons.length).toBe(2)
    expect(selectionButton.parent).toBe(forkRow)
    expect(getAttributeSource(selectionButton, "aria-pressed")).toBe("{active}")
    expect(getAttributeSource(selectionButton, "className")).toContain("focus-visible:ring-2")
    expect(getAttributeSource(compareButton, "className")).toContain("focus-visible:ring-2")

    for (const button of forkRowButtons) {
      let parent = button.parent
      while (parent && parent !== forkRow) {
        expect(ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) === "button").toBe(false)
        parent = parent.parent
      }
    }
  })

  test("selection and Compare dispatch their own fork action", () => {
    const calls: string[] = []
    const fullName = "openai/codex"

    createForkRowAction(selectionButton, fullName, calls)()
    createForkRowAction(compareButton, fullName, calls)()

    expect(calls).toEqual([`select:${fullName}`, `compare:${fullName}`])
  })
})
