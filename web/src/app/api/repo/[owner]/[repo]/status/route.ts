import { describeSuspiciousRepositoryRoute } from "@/lib/repository-route-validation"
import { getRepoStatusSnapshot } from "@/lib/server/live-status"

type RouteProps = {
  params: Promise<{
    owner: string
    repo: string
  }>
}

function sseFrame(data: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

function notFoundResponse() {
  return Response.json({ error: "Repository not found." }, { status: 404 })
}

const ABORTED_DURING_INITIAL_LOOKUP = Symbol("aborted-during-initial-lookup")

type InitialSnapshot = Awaited<ReturnType<typeof getRepoStatusSnapshot>>

async function getInitialSnapshotOrAbort(
  request: Request,
  fullName: string,
): Promise<InitialSnapshot | typeof ABORTED_DURING_INITIAL_LOOKUP> {
  if (request.signal.aborted) {
    return ABORTED_DURING_INITIAL_LOOKUP
  }

  return await new Promise<InitialSnapshot | typeof ABORTED_DURING_INITIAL_LOOKUP>((resolve, reject) => {
    let settled = false

    const finish = (
      value: InitialSnapshot | typeof ABORTED_DURING_INITIAL_LOOKUP,
      error?: unknown,
    ) => {
      if (settled) {
        return
      }

      settled = true
      request.signal.removeEventListener("abort", handleAbort)

      if (error) {
        reject(error)
        return
      }

      resolve(value)
    }

    const handleAbort = () => {
      finish(ABORTED_DURING_INITIAL_LOOKUP)
    }

    request.signal.addEventListener("abort", handleAbort, { once: true })

    void getRepoStatusSnapshot(fullName).then(
      (snapshot) => finish(snapshot),
      (error) => finish(ABORTED_DURING_INITIAL_LOOKUP, error),
    )
  })
}

export async function GET(request: Request, { params }: RouteProps) {
  const { owner, repo } = await params
  if (describeSuspiciousRepositoryRoute(owner, repo)) {
    return notFoundResponse()
  }

  const fullName = `${owner}/${repo}`
  const initialSnapshot = await getInitialSnapshotOrAbort(request, fullName)
  if (initialSnapshot === ABORTED_DURING_INITIAL_LOOKUP) {
    return new Response(null, { status: 204 })
  }

  if (!initialSnapshot) {
    return notFoundResponse()
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let interval: ReturnType<typeof setInterval> | null = null

      const handleAbort = () => {
        closeStream()
      }

      const closeStream = () => {
        if (closed) {
          return
        }

        closed = true
        request.signal.removeEventListener("abort", handleAbort)

        if (interval) {
          clearInterval(interval)
          interval = null
        }

        controller.close()
      }

      const sendSnapshot = async (snapshotOverride?: NonNullable<typeof initialSnapshot>) => {
        const snapshot = snapshotOverride ?? (await getRepoStatusSnapshot(fullName))
        if (closed) {
          return
        }

        if (!snapshot) {
          closeStream()
          return
        }

        controller.enqueue(
          sseFrame({
            fullName,
            snapshot,
          }),
        )

        if (snapshot.status === "ready") {
          closeStream()
        }
      }

      request.signal.addEventListener("abort", handleAbort)

      if (request.signal.aborted) {
        closeStream()
        return
      }

      await sendSnapshot(initialSnapshot)

      if (!closed) {
        interval = setInterval(() => {
          void sendSnapshot().catch(() => {
            closeStream()
          })
        }, 1500)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
