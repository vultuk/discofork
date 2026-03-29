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
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(94,234,212,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.03),_transparent_35%)]" />
      <header className="border-b border-white/10">
        <div className="container flex items-center justify-between py-5">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Wordmark />
          </Link>
          <a
            href="https://github.com/vultuk/discofork"
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost" }), "gap-2 rounded-full text-muted-foreground")}
          >
            GitHub <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main className="container py-14 md:py-20">
        <div className="max-w-3xl space-y-5">
          <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">{title}</h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground md:text-lg">{description}</p>
        </div>
        <div className="mt-14 animate-fade-up">{children}</div>
      </main>
    </div>
  )
}
