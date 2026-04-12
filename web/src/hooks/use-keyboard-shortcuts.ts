"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type KeyboardAction = {
  key: string
  description: string
  action: () => void
  modifier?: "ctrl" | "meta" | "shift" | "alt"
  global?: boolean
}

export function useKeyboardShortcuts(actions: KeyboardAction[]) {
  const [helpOpen, setHelpOpen] = useState(false)
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable

    for (const action of actionsRef.current) {
      if (action.key !== event.key) continue
      if (action.global && isInput) continue

      if (action.modifier) {
        if (action.modifier === "ctrl" && !event.ctrlKey) continue
        if (action.modifier === "meta" && !event.metaKey) continue
        if (action.modifier === "shift" && !event.shiftKey) continue
        if (action.modifier === "alt" && !event.altKey) continue
      } else if (event.ctrlKey || event.metaKey || event.altKey) {
        continue
      }

      if (action.key === "?" && !event.shiftKey) continue
      if (action.key === "/" && isInput) continue

      event.preventDefault()
      action.action()
      return
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return { helpOpen, setHelpOpen }
}

export function useRepoListNavigation({
  itemCount,
  onSelect,
  onOpen,
  onBookmark,
  onWatch,
  onCompare,
}: {
  itemCount: number
  onSelect: (index: number) => void
  onOpen: (index: number) => void
  onBookmark: (index: number) => void
  onWatch: (index: number) => void
  onCompare: (index: number) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = prev < itemCount - 1 ? prev + 1 : prev
      onSelect(next)
      return next
    })
  }, [itemCount, onSelect])

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => {
      const next = prev > 0 ? prev - 1 : 0
      onSelect(next)
      return next
    })
  }, [onSelect])

  const openSelected = useCallback(() => {
    if (selectedIndex >= 0) onOpen(selectedIndex)
  }, [selectedIndex, onOpen])

  const bookmarkSelected = useCallback(() => {
    if (selectedIndex >= 0) onBookmark(selectedIndex)
  }, [selectedIndex, onBookmark])

  const watchSelected = useCallback(() => {
    if (selectedIndex >= 0) onWatch(selectedIndex)
  }, [selectedIndex, onWatch])

  const compareSelected = useCallback(() => {
    if (selectedIndex >= 0) onCompare(selectedIndex)
  }, [selectedIndex, onCompare])

  const focusSearch = useCallback(() => {
    const searchInput = document.getElementById("repo-query")
    if (searchInput) {
      searchInput.focus()
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIndex(-1)
    onSelect(-1)
    const searchInput = document.getElementById("repo-query") as HTMLInputElement | null
    if (searchInput) {
      searchInput.blur()
    }
  }, [onSelect])

  return {
    selectedIndex,
    setSelectedIndex,
    moveDown,
    moveUp,
    openSelected,
    bookmarkSelected,
    watchSelected,
    compareSelected,
    focusSearch,
    clearSelection,
  }
}
