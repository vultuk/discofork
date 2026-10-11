"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { CompareToggle } from "@/components/compare-toggle"
import { StarterCollectionCompareButton } from "@/components/starter-collection-compare-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getStarterRepoCards, getStarterRepoCollections, type StarterRepoCard } from "@/lib/starter-repos"
import { cn } from "@/lib/utils"

function StarterRepoCardView({ repo }: { repo: StarterRepoCard }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{repo.collectionLabel}</Badge>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Starter repo</span>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">{repo.fullName}</div>
          <p className="text-sm leading-6 text-muted-foreground">{repo.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={repo.canonicalPath} className={cn(buttonVariants({ variant: "outline" }), "h-8 rounded-full px-3 text-xs")}>
          Open repo
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <CompareToggle fullName={repo.fullName} compact />
      </div>
    </div>
  )
}

export function StarterRepoGrid({
  title = "Starter repos for first-time visitors",
  description = "Use a few recognizable repositories to explore Discofork before your own local history or backend cache has warmed up.",
  limit = 4,
}: {
  title?: string
  description?: string
  limit?: number
}) {
  const collections = useMemo(() => getStarterRepoCollections(), [])
  const [activeCollectionSlug, setActiveCollectionSlug] = useState(collections[0]?.slug ?? "")
  const activeCollection = collections.find((collection) => collection.slug === activeCollectionSlug) ?? collections[0]
  const repos = activeCollection ? activeCollection.repos.slice(0, limit) : getStarterRepoCards(limit)

  return (
    <section className="space-y-4 rounded-[1.25rem] border border-border bg-card/60 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Starter launchpad</div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{activeCollection?.description ?? description}</p>
        </div>
        {activeCollection ? <StarterCollectionCompareButton repos={activeCollection.repos.map((repo) => repo.fullName)} /> : null}
      </div>
      {collections.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {collections.map((collection) => (
            <button
              key={collection.slug}
              type="button"
              onClick={() => setActiveCollectionSlug(collection.slug)}
              aria-pressed={collection.slug === activeCollection?.slug}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                collection.slug === activeCollection?.slug
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {collection.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="rounded-md border border-border bg-background/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{activeCollection?.label ?? "Starter repos"}</span>
          <span>{repos.length} repos ready to open or compare</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {repos.map((repo) => (
          <StarterRepoCardView key={repo.fullName} repo={repo} />
        ))}
      </div>
    </section>
  )
}
