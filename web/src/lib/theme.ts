export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "discofork-theme" as const

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

export function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === "system" ? systemTheme : mode
}

export function applyThemeToDocument(mode: ThemeMode, systemTheme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return
  }

  const resolvedTheme = resolveTheme(mode, systemTheme)
  const root = document.documentElement

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme
}

export function buildThemeBootstrapScript(storageKey: string = THEME_STORAGE_KEY): string {
  return `(() => {
    try {
      const key = ${JSON.stringify(storageKey)};
      const storedTheme = localStorage.getItem(key);
      const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const resolvedTheme = theme === "system" ? systemTheme : theme;
      const root = document.documentElement;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.dataset.theme = resolvedTheme;
      root.style.colorScheme = resolvedTheme;
    } catch {
      // Ignore storage or matchMedia failures and fall back to the stylesheet default.
    }
  })();`
}
