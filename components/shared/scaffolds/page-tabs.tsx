'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageTab {
  id: string
  label: string
  /** A number shown after the label, for example how many price books list the item. */
  count?: number | null
}

export const tabButtonId = (prefix: string, id: string) => `${prefix}-tab-${id}`
export const tabPanelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

/**
 * The tabs of a detail page, following the WAI-ARIA tabs pattern: one tab in the tab order, the arrow keys, Home and End move between tabs, and each tab
 * is linked to its panel. `idPrefix` must be unique on the page. Pair it with <TabPanel>.
 */
export function PageTabs({ tabs, active, onChange, label, idPrefix }: {
  tabs: readonly PageTab[]
  active: string
  onChange: (id: string) => void
  /** Names the group of tabs for a screen reader, for example "Product sections". */
  label: string
  idPrefix: string
}) {
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})

  const go = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    if (!next) return
    onChange(next.id)
    buttons.current[next.id]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const target =
      event.key === 'ArrowRight' ? index + 1
        : event.key === 'ArrowLeft' ? index - 1
          : event.key === 'Home' ? 0
            : event.key === 'End' ? tabs.length - 1
              : null
    if (target === null) return
    event.preventDefault()
    go(target)
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={(el) => { buttons.current[tab.id] = el }}
            type="button"
            role="tab"
            id={tabButtonId(idPrefix, tab.id)}
            aria-selected={selected}
            // The label and the count are two inline spans with no space between them, so the tab's name read "Signals0". A name with the space, which still
            // contains the visible label.
            aria-label={tab.count !== undefined && tab.count !== null ? `${tab.label} ${tab.count}` : undefined}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && <span className="ml-1.5 text-xs text-muted-foreground">{tab.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** The panel of one tab. Its content is built only while the tab is open, so a tab that loads data loads it when it is opened. */
export function TabPanel({ id, active, idPrefix, children }: { id: string; active: string; idPrefix: string; children: ReactNode }) {
  const open = id === active
  return (
    <div role="tabpanel" id={tabPanelId(idPrefix, id)} aria-labelledby={tabButtonId(idPrefix, id)} hidden={!open} tabIndex={0} className="outline-none">
      {open ? children : null}
    </div>
  )
}
