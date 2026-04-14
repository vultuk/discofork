import Link from "next/link"
import { ArrowRight, Terminal } from "lucide-react"

import { CopyInstallButton } from "@/components/copy-install-button"
import { QueueInput } from "@/components/queue-input"
import { RandomDiscoveryButton } from "@/components/random-discovery-button"
import { RecentlyViewedWidget } from "@/components/recently-viewed-widget"
import { RepoShell } from "@/components/repo-shell"
import { TrendingRepos } from "@/components/trending-repos"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const installCommand = "curl -fsSL https://discofork.ai/install.sh | bash"

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
                Enter a GitHub repository to queue it for Discofork analysis. If cached data already exists, you will be taken straight to the brief.
              </p>
              <QueueInput placeholder="e.g., openai/codex" />
            </div>
          </div>

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
        <TrendingRepos />
      </div>

      <div className="mt-10 sm:mt-14">
        <RecentlyViewedWidget />
      </div>
    </RepoShell>
  )
}
