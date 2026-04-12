"use client"

import { BookmarkButton } from "@/components/bookmark-button"
import { CompareToggle } from "@/components/compare-toggle"

export function RepoRowActions({
  owner,
  repo,
  fullName,
}: {
  owner: string
  repo: string
  fullName: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.preventDefault()}>
      <CompareToggle fullName={fullName} />
      <BookmarkButton owner={owner} repo={repo} variant="icon" />
    </div>
  )
}
