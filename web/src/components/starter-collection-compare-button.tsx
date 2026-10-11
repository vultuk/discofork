"use client"

import { useCallback, useState } from "react"
import { Check, GitCompareArrows } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buildCompareHref, setCompareSelection } from "@/lib/compare"

export function StarterCollectionCompareButton({ repos }: { repos: string[] }) {
  const [selected, setSelected] = useState(false)

  const handleSelect = useCallback(() => {
    setCompareSelection(repos)
    setSelected(true)
    window.setTimeout(() => setSelected(false), 1800)
  }, [repos])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={handleSelect} className="h-8 gap-1.5 rounded-md px-3 text-xs">
        {selected ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
        {selected ? "Compare seeded" : "Compare collection"}
      </Button>
      <a href={buildCompareHref(repos)} className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
        Open compare
      </a>
    </div>
  )
}
