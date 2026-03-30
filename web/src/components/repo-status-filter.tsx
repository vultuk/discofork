"use client"

import { useRouter, useSearchParams } from "next/navigation"

import type { RepoListStatusFilter } from "@/lib/repository-list"

const statusLabels: Record<RepoListStatusFilter, string> = {
  all: "All statuses",
  queued: "In Queue",
  ready: "Ready",
  processing: "Processing",
  failed: "Failed",
}

export function RepoStatusFilter({ value }: { value: RepoListStatusFilter }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(nextValue: RepoListStatusFilter) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("status", nextValue)
    params.set("page", "1")
    router.push(`/repos?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Status</span>
      <select
        aria-label="Filter repositories by status"
        value={value}
        onChange={(event) => handleChange(event.target.value as RepoListStatusFilter)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
      >
        {Object.entries(statusLabels).map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
