import { describe, expect, test } from "bun:test"

import {
  SUSPICIOUS_OWNER_NAMES,
  SUSPICIOUS_ROUTE_PAIRS,
  describeSuspiciousRepoInputCore,
} from "../web/src/core/suspicious-repo-patterns"

describe("web suspicious repo patterns", () => {
  test("shares the known suspicious owner and route patterns needed by the web bundle", () => {
    expect(SUSPICIOUS_OWNER_NAMES).toContain(".well-known")
    expect(SUSPICIOUS_ROUTE_PAIRS).toContain("admin/.env")
    expect(SUSPICIOUS_ROUTE_PAIRS).toContain("wp-admin/admin-ajax.php")
  })

  test("keeps suspicious routes blocked while allowing legitimate dotted repos", () => {
    expect(describeSuspiciousRepoInputCore(".well-known", "nodeinfo")).toContain("hidden-path prefix")
    expect(describeSuspiciousRepoInputCore("admin", ".env")).toContain("known web probe route")
    expect(describeSuspiciousRepoInputCore("github", ".github")).toBeNull()
    expect(describeSuspiciousRepoInputCore("vercel", "next.js")).toBeNull()
  })
})
