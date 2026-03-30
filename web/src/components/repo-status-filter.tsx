"use client"

import { useRouter, useSearchParams } from "next/navigation"

import type { RepoListStatusFilter } from "@/lib/repository-list"

const statusLabels: Record<RepoListStatusFilter, string> = {
  all: "All statuses",
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
    <label className="flex items-center gap-3 text-sm text-slate-700">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Status</span>
      <select
        aria-label="Filter repositories by status"
        value={value}
        onChange={(event) => handleChange(event.target.value as RepoListStatusFilter)}
        className="rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors focus:border-slate-400"
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
