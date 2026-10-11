"use client"

import { useState } from "react"
import { useSearchParams, usePathname } from "next/navigation"
import { Share2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function ShareSnapshotButton() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    // Capture current view state: selected fork, filters, sort
    const params = new URLSearchParams()
    const fork = searchParams.get("fork")
    const maintenance = searchParams.get("maintenance")
    const magnitude = searchParams.get("magnitude")
    const sort = searchParams.get("sort")

    if (fork) params.set("fork", fork)
    if (maintenance) params.set("maintenance", maintenance)
    if (magnitude) params.set("magnitude", magnitude)
    if (sort) params.set("sort", sort)

    const queryString = params.toString()
    const url = typeof window !== "undefined"
      ? `${window.location.origin}${pathname}${queryString ? `?${queryString}` : ""}`
      : `${pathname}${queryString ? `?${queryString}` : ""}`

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement("input")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-md px-4")}
      title="Copy shareable link with current view state"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Share view
        </>
      )}
    </button>
  )
}
