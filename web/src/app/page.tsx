import Link from "next/link"
import { ArrowRight, Compass, GitCompareArrows, Search, Terminal } from "lucide-react"

import { CopyInstallButton } from "@/components/copy-install-button"
import { DecisionShortcuts } from "@/components/decision-shortcuts"
import { LocalWorkspacePanel } from "@/components/local-workspace-panel"
import { QueueInput } from "@/components/queue-input"
import { RandomDiscoveryButton } from "@/components/random-discovery-button"
import { RecentlyViewedWidget } from "@/components/recently-viewed-widget"
import { RepoLaunchBuilder } from "@/components/repo-launch-builder"
import { RepoShell } from "@/components/repo-shell"
import { StarterRepoGrid } from "@/components/starter-repo-grid"
import { TrendingRepos } from "@/components/trending-repos"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const installCommand = "curl -fsSL https://discofork.ai/install.sh | bash"

const visitorPaths = [
  {
    title: "Start with a repository",
    description: "Paste any GitHub repo or open a familiar starter route to see whether Discofork already has a cached brief.",
    href: "/repos",
    action: "Browse index",
    icon: Search,
  },
  {
    title: "Find the useful fork",
    description: "Use recommendations, score signals, and fork summaries to separate practical downstream work from stale mirrors.",
    href: "/openai/codex",
    action: "Open example",
    icon: Compass,
  },
  {
    title: "Compare before adopting",
    description: "Save candidates into a comparison set so the trade-offs stay visible while you inspect each fork.",
    href: "/compare",
    action: "Compare repos",
    icon: GitCompareArrows,
  },
]

export default function HomePage() {
  return (
    <RepoShell
      eyebrow="Install Discofork"
      title="Run the local fork-analysis CLI, then browse cached repo briefs on the web."
      description="Discofork.ai has two jobs: give people a dead-simple install path for the local CLI, and render cached repository brief pages at routes like `/openai/codex` once backend data exists."
    >
      <section className="grid gap-8 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-[1.6rem] border border-border bg-card/70 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="space-y-5">
              <Badge variant="success">One command install</Badge>
              <div className="rounded-[1.25rem] border border-border bg-muted/70 p-4 font-mono text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between gap-3 text-primary">
                  <div className="flex items-center gap-3">
                    <Terminal className="h-4 w-4" />
                    <span>Installer</span>
                  </div>
                  <CopyInstallButton command={installCommand} />
                </div>
                <div className="mt-3 break-all text-base leading-7">{installCommand}</div>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                The installer bootstraps Bun when needed, downloads Discofork, installs runtime dependencies, and creates a
                local `discofork` launcher. After that, you run analysis locally with `gh`, `git`, and `codex`.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/install.sh" className={cn(buttonVariants({ variant: "default" }), "rounded-full px-5")}>
                  Download install.sh
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/repos" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
                  Browse cached repos
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <RandomDiscoveryButton />
                <Link href="/vultuk/discofork" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
                  View repo layout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-border bg-card/70 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="space-y-4">
              <Badge variant="success">Queue a repository</Badge>
              <p className="text-sm leading-7 text-muted-foreground">
                Paste <span className="font-medium text-foreground">owner/repo</span>, a GitHub repo URL, or a Discofork repo URL to jump straight into the cached brief or queue a fresh analysis.
              </p>
              <QueueInput placeholder="e.g., openai/codex or github.com/openai/codex" />
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Visitor path</div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Get from repo name to fork decision.</h2>
              </div>
              <Link href="/discover" className={cn(buttonVariants({ variant: "ghost" }), "gap-2 rounded-md px-3")}>
                Explore discovery
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {visitorPaths.map((path) => {
                const Icon = path.icon

                return (
                  <Link
                    key={path.title}
                    href={path.href}
                    className="group rounded-md border border-border bg-card/65 p-5 transition-colors hover:border-primary/50 hover:bg-card"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">{path.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{path.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                      {path.action}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-border bg-card/60 p-5">
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Install the CLI</div>
                <h2 className="text-lg font-semibold text-foreground">Run Discofork locally.</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  The CLI does the real work: discovering forks with `gh`, comparing them with `git`, and
                  interpreting the results locally with `codex`.
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-card/60 p-5">
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Use repo pages</div>
                <h2 className="text-lg font-semibold text-foreground">Swap the host and read the brief.</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Replace `github.com` with `discofork.ai` for a repo route. If cached data exists, the page renders it. If
                  not, the frontend shows a pending state until backend processing catches up.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 border-l-0 border-border sm:border-l lg:pl-8">
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">What the script handles</div>
            <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
              <li>Installs Bun automatically when it is missing.</li>
              <li>Downloads Discofork into `~/.local/share/discofork`.</li>
              <li>Creates a `discofork` launcher in `~/.local/bin`.</li>
              <li>Warns if `git`, `gh`, or `codex` are still missing.</li>
            </ul>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Try these routes</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link className="block transition-colors hover:text-primary" href="/vultuk/discofork">
                /vultuk/discofork
              </Link>
              <Link className="block transition-colors hover:text-primary" href="/openai/codex">
                /openai/codex
              </Link>
              <Link className="block transition-colors hover:text-primary" href="/cli/go-gh">
                /cli/go-gh
              </Link>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Runtime requirements</div>
            <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
              <li>Discofork analysis still runs locally and depends on Bun, `git`, `gh`, and `codex`.</li>
              <li>This web app reads cached briefs through its backend and queues missing repos for worker processing.</li>
              <li>The `/repos` page lists everything currently stored in Postgres.</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="mt-10 sm:mt-14">
        <RepoLaunchBuilder />
      </div>

      <div className="mt-10 sm:mt-14">
        <DecisionShortcuts />
      </div>

      <div className="mt-10 sm:mt-14">
        <StarterRepoGrid />
      </div>

      <div className="mt-10 sm:mt-14">
        <LocalWorkspacePanel />
      </div>

      <div className="mt-10 sm:mt-14">
        <TrendingRepos />
      </div>

      <div className="mt-10 sm:mt-14">
        <RecentlyViewedWidget />
      </div>
    </RepoShell>
  )
}
