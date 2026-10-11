"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Tag } from "lucide-react"

import { cn } from "@/lib/utils"
import { getAllTags, getReposByTag } from "@/lib/tags"

export function RepoTagFilter({}: {}) {
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [filteredRepos, setFilteredRepos] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setAllTags(getAllTags())
  }, [])

  useEffect(() => {
    if (selectedTag) {
      setFilteredRepos(getReposByTag(selectedTag))
    } else {
      setFilteredRepos([])
    }
  }, [selectedTag])

  if (!mounted || allTags.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Filter by tag
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
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
              onClick={() => setSelectedTag(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      {selectedTag && filteredRepos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredRepos.map((fullName) => {
            const parts = fullName.split("/")
            return (
              <Link
                key={fullName}
                href={`/${parts[0]}/${parts[1]}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Tag className="h-3 w-3 text-primary" />
                {fullName}
              </Link>
            )
          })}
        </div>
      ) : selectedTag ? (
        <p className="text-xs text-muted-foreground">No repositories tagged with &quot;{selectedTag}&quot;</p>
      ) : null}
    </div>
  )
}
