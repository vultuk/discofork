const STATS_REFRESH_URL = "https://discofork.ai/api/stats/refresh"

export function getConfig() {
  const token =
    process.env.DISCOFORK_ADMIN_TOKEN?.trim() ||
    process.env.STATS_REFRESH_ADMIN_TOKEN?.trim() ||
    null

  return {
    url: process.env.STATS_REFRESH_URL?.trim() || STATS_REFRESH_URL,
    token,
  }
}
