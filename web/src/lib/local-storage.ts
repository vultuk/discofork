/**
 * Generic SSR-safe localStorage store factory.
 * Eliminates duplicated boilerplate across bookmarks, watches, history, etc.
 */

type ArrayStoreOptions<T> = {
  storageKey: string
  /** How to extract the unique key from an entry for dedup/lookup */
  keyOf: (entry: T) => string
  /** Build a new entry when adding */
  createEntry: (owner: string, repo: string) => T
}

type MapStoreOptions = {
  storageKey: string
}

/**
 * Read a JSON value from localStorage with SSR safety and parse error handling.
 * Returns the parsed value if it passes the guard, otherwise the fallback.
 */
function readStorage<T>(key: string, guard: (value: unknown) => value is T, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    const parsed: unknown = JSON.parse(raw)
    return guard(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return
  }

  localStorage.setItem(key, JSON.stringify(value))
}

// --- Array-based stores (bookmarks, watches, history) ---

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Creates an array-backed localStorage store with standard CRUD operations.
 */
export function createArrayStore<T extends Record<string, unknown>>(options: ArrayStoreOptions<T>) {
  const { storageKey, keyOf, createEntry } = options

  function getAll(): T[] {
    return readStorage<T[]>(storageKey, isArray as (v: unknown) => v is T[], [])
  }

  function findByFullName(fullName: string): T | undefined {
    return getAll().find((entry) => keyOf(entry) === fullName)
  }

  function has(fullName: string): boolean {
    return getAll().some((entry) => keyOf(entry) === fullName)
  }

  function add(owner: string, repo: string): T {
    const items = getAll()
    const fullName = `${owner}/${repo}`
    const existing = items.find((entry) => keyOf(entry) === fullName)
    if (existing) {
      return existing
    }

    const entry = createEntry(owner, repo)
    writeStorage(storageKey, [...items, entry])
    return entry
  }

  function remove(fullName: string): void {
    const items = getAll().filter((entry) => keyOf(entry) !== fullName)
    writeStorage(storageKey, items)
  }

  function toggle(owner: string, repo: string): boolean {
    const fullName = `${owner}/${repo}`
    if (has(fullName)) {
      remove(fullName)
      return false
    }
    add(owner, repo)
    return true
  }

  return { getAll, findByFullName, has, add, remove, toggle }
}

// --- Map-based stores (notes, tags) ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Creates a map-backed localStorage store keyed by fullName.
 */
export function createMapStore<V>(options: MapStoreOptions) {
  const { storageKey } = options

  function getAll(): Record<string, V> {
    return readStorage<Record<string, V>>(
      storageKey,
      isRecord as (v: unknown) => v is Record<string, V>,
      {},
    )
  }

  function get(key: string): V | undefined {
    return getAll()[key]
  }

  function set(key: string, value: V): void {
    const map = getAll()
    map[key] = value
    writeStorage(storageKey, map)
  }

  function remove(key: string): void {
    const map = getAll()
    delete map[key]
    writeStorage(storageKey, map)
  }

  function has(key: string): boolean {
    return key in getAll()
  }

  return { getAll, get, set, remove, has }
}
