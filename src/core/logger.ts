import { appendFile } from "node:fs/promises"
import path from "node:path"

import { ensureDir } from "./fs.ts"

type LogLevel = "debug" | "info" | "warn" | "error"

export type Logger = ReturnType<typeof createLogger>

export function createLogger(logFilePath: string) {
  let ready = false

  async function write(level: LogLevel, message: string, data?: unknown): Promise<void> {
    if (!ready) {
      await ensureDir(path.dirname(logFilePath))
      ready = true
    }

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      data,
    }

    await appendFile(logFilePath, JSON.stringify(payload) + "\n", "utf8")
  }

  return {
    path: logFilePath,
    debug: (message: string, data?: unknown) => write("debug", message, data),
    info: (message: string, data?: unknown) => write("info", message, data),
    warn: (message: string, data?: unknown) => write("warn", message, data),
    error: (message: string, data?: unknown) => write("error", message, data),
  }
}
