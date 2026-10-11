import Link from "next/link"
import { Activity, AlertTriangle, GitFork, Sparkles, Star } from "lucide-react"

import { buildRepoListHref } from "@/lib/repository-list-query"

const shortcuts = [
  {
    title: "Fresh analyses",
    description: "Open repositories with the newest cached briefs first.",
    href: buildRepoListHref(1, "updated", "ready", ""),
    icon: Sparkles,
  },
  {
    title: "Active upstreams",
    description: "Prioritize projects with recent upstream pushes.",
    href: buildRepoListHref(1, "pushed", "ready", ""),
    icon: Activity,
  },
  {
    title: "Popular projects",
    description: "Start where community signal is strongest.",
    href: buildRepoListHref(1, "stars", "ready", ""),
    icon: Star,
  },
  {
    title: "Large fork networks",
    description: "Find repos where choosing the right fork matters.",
    href: buildRepoListHref(1, "forks", "ready", ""),
    icon: GitFork,
  },
  {
    title: "Failed analyses",
    description: "Check repos that may need another queue attempt.",
    href: buildRepoListHref(1, "updated", "failed", ""),
    icon: AlertTriangle,
  },
]

export function DecisionShortcuts() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Decision shortcuts</div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Jump straight to the repo list that answers your question.</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon

          return (
            <Link
              key={shortcut.title}
              href={shortcut.href}
              className="group rounded-md border border-border bg-card/65 p-4 transition-colors hover:border-primary/50 hover:bg-card"
            >
              <Icon className="h-4 w-4 text-primary" />
              <div className="mt-3 text-sm font-semibold text-foreground">{shortcut.title}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{shortcut.description}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
