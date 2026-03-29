import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

export async function ensureDir(dirPath: string): Promise<string> {
  await mkdir(dirPath, { recursive: true })
  return dirPath
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await writeFile(filePath, value, "utf8")
}

export function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()
}
