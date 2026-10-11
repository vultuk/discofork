import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

import {
  SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE,
  describeSuspiciousRepositoryRoute,
  isSuspiciousRepositoryRoute,
} from "../web/src/lib/repository-route-validation"

describe("repository route validation", () => {
  test("rejects obvious path-probe routes", () => {
    expect(describeSuspiciousRepositoryRoute("admin", ".env")).toContain("known web probe route")
    expect(describeSuspiciousRepositoryRoute(".well-known", "nodeinfo")).toContain("hidden-path prefix")
    expect(describeSuspiciousRepositoryRoute("owner%2Fslash", "repo")).toContain("URL-encoded path characters")
    expect(describeSuspiciousRepositoryRoute("owner/repo", "child")).toContain("path separators")
    expect(describeSuspiciousRepositoryRoute("owner..dots", "repo")).toContain("path traversal markers")
    expect(isSuspiciousRepositoryRoute("admin", ".env")).toBe(true)
  })

  test("allows legitimate repository routes with dotted names", () => {
    expect(describeSuspiciousRepositoryRoute("openai", "codex")).toBeNull()
    expect(describeSuspiciousRepositoryRoute("safe-owner", "nodeinfo")).toBeNull()
    expect(describeSuspiciousRepositoryRoute("github", ".github")).toBeNull()
    expect(describeSuspiciousRepositoryRoute("vercel", "next.js")).toBeNull()
    expect(isSuspiciousRepositoryRoute("schema-labs-ltd", "discofork")).toBe(false)
  })

  test("uses the web-local suspicious pattern module alias", () => {
    const source = readFileSync(new URL("../web/src/lib/repository-route-validation.ts", import.meta.url), "utf8")

    expect(source).toContain('from "@/core/suspicious-repo-patterns"')
    expect(source).not.toContain('from "../../../src/core/suspicious-repo-patterns"')
  })

  test("exports a SQL predicate for filtering suspicious stored rows", () => {
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).toContain("owner like '.%'")
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).toContain("position('/' in owner) > 0")
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).toContain("position(chr(92) in repo) > 0")
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).toContain("lower(owner) in ('.well-known')")
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).toContain("lower(owner || '/' || repo) in ('admin/.env', 'wp-admin/admin-ajax.php')")
    expect(SUSPICIOUS_REPOSITORY_ROUTE_SQL_PREDICATE).not.toContain("lower(repo) in")
  })
})
