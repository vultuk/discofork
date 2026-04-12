"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function QueueInput({ placeholder = "owner/repo" }: { placeholder?: string }) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError("")

      const trimmed = input.trim()
      if (!trimmed) {
        setError("Please enter a repository name.")
        return
      }

      const parts = trimmed.replace(/^https?:\/\/github\.com\//, "").split("/")
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        setError("Use the format owner/repo (e.g., openai/codex).")
        return
      }

      const owner = parts[0]
      const repo = parts[1].replace(/\.git$/, "")
      setInput("")
      router.push(`/${owner}/${repo}`)
    },
    [input, router],
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError("")
            }}
            placeholder={placeholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        <Button type="submit" variant="default" className="gap-2 rounded-md px-4">
          Queue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </form>
  )
}
