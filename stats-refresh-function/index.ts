import { Hono } from "hono"
import { cors } from "hono/cors"

import { getStatsRefreshHealth, resolveStatsRefreshFunctionConfig, triggerStatsRefresh } from "./config.ts"

const app = new Hono()

app.use("/*", cors())

async function handleRefresh() {
  const config = resolveStatsRefreshFunctionConfig()
  return triggerStatsRefresh(config)
}

app.get("/", async (c) => {
  const result = await handleRefresh()
  return c.json(result, result.status)
})

app.post("/", async (c) => {
  const result = await handleRefresh()
  return c.json(result, result.status)
})

app.get("/api/health", (c) => c.json(getStatsRefreshHealth(resolveStatsRefreshFunctionConfig())))

Bun.serve({
  port: import.meta.env.PORT ?? 3000,
  fetch: app.fetch,
})
