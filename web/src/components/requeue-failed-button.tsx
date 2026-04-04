"use client"

import { startTransition, useState } from "react"
import { RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { requeueFailedReposAction } from "@/lib/server/admin-actions"

type RequeueFailedButtonProps = {
  failedCount: number
  queueEnabled: boolean
}

export function RequeueFailedButton({ failedCount, queueEnabled }: RequeueFailedButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = failedCount === 0 || !queueEnabled || isSubmitting

  async function handleClick() {
    if (disabled) {
      return
    }

    const confirmed = window.confirm(`Requeue all ${failedCount} failed jobs?`)
    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await requeueFailedReposAction()
      if (!result.ok) {
        throw new Error(result.error)
      }

      startTransition(() => {
        router.refresh()
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not requeue failed jobs.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const label = isSubmitting ? "Requeueing..." : "Requeue Failed Jobs"

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="outline" className="gap-2 rounded-md px-4" disabled={disabled} onClick={handleClick}>
        <RotateCcw className="h-4 w-4" />
        {label}
      </Button>
      {error ? <p className="text-right text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
      {!queueEnabled ? <p className="text-right text-xs text-muted-foreground">Redis is required to requeue failed jobs.</p> : null}
    </div>
  )
}
