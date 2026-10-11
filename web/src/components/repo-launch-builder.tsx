"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Copy, Github, Route, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { buildRepoLaunchArtifacts } from "@/lib/repo-launch-artifacts"
import { cn } from "@/lib/utils"

function CopyAction({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const input = document.createElement("input")
      input.value = value
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  )
}

export function RepoLaunchBuilder() {
  const [input, setInput] = useState("github.com/openai/codex")
  const artifacts = useMemo(() => buildRepoLaunchArtifacts(input), [input])
  const hasInput = input.trim().length > 0

  return (
    <section className="grid gap-5 rounded-[1.25rem] border border-border bg-card/60 p-5 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Repo route builder</div>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Turn any GitHub repo into a Discofork workspace.</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Paste a GitHub URL, SSH remote, owner/repo, or Discofork URL. The builder gives you the web route and the local analysis command in one place.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="repo-launch-builder-input" className="text-xs font-medium text-muted-foreground">
            Repository
          </label>
          <input
            id="repo-launch-builder-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="github.com/owner/repo"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
          {!artifacts && hasInput ? <p className="text-xs text-rose-500">Enter a GitHub repository URL or owner/repo name.</p> : null}
        </div>

        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Github className="h-4 w-4 text-primary" />
                {artifacts?.fullName ?? "Waiting for a repository"}
              </div>
              {artifacts ? <Badge variant="success">Ready</Badge> : <Badge variant="muted">Preview</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {artifacts ? (
                <>
                  <Link href={artifacts.canonicalPath} className={cn(buttonVariants({ variant: "default" }), "h-8 rounded-md px-3 text-xs")}>
                    Open route
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <CopyAction value={artifacts.discoforkUrl} label="Copy URL" />
                  <a href={artifacts.githubUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-8 rounded-md px-3 text-xs")}>
                    GitHub
                  </a>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              Local command
            </div>
            <div className="mt-2 break-all font-mono text-sm leading-6 text-foreground">
              {artifacts?.analysisCommand ?? "discofork analyze owner/repo"}
            </div>
            {artifacts ? <div className="mt-3"><CopyAction value={artifacts.analysisCommand} label="Copy command" /></div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
