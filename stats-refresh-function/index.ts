import { getConfig } from "./config"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
}

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname === "/api/health") {
      const { token } = getConfig()
      return Response.json(
        { status: token ? "ok" : "degraded", tokenConfigured: Boolean(token) },
        { headers: corsHeaders },
      )
    }

    if (url.pathname === "/" && (req.method === "GET" || req.method === "POST")) {
      const { url: targetUrl, token } = getConfig()

      if (!token) {
        return Response.json(
          { ok: false, error: "DISCOFORK_ADMIN_TOKEN not configured" },
          { status: 503, headers: corsHeaders },
        )
      }

      const res = await fetch(targetUrl, {
        headers: { authorization: `Bearer ${token}` },
      })

      const payload = await res.json().catch(() => null)
      return Response.json({ ok: res.ok, status: res.status, payload }, { status: res.status, headers: corsHeaders })
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders })
  },
})
