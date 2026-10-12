import { getConfig } from "./config"
import { refreshStats } from "./refresh"

const result = await refreshStats(getConfig())

if (!result.ok) {
  console.error(result.error)
  process.exitCode = 1
}
