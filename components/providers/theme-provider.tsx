'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Theme } from '@/services/account'

/**
 * APPLIES THE THEME. Nothing ever has.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A COMPLETE DARK PALETTE, WIRED TO NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `app/globals.css:5` declares `@custom-variant dark (&:is(.dark *))`, `:116`
 * defines the whole dark token set — around forty variables covering
 * background, card, popover, surface, primary, success, warning, destructive —
 * and `components/ui/*` is peppered with `dark:` variants.
 *
 * And a search across `app/ components/ lib/ hooks/ services/` for `classList`,
 * `documentElement`, `next-themes`, `ThemeProvider`, `useTheme`, `setTheme` and
 * `prefers-color-scheme` returned **zero hits**. The palette was authored,
 * shipped, and never once applied. `<html>` is hardcoded `className="bg-background"`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE STATES, NOT TWO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   light   the class is removed
 *   dark    the class is added
 *   system  FOLLOW THE OPERATING SYSTEM, and keep following it
 *
 * `system` is the default and it is not a synonym for light. It listens for
 * changes, so somebody whose machine switches at sunset does too — a snapshot
 * taken once at load would be right in the morning and wrong by evening.
 *
 * ── WHY IT WRITES localStorage TOO ──────────────────────────────────────────
 *
 * The server is the source of truth: the choice lives in `user_preferences` and
 * follows the person to any device. But the preference arrives one API call
 * after first paint, and a light flash before a dark screen is the exact
 * annoyance people install extensions to avoid.
 *
 * So the last-known value is mirrored locally purely as a paint hint. It is
 * never read as the answer — `applyTheme` from the server always wins — and it
 * is not a second store, because nothing ever asks it what the preference IS.
 */

const STORAGE_KEY = 'gtg-theme'

type ThemeContextValue = {
  theme: Theme
  /** What is actually on screen right now — `system` resolved. */
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

/**
 * NULL, NOT A NO-OP DEFAULT.
 *
 * This provider was once imported into `app/layout.tsx` and never rendered. A
 * default value of `{ setTheme: () => {} }` made that completely silent: the
 * theme picker highlighted itself, saved the preference to the server, and
 * repainted nothing. It type-checked, it linted, it built, and it was dead.
 *
 * `null` plus the throw in `useTheme()` turns that into an immediate, obvious
 * failure the first time the page renders. A provider that is not mounted is a
 * bug, never a fallback.
 */
const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** The one place the class is added or removed. */
function paint(theme: Theme): 'light' | 'dark' {
  const resolved = theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme

  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    // So native controls — scrollbars, form widgets, the caret — match.
    document.documentElement.style.colorScheme = resolved
  }

  return resolved
}

function readStoredHint(): Theme {
  if (typeof window === 'undefined') return 'system'

  try {
    const value = window.localStorage.getItem(STORAGE_KEY)

    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    // A browser with site data blocked is not a reason to render nothing.
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  // The paint hint, applied before any API call resolves.
  //
  // Deferred by a microtask so the mount render is not immediately followed by
  // a second one - `react-hooks/set-state-in-effect` is right that a synchronous
  // setState here cascades, and the class is put on <html> either way.
  useEffect(() => {
    queueMicrotask(() => {
      const hint = readStoredHint()
      setThemeState(hint)
      setResolved(paint(hint))
    })
  }, [])

  /*
   * `system` is a subscription, not a snapshot. Without this, choosing "system"
   * would freeze whatever the OS happened to be at page load and stay there
   * until a reload.
   */
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolved(paint('system'))

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    setResolved(paint(next))

    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Paint hint only. Losing it costs one frame on the next load.
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (context === null) {
    throw new Error(
      'useTheme() was called outside <ThemeProvider>. It belongs in app/layout.tsx, wrapping everything.',
    )
  }

  return context
}
