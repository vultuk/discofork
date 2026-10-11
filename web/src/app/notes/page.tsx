"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { StickyNote, Trash2, ExternalLink } from "lucide-react"
import { RepoShell } from "@/components/repo-shell"
import { getAllNotesWithRepos, removeNote } from "@/lib/notes"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotesPage() {
  const [notes, setNotes] = useState<Array<{ fullName: string; note: string }>>([])

  useEffect(() => {
    setNotes(getAllNotesWithRepos())
  }, [])

  const handleDelete = (fullName: string) => {
    removeNote(fullName)
    setNotes(getAllNotesWithRepos())
  }

  return (
    <RepoShell
      eyebrow="Notes"
      title="Your notes"
      description="Personal notes you've added to repositories and forks."
    >
      {notes.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <StickyNote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No notes yet. Add notes from any repository or fork detail page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(({ fullName, note }) => (
            <div
              key={fullName}
              className="rounded-md border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-amber-500" />
                  <Link
                    href={`/${fullName}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {fullName}
                  </Link>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(fullName)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  title="Delete note"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                {note}
              </p>
            </div>
          ))}
        </div>
      )}
    </RepoShell>
  )
}
