import type { Metadata } from "next"

import { CachedRepositoryBrief, QueuedRepositoryBrief } from "@/components/repository-brief"
import { RepoShell } from "@/components/repo-shell"
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
      eyebrow={view.kind === "cached" ? "Repository brief" : "Queued lookup"}
      title={view.fullName}
      description={
        view.kind === "cached"
          ? "Read the upstream summary on the left, browse the cached forks below it, and load each fork comparison into the right-hand panel."
          : "This repository does not have cached Discofork data yet, so the web app shows the queued state until backend processing exists."
      }
    >
      {view.kind === "cached" ? <CachedRepositoryBrief view={view} /> : <QueuedRepositoryBrief view={view} />}
    </RepoShell>
  )
}
