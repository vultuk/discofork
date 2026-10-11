"use client"

import { Keyboard, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type Shortcut = {
  keys: string
  description: string
}

const shortcuts: Shortcut[] = [
  { keys: "j / ↓", description: "Move to next item" },
  { keys: "k / ↑", description: "Move to previous item" },
  { keys: "Enter", description: "Open selected repository" },
  { keys: "b", description: "Bookmark selected repository" },
  { keys: "w", description: "Watch selected repository" },
  { keys: "c", description: "Add selected to compare" },
  { keys: "/", description: "Focus search" },
  { keys: "Esc", description: "Clear selection / close modal" },
  { keys: "?", description: "Show this help" },
]

export function KeyboardHelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>

          <div className="space-y-2">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted/70 px-2 py-0.5 font-mono text-xs text-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Shortcuts are disabled when typing in input fields. Press{" "}
              <kbd className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">
                ?
              </kbd>{" "}
              anytime to show this help.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function KeyboardHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "gap-1.5 px-2 text-xs text-muted-foreground",
      )}
      aria-label="Keyboard shortcuts"
    >
      <Keyboard className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Shortcuts</span>
      <kbd className="ml-1 rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[10px]">
        ?
      </kbd>
    </button>
  )
}
