"use client"

import { useRouter, useSearchParams } from "next/navigation"

import type { RepoListOrder } from "@/lib/repository-list"

const orderLabels: Record<RepoListOrder, string> = {
  updated: "Discofork updated",
  pushed: "Upstream activity",
  forks: "Base repo forks",
  stars: "Base repo stars",
}

export function RepoOrderSelect({ value }: { value: RepoListOrder }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(nextValue: RepoListOrder) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("order", nextValue)
    params.set("page", "1")
    router.push(`/repos?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Order</span>
      <select
        aria-label="Order repositories"
        value={value}
        onChange={(event) => handleChange(event.target.value as RepoListOrder)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
      >
        {Object.entries(orderLabels).map(([order, label]) => (
          <option key={order} value={order}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
