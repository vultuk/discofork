import { Hono } from "hono@4"
import { cors } from "hono/cors"

const app = new Hono()
const targetUrl = (process.env.STATS_REFRESH_URL ?? "https://discofork.ai/api/stats/refresh").trim()

async function triggerRefresh() {
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "user-agent": "discofork-stats-refresh-function",
    },
  })

  const text = await response.text()
  let payload: unknown = null

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

app.use("/*", cors())

app.get("/", async (c) => {
  const result = await triggerRefresh()
  return c.json(
    {
      targetUrl,
      ...result,
    },
    result.status,
  )
})

app.post("/", async (c) => {
  const result = await triggerRefresh()
  return c.json(
    {
      targetUrl,
      ...result,
    },
    result.status,
  )
})

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    targetUrl,
  }),
)

Bun.serve({
  port: import.meta.env.PORT ?? 3000,
  fetch: app.fetch,
})
