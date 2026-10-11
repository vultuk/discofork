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
  /** Optional lookup compatibility; stored keys and existing records stay unchanged. */
  normalizeKey?: (key: string) => string
}

type MapStoreOptions = {
  storageKey: string
  normalizeKey?: (key: string) => string
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
  const { storageKey, keyOf, createEntry, normalizeKey = (key: string) => key } = options

  function getAll(): T[] {
    return readStorage<T[]>(storageKey, isArray as (v: unknown) => v is T[], [])
  }

  function findByFullName(fullName: string): T | undefined {
    return getAll().find((entry) => normalizeKey(keyOf(entry)) === normalizeKey(fullName))
  }

  function has(fullName: string): boolean {
    return Boolean(findByFullName(fullName))
  }

  function add(owner: string, repo: string): T {
    const items = getAll()
    const fullName = `${owner}/${repo}`
    const existing = items.find((entry) => normalizeKey(keyOf(entry)) === normalizeKey(fullName))
    if (existing) {
      return existing
    }

    const entry = createEntry(owner, repo)
    writeStorage(storageKey, [...items, entry])
    return entry
  }

  function remove(fullName: string): void {
    const items = getAll().filter((entry) => normalizeKey(keyOf(entry)) !== normalizeKey(fullName))
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
  const { storageKey, normalizeKey = (key: string) => key } = options

  function getAll(): Record<string, V> {
    return readStorage<Record<string, V>>(
      storageKey,
      isRecord as (v: unknown) => v is Record<string, V>,
      {},
    )
  }

  function storedKey(map: Record<string, V>, key: string): string {
    if (Object.hasOwn(map, key)) {
      return key
    }
    return Object.keys(map).find((stored) => normalizeKey(stored) === normalizeKey(key)) ?? key
  }

  function get(key: string): V | undefined {
    const map = getAll()
    return map[storedKey(map, key)]
  }

  function set(key: string, value: V): void {
    const map = getAll()
    map[storedKey(map, key)] = value
    writeStorage(storageKey, map)
  }

  function remove(key: string): void {
    const map = getAll()
    delete map[storedKey(map, key)]
    writeStorage(storageKey, map)
  }

  function has(key: string): boolean {
    const map = getAll()
    return Object.hasOwn(map, storedKey(map, key))
  }

  return { getAll, get, set, remove, has }
}
