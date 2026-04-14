"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Slash } from "lucide-react"

export function QuickJumpDialog() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Open with "/" when not focused on an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setValue("")
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  // Escape closes
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [open])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) return

      // Basic owner/repo validation
      const parts = trimmed.split("/")
      if (parts.length === 2 && parts[0] && parts[1]) {
        setOpen(false)
        router.push(`/${parts[0]}/${parts[1]}`)
      }
    },
    [value, router],
  )

  if (!open) {
    return (
      <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">
          /
        </kbd>
        <span>jump to repo</span>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Slash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="owner/repo"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Navigate to repository"
          />
          <button
            type="submit"
            disabled={!value.trim().includes("/")}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            aria-label="Go"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Type <span className="font-mono font-medium text-foreground">owner/repo</span> and press Enter to navigate directly to the repository brief.
          </p>
        </div>
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted/70 px-1 py-0.5 font-mono text-[10px]">
                esc
              </kbd>{" "}
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
