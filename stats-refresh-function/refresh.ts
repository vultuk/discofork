export type StatsRefreshConfig = {
  url: string
  token: string | null
}

export type StatsRefreshResult = { ok: true } | { ok: false; error: string }
export type StatsRefreshFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ValidTargetResult = { ok: true; url: URL; token: string } | { ok: false; error: string }

const missingTokenError = "Stats refresh skipped: admin token is not configured."
const invalidConfigError = "Stats refresh skipped: target URL or admin token is invalid."
const requestError = "Stats refresh request failed."

function getValidTarget(config: StatsRefreshConfig): ValidTargetResult {
  const token = config.token?.trim()
  if (!token) return { ok: false, error: missingTokenError }
  if (/\s/.test(token)) return { ok: false, error: invalidConfigError }

  try {
    const url = new URL(config.url)
    if (url.protocol !== "https:" || url.username || url.password) {
      return { ok: false, error: invalidConfigError }
    }
    return { ok: true, url, token }
  } catch {
    return { ok: false, error: invalidConfigError }
  }
}

export async function refreshStats(
  config: StatsRefreshConfig,
  fetchRequest: StatsRefreshFetch = fetch,
): Promise<StatsRefreshResult> {
  const target = getValidTarget(config)
  if (!target.ok) return target

  try {
    const response = await fetchRequest(target.url, {
      method: "GET",
      headers: { authorization: `Bearer ${target.token}` },
      redirect: "error",
    })

    if (!response.ok) {
      return { ok: false, error: `Stats refresh endpoint returned HTTP ${response.status}.` }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: requestError }
  }
}
