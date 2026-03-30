import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Wordmark } from "@/components/wordmark"
import { cn } from "@/lib/utils"

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
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/repos" className={cn(buttonVariants({ variant: "ghost" }), "text-slate-600")}>
              Repos
            </Link>
            <Link href="/stats" className={cn(buttonVariants({ variant: "ghost" }), "text-slate-600")}>
              Stats
            </Link>
            <a
              href="https://github.com/vultuk/discofork"
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost" }), "gap-2 text-slate-600")}
            >
              GitHub <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-[1800px] px-6 lg:px-8", compact ? "py-6" : "py-14 md:py-20")}>
        <div className={cn(compact ? "space-y-2 border-b border-border pb-4" : "max-w-3xl space-y-4")}>
          <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div>
          <h1 className={cn("font-semibold tracking-tight text-slate-950", compact ? "text-[1.4rem]" : "max-w-4xl text-balance text-[2.5rem] md:text-[3.25rem]")}>
            {title}
          </h1>
          <p className={cn("text-muted-foreground", compact ? "max-w-none text-sm leading-6" : "max-w-2xl text-pretty text-base leading-7 md:text-lg")}>
            {description}
          </p>
        </div>
        <div className={cn(compact ? "mt-6" : "mt-14 animate-fade-up")}>{children}</div>
      </main>
    </div>
  )
}
