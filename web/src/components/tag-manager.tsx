"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Tag, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { addTag, getAllTags, getRepoTags, removeTag } from "@/lib/tags"

export function TagManager({ fullName }: { fullName: string }) {
  const [tags, setTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    setTags(getRepoTags(fullName))
    setAllTags(getAllTags())
  }, [fullName])

  const handleAdd = useCallback(
    (tag: string) => {
      if (!tag.trim()) return
      const updated = addTag(fullName, tag)
      setTags(updated)
      setAllTags(getAllTags())
      setInputValue("")
      setShowSuggestions(false)
    },
    [fullName],
  )

  const handleRemove = useCallback(
    (tag: string) => {
      const updated = removeTag(fullName, tag)
      setTags(updated)
      setAllTags(getAllTags())
    },
    [fullName],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && inputValue.trim()) {
        e.preventDefault()
        handleAdd(inputValue)
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      }
    },
    [inputValue, handleAdd],
  )

  const filteredSuggestions = allTags.filter(
    (t) => !tags.includes(t) && t.includes(inputValue.toLowerCase().trim()),
  )

  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Tag className="h-3.5 w-3.5" />
        <span>Loading tags...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            <Tag className="h-3 w-3" />
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-primary/20"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative">
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-6 w-24 rounded-md border border-border bg-background px-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
            {inputValue.trim() ? (
              <button
                type="button"
                onClick={() => handleAdd(inputValue)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Add tag"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {showSuggestions && filteredSuggestions.length > 0 ? (
            <div className="absolute left-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-border bg-card shadow-lg">
              {filteredSuggestions.slice(0, 5).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={() => handleAdd(suggestion)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Tag className="h-3 w-3" />
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function TagDisplay({ fullName }: { fullName: string }) {
  const [tags, setTags] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTags(getRepoTags(fullName))
  }, [fullName])

  if (!mounted || tags.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          <Tag className="h-3 w-3" />
          {tag}
        </span>
      ))}
    </div>
  )
}
