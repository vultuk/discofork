"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Clock3, Database, GitFork, Radar, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { CachedRepoView, QueuedRepoView } from "@/lib/repository-service"
import { cn } from "@/lib/utils"

function SectionList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      <ul className="space-y-2 text-sm leading-7 text-slate-200">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-primary/80" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function QueuedRepositoryBrief({ view }: { view: QueuedRepoView }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="warning">Queued lookup</Badge>
          <Badge variant="muted">queued {view.queuedAt}</Badge>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">No cached brief yet</h2>
          <p className="max-w-3xl text-base leading-8 text-slate-200">{view.queueHint}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.1rem] border border-white/8 bg-black/20 p-4">
            <Radar className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium">Lookup requested</div>
          </div>
          <div className="rounded-[1.1rem] border border-white/8 bg-black/20 p-4">
            <Database className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium">Database miss</div>
          </div>
          <div className="rounded-[1.1rem] border border-white/8 bg-black/20 p-4">
            <Clock3 className="h-5 w-5 text-primary" />
            <div className="mt-3 text-sm font-medium">Awaiting backend run</div>
          </div>
        </div>
      </div>

      <aside className="rounded-[1.4rem] border border-white/10 bg-white/[0.02] p-6">
        <div className="space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Repository source</div>
          <a
            href={view.githubUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between rounded-[1rem] px-5 py-6")}
          >
            Open on GitHub
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-8 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">What happens next</div>
          <ul className="space-y-3 text-sm leading-7 text-muted-foreground">
            <li>The backend will eventually enqueue this repo in Redis.</li>
            <li>Discofork will run the local analysis pipeline and save the result in Postgres.</li>
            <li>This route will switch from queued state to a cached repo brief once that data exists.</li>
          </ul>
        </div>
      </aside>
    </section>
  )
}

export function CachedRepositoryBrief({ view }: { view: CachedRepoView }) {
  const [selectedForkName, setSelectedForkName] = useState(view.forks[0]?.fullName ?? "")
  const selectedFork = view.forks.find((fork) => fork.fullName === selectedForkName) ?? view.forks[0]

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <div className="space-y-6">
        <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Cached analysis</Badge>
                <Badge variant="muted">cached {view.cachedAt}</Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{view.fullName}</h2>
                <p className="mt-3 max-w-3xl text-base leading-8 text-slate-200">{view.upstreamSummary}</p>
              </div>
            </div>

            <a
              href={view.githubUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-full px-4")}
            >
              GitHub
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Star className="h-3.5 w-3.5" />
                Stars
              </div>
              <div className="mt-3 text-2xl font-semibold">{view.stats.stars.toLocaleString()}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <GitFork className="h-3.5 w-3.5" />
                Forks
              </div>
              <div className="mt-3 text-2xl font-semibold">{view.stats.forks.toLocaleString()}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Default branch</div>
              <div className="mt-3 text-2xl font-semibold">{view.stats.defaultBranch}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last pushed</div>
              <div className="mt-3 text-2xl font-semibold">{view.stats.lastPushedAt}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Best maintained</div>
              <div className="mt-2 text-base font-medium text-slate-100">{view.recommendations.bestMaintained}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Closest to upstream</div>
              <div className="mt-2 text-base font-medium text-slate-100">{view.recommendations.closestToUpstream}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Most feature-rich</div>
              <div className="mt-2 text-base font-medium text-slate-100">{view.recommendations.mostFeatureRich}</div>
            </div>
            <div className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Most opinionated</div>
              <div className="mt-2 text-base font-medium text-slate-100">{view.recommendations.mostOpinionated}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.025] p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Forks</div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">Choose a fork to inspect</h3>
            </div>
            <div className="text-sm text-muted-foreground">{view.forks.length} cached fork briefs</div>
          </div>

          <div className="mt-5 space-y-3">
            {view.forks.map((fork) => {
              const active = fork.fullName === selectedFork?.fullName

              return (
                <button
                  key={fork.fullName}
                  type="button"
                  onClick={() => setSelectedForkName(fork.fullName)}
                  className={cn(
                    "w-full rounded-[1rem] border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "border-white/8 bg-black/15 hover:border-white/16 hover:bg-white/[0.035]",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-medium text-slate-100">{fork.fullName}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={fork.maintenance === "active" ? "success" : "muted"}>{fork.maintenance}</Badge>
                        <Badge variant="muted">{fork.changeMagnitude}</Badge>
                      </div>
                    </div>
                    {active ? <Badge>Selected</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{fork.summary}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <aside className="rounded-[1.45rem] border border-white/10 bg-white/[0.025] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
        {selectedFork ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Fork comparison</div>
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-50">{selectedFork.fullName}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedFork.maintenance === "active" ? "success" : "muted"}>{selectedFork.maintenance}</Badge>
                  <Badge variant="muted">{selectedFork.changeMagnitude}</Badge>
                </div>
                <p className="text-base leading-8 text-slate-200">{selectedFork.summary}</p>
              </div>
            </div>

            <section className="space-y-4 rounded-[1rem] border border-white/8 bg-black/20 p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Likely purpose</div>
              <p className="text-sm leading-7 text-slate-200">{selectedFork.likelyPurpose}</p>
              <div className="pt-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Best for</div>
                <p className="mt-2 text-sm leading-7 text-slate-200">{selectedFork.bestFor}</p>
              </div>
            </section>

            <SectionList title="Additional features" items={selectedFork.additionalFeatures} />
            <SectionList title="Missing features" items={selectedFork.missingFeatures} />
            <SectionList title="Strengths" items={selectedFork.strengths} />
            <SectionList title="Risks" items={selectedFork.risks} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No fork details available.</div>
        )}
      </aside>
    </section>
  )
}
