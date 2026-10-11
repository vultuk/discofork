"use client"

import { useEffect } from "react"
import { touchWatch } from "@/lib/watches"

export function WatchTouch({ fullName }: { fullName: string }) {
  useEffect(() => {
    touchWatch(fullName)
  }, [fullName])

  return null
}
