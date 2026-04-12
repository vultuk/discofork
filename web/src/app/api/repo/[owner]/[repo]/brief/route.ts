import { NextResponse } from "next/server"

import { readRepositoryView } from "@/lib/repository-service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params

  try {
    const view = await readRepositoryView(owner, repo)

    if (view.kind === "cached") {
      return NextResponse.json(view)
    }

    return NextResponse.json({ error: "Repository not cached yet", status: view.status }, { status: 404 })
  } catch {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 })
  }
}
