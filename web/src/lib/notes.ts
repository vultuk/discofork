/**
 * Personal notes on repositories and forks, stored in localStorage.
 * Follows the same pattern as tags.ts — keyed by fullName.
 */

import { createMapStore } from "./local-storage"

export type NotesMap = Record<string, string>

const store = createMapStore<string>({
  storageKey: "discofork-notes",
})

export const getNotes = store.getAll

export function getNote(fullName: string): string {
  return store.get(fullName) ?? ""
}

export function setNote(fullName: string, text: string): void {
  if (text.trim()) {
    store.set(fullName, text)
  } else {
    store.remove(fullName)
  }
}

export function removeNote(fullName: string): void {
  store.remove(fullName)
}

export function hasNote(fullName: string): boolean {
  return Boolean(store.get(fullName)?.trim())
}

export function getAllNotesWithRepos(): Array<{ fullName: string; note: string }> {
  const notes = getNotes()
  return Object.entries(notes)
    .filter(([, note]) => note.trim())
    .map(([fullName, note]) => ({ fullName, note }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}
