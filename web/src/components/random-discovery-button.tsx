"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Shuffle } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RandomDiscoveryRepo = {
  owner: string
  repo: string
}

type RandomDiscoveryResponse = {
  items?: RandomDiscoveryRepo[]
  totalPages?: number
  total_pages?: number
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function RandomDiscoveryButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch page 1 to get totalPages
      const initRes = await fetch("/api/repos?order=updated&status=ready&page=1")
      if (!initRes.ok) throw new Error(`HTTP ${initRes.status}`)
      const initData = await initRes.json() as RandomDiscoveryResponse

      const totalPages = Math.max(initData.totalPages ?? initData.total_pages ?? 1, 1)
      const randomPage = Math.floor(Math.random() * totalPages) + 1

      // Fetch the random page (reuse page 1 data if it happens to be the same)
      let data = initData
      if (randomPage !== 1) {
        const pageRes = await fetch(`/api/repos?order=updated&status=ready&page=${randomPage}`)
        if (pageRes.ok) {
          data = await pageRes.json() as RandomDiscoveryResponse
        }
      }

      const items = data.items ?? []
      if (items.length === 0) throw new Error("No repos found")

      const shuffled = shuffleArray(items)
      const pick = shuffled[0]
      router.push(`/${pick.owner}/${pick.repo}`)
    } catch {
      // Silent fail — user can try again
      setLoading(false)
    }
  }, [router])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        buttonVariants({ variant: "outline" }),
        "rounded-full px-5 gap-2",
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Shuffle className="h-4 w-4" />
      )}
      Discover Random
    </button>
  )
}
