import Link from "next/link"
import { ArrowRight, Terminal } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

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
          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="space-y-5">
              <Badge variant="success">One command install</Badge>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/30 p-4 font-mono text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center gap-3 text-primary">
                  <Terminal className="h-4 w-4" />
                  <span>Installer</span>
                </div>
                <div className="mt-3 break-all text-base leading-7">{installCommand}</div>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                The installer bootstraps Bun when needed, downloads Discofork, installs runtime dependencies, and creates a
                local `discofork` launcher. After that, you run analysis locally with `gh`, `git`, and `codex`.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-full px-5" asChild>
                  <a href="/install.sh">
                    Download install.sh
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" className="rounded-full px-5" asChild>
                  <Link href="/openai/codex">
                    View cached example
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.02] p-5">
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Install the CLI</div>
                <h2 className="text-lg font-semibold text-slate-50">Run Discofork locally.</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  The CLI does the real work: discovering forks with `gh`, comparing them with `git`, and interpreting the
                  results locally with `codex`.
                </p>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.02] p-5">
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Use repo pages</div>
                <h2 className="text-lg font-semibold text-slate-50">Swap the host and read the brief.</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Replace `github.com` with `discofork.ai` for a repo route. If cached data exists, the page renders it. If
                  not, the frontend shows a pending state until backend processing catches up.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 border-l border-white/10 pl-0 lg:pl-8">
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
            <div className="space-y-2 text-sm text-slate-200">
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
              <li>This web app only renders cached briefs or a queued placeholder state.</li>
              <li>Backend queueing and database refresh are intentionally left out of this frontend pass.</li>
            </ul>
          </div>
        </div>
      </section>
    </RepoShell>
  )
}
