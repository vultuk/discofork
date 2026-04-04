import { NextResponse } from "next/server"

import { RepositoryNotFoundError, getRepositoryPageView } from "@/lib/repository-service"

type RouteProps = {
  params: Promise<{
    owner: string
    repo: string
  }>
}

export async function GET(_: Request, { params }: RouteProps) {
  const { owner, repo } = await params
  try {
    const view = await getRepositoryPageView(owner, repo)
    return NextResponse.json(view)
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 })
    }

    throw error
  }
}
