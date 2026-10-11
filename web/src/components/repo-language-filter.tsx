"use client"

import { useRouter, useSearchParams } from "next/navigation"

export const REPO_LANGUAGE_OPTIONS = [
  "Go",
  "Python",
  "TypeScript",
  "JavaScript",
  "Rust",
  "Java",
  "C++",
  "PHP",
  "Ruby",
  "C#",
  "Swift",
] as const

export type RepoLanguageOption = (typeof REPO_LANGUAGE_OPTIONS)[number]

export function RepoLanguageFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentLanguage = searchParams.get("language") ?? ""

  function handleChange(nextLanguage: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextLanguage) {
      params.set("language", nextLanguage)
    } else {
      params.delete("language")
    }
    params.set("page", "1")
    router.push(`/repos?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Language
      </span>
      <select
        aria-label="Filter repositories by language"
        value={currentLanguage}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
      >
        <option value="">All languages</option>
        {REPO_LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </label>
  )
}
