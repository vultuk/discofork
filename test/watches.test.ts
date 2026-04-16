import { describe, expect, test } from "bun:test"

import {
  WATCH_ACTIVITY_BATCH_SIZE,
  chunkWatchFullNames,
  getWatchActivity,
  sortWatchesByActivity,
  type WatchActivitySource,
  type WatchEntry,
} from "../web/src/lib/watches"

const BASE_WATCH: WatchEntry = {
  fullName: "schema-labs-ltd/discofork",
  owner: "schema-labs-ltd",
  repo: "discofork",
  watchedAt: "2026-04-10T08:00:00Z",
  lastVisitedAt: "2026-04-14T22:00:00Z",
}

describe("watch activity helpers", () => {
  test("derives updated status when cached activity is newer than the last visit", () => {
    expect(
      getWatchActivity(BASE_WATCH, {
        status: "cached",
        cachedAt: "2026-04-15T08:30:00Z",
      }),
    ).toEqual({
      status: "updated",
      cachedAt: "2026-04-15T08:30:00Z",
      hasUpdate: true,
    })
  })

  test("distinguishes cached, missing, and unknown activity states", () => {
    expect(
      getWatchActivity(BASE_WATCH, {
        status: "cached",
        cachedAt: "2026-04-14T20:30:00Z",
      }),
    ).toEqual({
      status: "cached",
      cachedAt: "2026-04-14T20:30:00Z",
      hasUpdate: false,
    })

    expect(
      getWatchActivity(BASE_WATCH, {
        status: "missing",
        cachedAt: null,
      }),
    ).toEqual({
      status: "missing",
      cachedAt: null,
      hasUpdate: false,
    })

    expect(
      getWatchActivity(BASE_WATCH, {
        status: "unknown",
        cachedAt: null,
      }),
    ).toEqual({
      status: "unknown",
      cachedAt: null,
      hasUpdate: false,
    })
  })

  test("prioritizes updated watches and keeps non-updated entries stable", () => {
    const watches: WatchEntry[] = [
      {
        fullName: "owner/unchanged-one",
        owner: "owner",
        repo: "unchanged-one",
        watchedAt: "2026-04-10T08:00:00Z",
        lastVisitedAt: "2026-04-14T22:00:00Z",
      },
      {
        fullName: "owner/updated-older",
        owner: "owner",
        repo: "updated-older",
        watchedAt: "2026-04-10T09:00:00Z",
        lastVisitedAt: "2026-04-14T12:00:00Z",
      },
      {
        fullName: "owner/updated-newer",
        owner: "owner",
        repo: "updated-newer",
        watchedAt: "2026-04-10T10:00:00Z",
        lastVisitedAt: "2026-04-14T12:30:00Z",
      },
      {
        fullName: "owner/unknown",
        owner: "owner",
        repo: "unknown",
        watchedAt: "2026-04-10T11:00:00Z",
        lastVisitedAt: "2026-04-14T23:00:00Z",
      },
    ]

    const activityByFullName: Record<string, WatchActivitySource> = {
      "owner/unchanged-one": {
        status: "cached",
        cachedAt: "2026-04-14T20:00:00Z",
      },
      "owner/updated-older": {
        status: "cached",
        cachedAt: "2026-04-15T06:00:00Z",
      },
      "owner/updated-newer": {
        status: "cached",
        cachedAt: "2026-04-15T07:00:00Z",
      },
      "owner/unknown": {
        status: "unknown",
        cachedAt: null,
      },
    }

    const sorted = sortWatchesByActivity(watches, activityByFullName)

    expect(sorted.map((entry) => entry.fullName)).toEqual([
      "owner/updated-newer",
      "owner/updated-older",
      "owner/unchanged-one",
      "owner/unknown",
    ])
  })

  test("chunks large watch lists so activity lookups can cover every repo", () => {
    const fullNames = Array.from({ length: WATCH_ACTIVITY_BATCH_SIZE + 1 }, (_, index) => `owner/repo-${index + 1}`)

    expect(chunkWatchFullNames(fullNames)).toEqual([
      fullNames.slice(0, WATCH_ACTIVITY_BATCH_SIZE),
      fullNames.slice(WATCH_ACTIVITY_BATCH_SIZE),
    ])
  })
})
