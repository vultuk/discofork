"use client"

import { useEffect } from "react"
import { addHistory } from "@/lib/history"

export function HistoryTouch({ fullName }: { fullName: string }) {
  const parts = fullName.split("/")
  useEffect(() => {
    if (parts.length === 2) {
      addHistory(parts[0], parts[1])
    }
  }, [fullName, parts])

  return null
}
