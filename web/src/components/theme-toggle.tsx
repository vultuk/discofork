"use client"

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { applyThemeToDocument, isThemeMode, resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme, type ThemeMode } from "@/lib/theme"
import { cn } from "@/lib/utils"

const themeOptions: Array<{
  value: ThemeMode
  label: string
  icon: LucideIcon
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("system")
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light")
  const initializedRef = useRef(false)

  useIsomorphicLayoutEffect(() => {
    try {
      if (!initializedRef.current) {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
        const nextTheme = isThemeMode(storedTheme) ? storedTheme : "system"
        const nextSystemTheme: ResolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

        setTheme(nextTheme)
        setSystemTheme(nextSystemTheme)
        applyThemeToDocument(nextTheme, nextSystemTheme)
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
        initializedRef.current = true
        return
      }

      applyThemeToDocument(theme, systemTheme)
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore storage or matchMedia failures and fall back to the stylesheet default.
    }
  }, [systemTheme, theme])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    const updateSystemTheme = () => {
      setSystemTheme(media.matches ? "dark" : "light")
    }

    updateSystemTheme()
    media.addEventListener("change", updateSystemTheme)

    return () => {
      media.removeEventListener("change", updateSystemTheme)
    }
  }, [])

  const activeResolvedTheme = resolveTheme(theme, systemTheme)

  return (
    <div
      role="group"
      aria-label="Theme mode"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm"
    >
      {themeOptions.map(({ value, label, icon: Icon }) => {
        const active = theme === value

        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title={value === "system" ? `System (${activeResolvedTheme})` : label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
