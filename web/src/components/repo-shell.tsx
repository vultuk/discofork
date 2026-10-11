"use client"

import { useState, useEffect, useCallback } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Bookmark, Clock, Eye, Shuffle, StickyNote, Tag, Menu, X } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { CommandPalette } from "@/components/command-palette"
import { QuickJumpDialog } from "@/components/quick-jump-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Wordmark } from "@/components/wordmark"
import { cn } from "@/lib/utils"

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const linkClass = cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")

  return (
    <>
      <Link href="/repos" className={linkClass} onClick={onNavigate}>
        Repos
      </Link>
      <Link href="/recent" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <Clock className="h-4 w-4" />
        Recent
      </Link>
      <Link href="/bookmarks" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <Bookmark className="h-4 w-4" />
        Bookmarks
      </Link>
      <Link href="/watched" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <Eye className="h-4 w-4" />
        Watched
      </Link>
      <Link href="/notes" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <StickyNote className="h-4 w-4" />
        Notes
      </Link>
      <Link href="/tags" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <Tag className="h-4 w-4" />
        Tags
      </Link>
      <Link href="/discover" className={cn(buttonVariants({ variant: "ghost" }), "gap-1.5 text-muted-foreground")} onClick={onNavigate}>
        <Shuffle className="h-4 w-4" />
        Discover
      </Link>
      <Link href="/compare" className={linkClass} onClick={onNavigate}>
        Compare
      </Link>
      <Link href="/stats" className={linkClass} onClick={onNavigate}>
        Stats
      </Link>
      <a
        href="https://github.com/vultuk/discofork"
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "ghost" }), "gap-2 text-muted-foreground")}
      >
        GitHub <ArrowUpRight className="h-4 w-4" />
      </a>
    </>
  )
}

export function RepoShell({
  eyebrow,
  title,
  description,
  children,
  compact = false,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  compact?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    if (!menuOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu()
    }

    document.addEventListener("keydown", handleEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [menuOpen, closeMenu])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <QuickJumpDialog />
      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>

          {/* Desktop nav */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Navigation />
            <ThemeToggle />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen(!menuOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <div
          className={cn(
            "overflow-hidden border-t border-border transition-all duration-200 ease-in-out md:hidden",
            menuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          )}
        >
          <nav className="flex flex-col gap-1 px-4 py-3">
            <Navigation onNavigate={closeMenu} />
            <div className="mt-2 border-t border-border pt-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8", compact ? "py-6" : "py-10 sm:py-14 md:py-20")}>
        <div className={cn(compact ? "space-y-2 border-b border-border pb-4" : "max-w-3xl space-y-4")}>
          <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div>
          <h1
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-xl sm:text-[1.4rem]" : "max-w-4xl text-balance text-2xl sm:text-[2.5rem] md:text-[3.25rem]",
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              "text-muted-foreground",
              compact ? "max-w-none text-sm leading-6" : "max-w-2xl text-pretty text-sm leading-7 sm:text-base md:text-lg",
            )}
          >
            {description}
          </p>
        </div>
        <div className={cn(compact ? "mt-6" : "mt-10 sm:mt-14 animate-fade-up")}>{children}</div>
      </main>
    </div>
  )
}
