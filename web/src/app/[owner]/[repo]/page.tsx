import type { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Clock3, Database, Radar } from "lucide-react"

import { RepoShell } from "@/components/repo-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { resolveRepositoryView } from "@/lib/repository-service"

type RepoPageProps = {
  params: Promise<{
    owner: string
    repo: string
  }>
}

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { owner, repo } = await params
  return {
    title: `${owner}/${repo} · Discofork`,
    description: `Discofork.ai view for ${owner}/${repo}.`,
  }
}

export default async function RepositoryPage({ params }: RepoPageProps) {
  const { owner, repo } = await params
  const view = await resolveRepositoryView(owner, repo)

  return (
    <RepoShell
      eyebrow={view.kind === "cached" ? "Cached analysis" : "Queued lookup"}
      title={view.fullName}
      description={
        view.kind === "cached"
          ? "This repository already has a cached Discofork brief, so the site can render it immediately without waiting for a fresh analysis run."
          : "No cached entry exists yet. The frontend shows the repo as queued and leaves the actual backend enqueue/update flow for a later implementation pass."
      }
    >
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-10">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={view.kind === "cached" ? "success" : "warning"}>
                {view.kind === "cached" ? "Cached result" : "Queued for analysis"}
              </Badge>
              <Badge variant="muted">{view.kind === "cached" ? `cached ${view.cachedAt}` : `queued ${view.queuedAt}`}</Badge>
            </div>

            {view.kind === "cached" ? (
              <div className="mt-6 space-y-6">
                <div className="space-y-3">
                  <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Upstream summary</div>
                  <p className="max-w-3xl text-base leading-8 text-slate-100">{view.upstreamSummary}</p>
                </div>

                <Separator />

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Best maintained</div>
                    <div className="text-lg font-medium">{view.recommendations.bestMaintained}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Closest to upstream</div>
                    <div className="text-lg font-medium">{view.recommendations.closestToUpstream}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Most feature-rich</div>
                    <div className="text-lg font-medium">{view.recommendations.mostFeatureRich}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Most opinionated</div>
                    <div className="text-lg font-medium">{view.recommendations.mostOpinionated}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <p className="max-w-2xl text-base leading-8 text-slate-100">{view.queueHint}</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                    <Radar className="h-5 w-5 text-primary" />
                    <div className="mt-3 text-sm font-medium">Lookup requested</div>
                  </div>
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                    <Database className="h-5 w-5 text-primary" />
                    <div className="mt-3 text-sm font-medium">Database miss</div>
                  </div>
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/20 p-4">
                    <Clock3 className="h-5 w-5 text-primary" />
                    <div className="mt-3 text-sm font-medium">Awaiting backend run</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {view.kind === "cached" ? (
            <div className="space-y-6">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Fork highlights</div>
              <div className="space-y-5">
                {view.forks.map((fork, index) => (
                  <div
                    key={fork.fullName}
                    className="grid gap-4 rounded-[1.4rem] border border-white/8 bg-white/[0.025] p-5 animate-fade-up md:grid-cols-[0.9fr_1.1fr]"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="text-lg font-medium">{fork.fullName}</div>
                      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{fork.maintenance}</span>
                        <span>{fork.changeMagnitude}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm leading-7 text-slate-100">{fork.summary}</p>
                      <p className="text-sm leading-7 text-muted-foreground">Best for: {fork.bestFor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6 border-l border-white/10 pl-0 lg:pl-8">
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Repository source</div>
            <Button variant="outline" className="w-full justify-between rounded-[1.25rem] px-5 py-6" asChild>
              <a href={view.githubUrl} target="_blank" rel="noreferrer">
                Open on GitHub
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">How this page behaves</div>
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Checks whether a cached Discofork brief exists for the requested repository path.</li>
              <li>Renders the cached brief immediately when it exists.</li>
              <li>Shows a pending queue state when no cached data is available yet.</li>
            </ul>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">Try another repo</div>
            <div className="space-y-2 text-sm text-slate-200">
              <Link className="block transition-colors hover:text-primary" href="/openai/codex">
                /openai/codex
              </Link>
              <Link className="block transition-colors hover:text-primary" href="/cli/go-gh">
                /cli/go-gh
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </RepoShell>
  )
}
