"use client"

import { useState, useEffect } from "react"
import { StickyNote, X, Pencil } from "lucide-react"
import { getNote, setNote, hasNote } from "@/lib/notes"

export function NoteEditor({
  fullName,
  variant = "inline",
}: {
  fullName: string
  variant?: "inline" | "compact"
}) {
  const [text, setText] = useState("")
  const [editing, setEditing] = useState(false)
  const [hasExistingNote, setHasExistingNote] = useState(false)

  useEffect(() => {
    const existing = getNote(fullName)
    setText(existing)
    setHasExistingNote(hasNote(fullName))
  }, [fullName])

  const save = () => {
    setNote(fullName, text)
    setHasExistingNote(hasNote(fullName))
    setEditing(false)
  }

  const clear = () => {
    setText("")
    setNote(fullName, "")
    setHasExistingNote(false)
    setEditing(false)
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        title={hasExistingNote ? "Edit note" : "Add note"}
      >
        <StickyNote className={`h-3.5 w-3.5 ${hasExistingNote ? "fill-current text-amber-500" : ""}`} />
        {hasExistingNote ? "Note" : "Add note"}
      </button>
    )
  }

  if (!editing && !hasExistingNote) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <StickyNote className="h-3.5 w-3.5" />
        Add note
      </button>
    )
  }

  if (!editing && hasExistingNote) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Note</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Edit note"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{text}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {hasExistingNote ? "Edit note" : "Add note"}
        </span>
        <button
          type="button"
          onClick={() => {
            setText(getNote(fullName))
            setEditing(false)
          }}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add your personal note..."
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring min-h-[80px]"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Save
        </button>
        {hasExistingNote ? (
          <button
            type="button"
            onClick={clear}
            className="rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}
