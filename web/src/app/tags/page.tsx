"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Tag, X } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTagSummaries, TAGS_CHANGE_EVENT, TAGS_STORAGE_KEY, type TagSummary } from "@/lib/tags"

function splitFullName(fullName: string) {
  const [owner = fullName, repo = fullName] = fullName.split("/")
  return { owner, repo }
}

export default function TagsPage() {
  const [tagSummaries, setTagSummaries] = useState<TagSummary[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const syncTagSummaries = () => {
      const summaries = getTagSummaries()
      setTagSummaries(summaries)
      setSelectedTag((current) => (current && summaries.some((summary) => summary.tag === current) ? current : null))
    }

    setMounted(true)
    syncTagSummaries()

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TAGS_STORAGE_KEY) {
        return
      }
      syncTagSummaries()
    }

    window.addEventListener(TAGS_CHANGE_EVENT, syncTagSummaries)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener(TAGS_CHANGE_EVENT, syncTagSummaries)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const selectedSummary = useMemo(
    () => tagSummaries.find((summary) => summary.tag === selectedTag) ?? null,
    [selectedTag, tagSummaries],
  )
  const taggedRepoCount = useMemo(
    () => new Set(tagSummaries.flatMap((summary) => summary.repos)).size,
    [tagSummaries],
  )

  return (
    <RepoShell
      eyebrow="Tags"
      title="Your saved repository tags."
      description="Browse the tags you have saved locally, see how many repositories use each one, and reopen tagged repositories without hunting through individual repo pages."
      compact
    >
      <section className="space-y-6">
        {!mounted ? (
          <div className="rounded-md border border-border bg-card p-6 text-sm leading-7 text-muted-foreground">
            Loading saved tags...
          </div>
        ) : tagSummaries.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <Tag className="mt-1 h-5 w-5 text-muted-foreground" />
              <div className="space-y-3">
                <h2 className="text-base font-semibold text-foreground">No saved tags yet</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Visit any repository page and add one or more tags to organize it. Saved tags stay local to your browser and will appear here once you create them.
                </p>
                <Link href="/repos" className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}>
                  Browse repositories
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 rounded-md border border-border bg-card px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">Saved tags</h2>
                  <p className="text-sm text-muted-foreground">
                    {tagSummaries.length.toLocaleString()} {tagSummaries.length === 1 ? "tag" : "tags"} across {taggedRepoCount.toLocaleString()} tagged {taggedRepoCount === 1 ? "repository" : "repositories"}
                  </p>
                </div>
                {selectedSummary ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTag(null)}
                    className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:text-rose-500")}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear selection
                  </button>
                ) : (
                  <div className="text-xs text-muted-foreground">Select one tag to see the matching repositories.</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {tagSummaries.map((summary) => {
                  const selected = selectedTag === summary.tag
                  return (
                    <button
                      key={summary.tag}
                      type="button"
                      onClick={() => setSelectedTag(selected ? null : summary.tag)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-pressed={selected}
                    >
                      <Tag className="h-4 w-4" />
                      <span>{summary.tag}</span>
                      <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                        {summary.repoCount}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-card">
              {selectedSummary ? (
                <>
                  <div className="border-b border-border px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        <Tag className="h-3.5 w-3.5" />
                        {selectedSummary.tag}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {selectedSummary.repoCount.toLocaleString()} {selectedSummary.repoCount === 1 ? "repository" : "repositories"}
                      </span>
                    </div>
                  </div>
                  {selectedSummary.repos.map((fullName) => {
                    const { owner, repo } = splitFullName(fullName)
                    return (
                      <div
                        key={fullName}
                        className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            href={`/${owner}/${repo}`}
                            className="block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {fullName}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            Tagged with <span className="font-medium text-foreground">{selectedSummary.tag}</span>
                          </div>
                        </div>
                        <Link
                          href={`/${owner}/${repo}`}
                          className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 px-3 text-xs")}
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )
                  })}
                </>
              ) : (
                <div className="p-6 text-sm leading-7 text-muted-foreground">
                  Select a tag above to view the repositories saved under it.
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </RepoShell>
  )
}
