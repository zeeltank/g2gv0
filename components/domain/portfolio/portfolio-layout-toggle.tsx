'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { LayoutGrid, List } from 'lucide-react'
import { useUrlTab } from '@/components/shared/scaffolds/use-url-tab'
import { cn } from '@/lib/utils'
import { LAYOUT_PARAM, LAYOUTS, readRememberedLayout, rememberLayout, resolveLayout, type Layout } from '@/lib/portfolio-list/layout'

/*
 * The List | Grid choice of the Product Portfolio. The address holds it (`?layout=grid`, through the same hook the tabs of a page use, which writes only its own
 * parameter, so the search, the filters, the sort and the page ride along), the browser remembers the last choice, and the address wins over the memory.
 */

// One page can draw the choice in two places and a second tab can change it, so the memory is read through a store: a write in this page tells every reader, and the
// browser's own `storage` event tells the other tabs. The server and the first paint of the browser both see "nothing remembered" (the list), so they agree.
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/** The layout to draw and the way to change it. Needs a Suspense boundary above it, like every hook that reads the address. */
export function usePortfolioLayout(): { layout: Layout; setLayout: (next: Layout) => void } {
  const searchParams = useSearchParams()
  const [, setInAddress] = useUrlTab(LAYOUTS, LAYOUT_PARAM)
  const remembered = useSyncExternalStore(subscribe, () => readRememberedLayout(), () => null)
  const layout = resolveLayout(searchParams.get(LAYOUT_PARAM), remembered)

  const setLayout = useCallback((next: Layout) => {
    rememberLayout(next)
    listeners.forEach((listener) => listener())
    setInAddress(next)
  }, [setInAddress])

  return { layout, setLayout }
}

const OPTIONS = [
  { key: 'list', label: 'List', Icon: List },
  { key: 'grid', label: 'Grid', Icon: LayoutGrid },
] as const

/**
 * List or Grid: how the SAME products are drawn. A text label on every button from 1024 px up; below it the icon stands alone, with the name still in its accessible
 * label. The pressed one is told by `aria-pressed`, by a border and by its heavier text, not by colour alone.
 */
export function PortfolioLayoutToggle({ value, onChange }: { value: Layout; onChange: (next: Layout) => void }) {
  return (
    <div role="group" aria-label="Layout" className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5">
      {OPTIONS.map(({ key, label, Icon }) => {
        const pressed = value === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={pressed}
            aria-label={`${label} layout`}
            title={`${label} layout`}
            onClick={() => onChange(key)}
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-md border px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pressed ? 'border-foreground bg-card font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
