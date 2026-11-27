/**
 * The List | Grid choice of the Product Portfolio, as plain functions (27 Nov 2026). The address names it (`?layout=grid`, read by `useUrlTab(LAYOUTS, 'layout')`, so a
 * link opens the same layout and the filters, the sort and the page ride along untouched), the browser remembers the last choice, and the list is the default.
 * The address wins over the memory: a link someone sent you opens the way they meant it. Storage can be absent or refuse (a private window, blocked site data),
 * so every read and write is guarded and the screen works without it.
 */

export const LAYOUTS = ['list', 'grid'] as const
export type Layout = (typeof LAYOUTS)[number]

export const DEFAULT_LAYOUT: Layout = 'list'
/** The address parameter. It is not one of the list query's filters, so the list's own address rules and tests are not disturbed. */
export const LAYOUT_PARAM = 'layout'
export const LAYOUT_STORAGE_KEY = 'portfolio-list-layout'

export function isLayout(value: unknown): value is Layout {
  return value === 'list' || value === 'grid'
}

/** The layout to draw: the one the address names, else the one this browser remembered, else the list. Anything that is not a layout counts as nothing named. */
export function resolveLayout(named: string | null | undefined, remembered: string | null | undefined): Layout {
  if (isLayout(named)) return named
  if (isLayout(remembered)) return remembered
  return DEFAULT_LAYOUT
}

export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The browser's own storage, or null where there is none (the server) or the browser refuses to hand it over. */
function browserStorage(): LayoutStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The layout this browser remembered, or null when it remembered none, held something else, or cannot be asked. */
export function readRememberedLayout(storage: LayoutStorage | null = browserStorage()): Layout | null {
  try {
    const value = storage?.getItem(LAYOUT_STORAGE_KEY)
    return isLayout(value) ? value : null
  } catch {
    return null
  }
}

/** Remembers the choice. Answers whether it was kept: a refusing browser is not an error, the choice then lasts for this visit only. */
export function rememberLayout(layout: Layout, storage: LayoutStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(LAYOUT_STORAGE_KEY, layout)
    return true
  } catch {
    return false
  }
}
