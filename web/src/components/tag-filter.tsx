"use client"

import { useEffect, useState } from "react"
import { Tag, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { getAllTags, getReposByTag } from "@/lib/tags"

export function TagFilter({
  onFilterChange,
}: {
  onFilterChange: (repos: string[]) => void
}) {
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setAllTags(getAllTags())
  }, [])

  useEffect(() => {
    if (selectedTag) {
      onFilterChange(getReposByTag(selectedTag))
    } else {
      onFilterChange([])
    }
  }, [selectedTag, onFilterChange])

  const handleSelect = (tag: string) => {
    setSelectedTag(selectedTag === tag ? null : tag)
  }

  const handleClear = () => {
    setSelectedTag(null)
  }

  if (!mounted || allTags.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Filter by tag
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleSelect(tag)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              selectedTag === tag
                ? "bg-primary/15 text-primary"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Tag className="h-3 w-3" />
            {tag}
          </button>
        ))}
        {selectedTag ? (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}
