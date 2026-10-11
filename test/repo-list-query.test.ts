import { describe, expect, test } from "bun:test"

import {
  buildRepoListHref,
  normalizeRepoListQuery,
  parseRepoListOrder,
  parseRepoListPage,
  parseRepoListStatusFilter,
} from "../web/src/lib/repository-list-query"

describe("repository list query helpers", () => {
  test("normalizes page, order, status, and query values", () => {
    expect(parseRepoListPage("4")).toBe(4)
    expect(parseRepoListPage("0")).toBe(1)
    expect(parseRepoListOrder("forks")).toBe("forks")
    expect(parseRepoListOrder("pushed")).toBe("pushed")
    expect(parseRepoListOrder("bogus")).toBe("updated")
    expect(parseRepoListStatusFilter("failed")).toBe("failed")
    expect(parseRepoListStatusFilter("bogus")).toBe("all")
    expect(normalizeRepoListQuery("  codex  ")).toBe("codex")
  })

  test("builds query-preserving /repos hrefs", () => {
    expect(buildRepoListHref(4, "forks", "failed", "codex")).toBe("/repos?page=4&order=forks&status=failed&query=codex")
    expect(buildRepoListHref(1, "updated", "all", "")).toBe("/repos?order=updated&status=all")
  })
})
