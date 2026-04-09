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

export async function GET(request: Request, { params }: RouteProps) {
  const { owner, repo } = await params
  const fullName = `${owner}/${repo}`

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

      const sendSnapshot = async () => {
        const snapshot = await getRepoStatusSnapshot(fullName)
        if (closed) {
          return
        }

        controller.enqueue(
          sseFrame({
            fullName,
            snapshot,
          }),
        )

        if (snapshot?.status === "ready") {
          closeStream()
        }
      }

      request.signal.addEventListener("abort", handleAbort)

      if (request.signal.aborted) {
        closeStream()
        return
      }

      await sendSnapshot()

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
