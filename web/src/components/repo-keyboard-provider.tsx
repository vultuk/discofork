"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { KeyboardHelpModal, KeyboardHelpButton } from "@/components/keyboard-help-modal"
import { useKeyboardShortcuts, useRepoListNavigation } from "@/hooks/use-keyboard-shortcuts"
import { toggleBookmark } from "@/lib/bookmarks"
import { toggleWatch } from "@/lib/watches"
import { toggleCompareRepo } from "@/lib/compare"

export function RepoListKeyboardProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  const [items, setItems] = useState<HTMLElement[]>([])

  useEffect(() => {
    const container = document.querySelector("[data-repo-list]")
    if (!container) return

    const updateItems = () => {
      const listItems = Array.from(
        container.querySelectorAll<HTMLElement>("[data-repo-item]"),
      )
      setItems(listItems)
    }

    updateItems()

    const observer = new MutationObserver(updateItems)
    observer.observe(container, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  const scrollToItem = useCallback((index: number) => {
    const item = items[index]
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [items])

  const selectItem = useCallback(
    (index: number) => {
      items.forEach((item, i) => {
        if (i === index) {
          item.classList.add("bg-muted/70")
          item.setAttribute("data-selected", "true")
        } else {
          item.classList.remove("bg-muted/70")
          item.removeAttribute("data-selected")
        }
      })
      scrollToItem(index)
    },
    [items, scrollToItem],
  )

  const {
    selectedIndex,
    moveDown,
    moveUp,
    openSelected,
    bookmarkSelected,
    watchSelected,
    compareSelected,
    focusSearch,
    clearSelection,
  } = useRepoListNavigation({
    itemCount: items.length,
    onSelect: selectItem,
    onOpen: (index) => {
      const link = items[index]?.querySelector("a")
      if (link) {
        router.push(link.getAttribute("href") ?? "")
      }
    },
    onBookmark: (index) => {
      const fullName = items[index]?.getAttribute("data-full-name")
      if (fullName) {
        const [owner, repo] = fullName.split("/")
        toggleBookmark(owner, repo)
      }
    },
    onWatch: (index) => {
      const fullName = items[index]?.getAttribute("data-full-name")
      if (fullName) {
        const [owner, repo] = fullName.split("/")
        toggleWatch(owner, repo)
      }
    },
    onCompare: (index) => {
      const fullName = items[index]?.getAttribute("data-full-name")
      if (fullName) {
        toggleCompareRepo(fullName)
      }
    },
  })

  const { } = useKeyboardShortcuts([
    { key: "j", description: "Move down", action: moveDown, global: true },
    { key: "ArrowDown", description: "Move down", action: moveDown, global: true },
    { key: "k", description: "Move up", action: moveUp, global: true },
    { key: "ArrowUp", description: "Move up", action: moveUp, global: true },
    { key: "Enter", description: "Open selected", action: openSelected },
    { key: "b", description: "Bookmark selected", action: bookmarkSelected, global: true },
    { key: "w", description: "Watch selected", action: watchSelected, global: true },
    { key: "c", description: "Compare selected", action: compareSelected, global: true },
    { key: "/", description: "Focus search", action: focusSearch, global: true },
    { key: "?", description: "Show help", action: () => setHelpOpen(true), global: true },
    { key: "Escape", description: "Clear selection", action: clearSelection },
  ])

  return (
    <>
      <div className="flex items-center justify-end">
        <KeyboardHelpButton onClick={() => setHelpOpen(true)} />
      </div>
      {children}
      <KeyboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
