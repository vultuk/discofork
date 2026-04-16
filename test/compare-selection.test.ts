import { describe, expect, test } from "bun:test"

import {
  MAX_COMPARE_REPOS,
  addCompareSelectionRepo,
  applyCompareRepoInput,
  normalizeCompareSelection,
  parseCompareSelectionValue,
  removeCompareSelectionRepo,
  replaceCompareSelectionRepo,
} from "../web/src/lib/compare-selection"

describe("compare selection helpers", () => {
  test("normalizeCompareSelection trims, deduplicates, and caps the selection", () => {
    expect(
      normalizeCompareSelection([
        " vultuk/discofork ",
        "openai/codex",
        "vultuk/discofork",
        "schema-labs-ltd/discofork",
        "extra/repo",
      ]),
    ).toEqual(["vultuk/discofork", "openai/codex", "schema-labs-ltd/discofork"])
    expect(normalizeCompareSelection(["", "   "])).toEqual([])
    expect(normalizeCompareSelection(["one/two", "three/four", "five/six"]).length).toBe(MAX_COMPARE_REPOS)
  })

  test("parseCompareSelectionValue preserves shareable compare URL ordering", () => {
    expect(parseCompareSelectionValue("vultuk/discofork,openai/codex,schema-labs-ltd/discofork")).toEqual([
      "vultuk/discofork",
      "openai/codex",
      "schema-labs-ltd/discofork",
    ])
    expect(parseCompareSelectionValue("vultuk/discofork,,openai/codex")).toEqual([
      "vultuk/discofork",
      "openai/codex",
    ])
    expect(parseCompareSelectionValue(null)).toEqual([])
  })

  test("addCompareSelectionRepo appends only when room is available", () => {
    const initial = ["vultuk/discofork"]
    expect(addCompareSelectionRepo(initial, "openai/codex")).toEqual(["vultuk/discofork", "openai/codex"])
    expect(addCompareSelectionRepo(initial, "vultuk/discofork")).toEqual(initial)
    expect(addCompareSelectionRepo(["a/b", "c/d", "e/f"], "g/h")).toEqual(["a/b", "c/d", "e/f"])
  })

  test("removeCompareSelectionRepo keeps the remaining compare order", () => {
    expect(removeCompareSelectionRepo(["a/b", "c/d", "e/f"], "c/d")).toEqual(["a/b", "e/f"])
    expect(removeCompareSelectionRepo(["a/b", "c/d"], "missing/repo")).toEqual(["a/b", "c/d"])
  })

  test("replaceCompareSelectionRepo swaps in place and respects the compare cap", () => {
    expect(replaceCompareSelectionRepo(["a/b", "c/d", "e/f"], "c/d", "g/h")).toEqual(["a/b", "g/h", "e/f"])
    expect(replaceCompareSelectionRepo(["a/b", "c/d", "e/f"], "c/d", "a/b")).toEqual(["a/b", "e/f"])
    expect(replaceCompareSelectionRepo(["a/b", "c/d"], null, "e/f")).toEqual(["a/b", "c/d", "e/f"])
    expect(replaceCompareSelectionRepo(["a/b", "c/d", "e/f"], null, "g/h")).toEqual(["a/b", "c/d", "e/f"])
  })

  test("applyCompareRepoInput adds owner repo input to the next open slot", () => {
    expect(applyCompareRepoInput(["schema-labs-ltd/discofork"], "openai/codex")).toEqual({
      kind: "added",
      fullName: "openai/codex",
      message: "Added openai/codex to compare. Cached comparison data will appear here when available.",
      nextSelection: ["schema-labs-ltd/discofork", "openai/codex"],
    })
  })

  test("applyCompareRepoInput normalizes GitHub and Discofork URLs into the same compare selection", () => {
    expect(applyCompareRepoInput([], "https://github.com/openai/codex").nextSelection).toEqual(["openai/codex"])
    expect(applyCompareRepoInput([], "https://discofork.ai/openai/codex").nextSelection).toEqual(["openai/codex"])
  })

  test("applyCompareRepoInput replaces the selected slot when compare is full", () => {
    expect(applyCompareRepoInput(["a/b", "c/d", "e/f"], "https://github.com/openai/codex", "c/d")).toEqual({
      kind: "replaced",
      fullName: "openai/codex",
      message: "Replaced c/d with openai/codex. Cached comparison data will appear here when available.",
      nextSelection: ["a/b", "openai/codex", "e/f"],
    })
  })

  test("applyCompareRepoInput ignores stale replace targets that are no longer selected", () => {
    expect(applyCompareRepoInput(["a/b", "c/d", "e/f"], "openai/codex", "missing/repo")).toEqual({
      kind: "error",
      fullName: null,
      message: "Compare is full. Click Replace on a selected repo, then paste a repository here.",
      nextSelection: ["a/b", "c/d", "e/f"],
    })
  })

  test("applyCompareRepoInput does not replace a slot with a repo that is already selected elsewhere", () => {
    expect(applyCompareRepoInput(["a/b", "c/d", "e/f"], "a/b", "c/d")).toEqual({
      kind: "unchanged",
      fullName: "a/b",
      message: "a/b is already selected in another compare slot.",
      nextSelection: ["a/b", "c/d", "e/f"],
    })
  })

  test("applyCompareRepoInput requires a replace target when compare is already full", () => {
    expect(applyCompareRepoInput(["a/b", "c/d", "e/f"], "openai/codex")).toEqual({
      kind: "error",
      fullName: null,
      message: "Compare is full. Click Replace on a selected repo, then paste a repository here.",
      nextSelection: ["a/b", "c/d", "e/f"],
    })
  })
})
