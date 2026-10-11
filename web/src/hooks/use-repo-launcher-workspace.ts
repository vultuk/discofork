"use client"

import { useCallback, useEffect, useState } from "react"

import { BOOKMARKS_CHANGE_EVENT, getBookmarks, type BookmarkEntry } from "@/lib/bookmarks"
import { getHistory, HISTORY_CHANGE_EVENT, type HistoryEntry } from "@/lib/history"
import { getRepoLauncherSuggestions, type RepoLauncherSuggestion } from "@/lib/repo-launcher"
import { getWatches, WATCHES_CHANGE_EVENT, type WatchEntry } from "@/lib/watches"

type RepoLauncherWorkspace = {
  bookmarks: BookmarkEntry[]
  history: HistoryEntry[]
  mounted: boolean
  suggestions: RepoLauncherSuggestion[]
  watches: WatchEntry[]
}

function readWorkspace(limit: number): Omit<RepoLauncherWorkspace, "mounted"> {
  return {
    bookmarks: getBookmarks(),
    history: getHistory(),
    suggestions: getRepoLauncherSuggestions(limit),
    watches: getWatches(),
  }
}

export function useRepoLauncherWorkspace(limit = 8): RepoLauncherWorkspace {
  const [workspace, setWorkspace] = useState<RepoLauncherWorkspace>({
    bookmarks: [],
    history: [],
    mounted: false,
    suggestions: [],
    watches: [],
  })

  const refresh = useCallback(() => {
    setWorkspace({
      ...readWorkspace(limit),
      mounted: true,
    })
  }, [limit])

  useEffect(() => {
    refresh()

    const handleChange = () => refresh()
    window.addEventListener(BOOKMARKS_CHANGE_EVENT, handleChange)
    window.addEventListener(HISTORY_CHANGE_EVENT, handleChange)
    window.addEventListener(WATCHES_CHANGE_EVENT, handleChange)

    return () => {
      window.removeEventListener(BOOKMARKS_CHANGE_EVENT, handleChange)
      window.removeEventListener(HISTORY_CHANGE_EVENT, handleChange)
      window.removeEventListener(WATCHES_CHANGE_EVENT, handleChange)
    }
  }, [refresh])

  return workspace
}
