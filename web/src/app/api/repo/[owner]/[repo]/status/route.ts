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

      const sendSnapshot = async () => {
        const snapshot = await getRepoStatusSnapshot(fullName)
        controller.enqueue(
          sseFrame({
            fullName,
            snapshot,
          }),
        )

        if (snapshot?.status === "ready" && !closed) {
          closed = true
          clearInterval(interval)
          controller.close()
        }
      }

      await sendSnapshot()

      const interval = setInterval(() => {
        void sendSnapshot().catch(() => {
          if (!closed) {
            closed = true
            clearInterval(interval)
            controller.close()
          }
        })
      }, 1500)

      request.signal.addEventListener("abort", () => {
        if (closed) {
          return
        }

        closed = true
        clearInterval(interval)
        controller.close()
      })
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
