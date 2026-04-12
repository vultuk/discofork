import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CachedRepositoryBrief, QueuedRepositoryBrief } from "@/components/repository-brief"
import { RepoShell } from "@/components/repo-shell"
import { WatchTouch } from "@/components/watch-touch"
import { RepositoryNotFoundError, getRepositoryPageView, readRepositoryView } from "@/lib/repository-service"
import { buildRepoSocialSummary, getSiteOrigin } from "@/lib/repository-social"

type RepoPageProps = {
  params: Promise<{
    owner: string
    repo: string
  }>
}

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { owner, repo } = await params
  let view
  try {
    view = await readRepositoryView(owner, repo)
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return {
        title: `${owner}/${repo} · Discofork`,
        description: `Discofork.ai view for ${owner}/${repo}.`,
      }
    }

    throw error
  }
  const social = buildRepoSocialSummary(view)
  const pageUrl = `${getSiteOrigin()}/${owner}/${repo}`
  const ogImageUrl = `${pageUrl}/opengraph-image`

  return {
    title: social.title,
    description: social.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      type: "article",
      url: pageUrl,
      title: social.title,
      description: social.description,
      siteName: "Discofork",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${view.fullName} Discofork preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: social.title,
      description: social.description,
      images: [ogImageUrl],
    },
  }
}

export default async function RepositoryPage({ params }: RepoPageProps) {
  const { owner, repo } = await params
  let view
  try {
    view = await getRepositoryPageView(owner, repo)
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      notFound()
    }

    throw error
  }

  return (
    <RepoShell
      eyebrow={view.kind === "cached" ? "Repository brief" : "Queued lookup"}
      title={view.fullName}
      description={
        view.kind === "cached"
          ? "Read the upstream summary on the left, browse the cached forks below it, and load each fork comparison into the right-hand panel."
          : "This repository does not have cached Discofork data yet, so the web app shows the queued state until backend processing exists."
      }
      compact
    >
      {view.kind === "cached" ? <CachedRepositoryBrief view={view} /> : <QueuedRepositoryBrief view={view} />}
      <WatchTouch fullName={`${owner}/${repo}`} />
    </RepoShell>
  )
}
