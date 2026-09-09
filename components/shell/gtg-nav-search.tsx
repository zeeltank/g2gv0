'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeft, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { NavNode } from '@/lib/gtg-navigation'

/**
 * FIND A SCREEN BY NAME.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS HERE BEFORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *     <input type="search" aria-label="Global search" placeholder="Search..." />
 *
 * No `value`, no `onChange`, no `onKeyDown`, no surrounding form, no submit
 * handler. A search box on EVERY SCREEN IN THE PRODUCT that could be typed into
 * and did absolutely nothing - the most-seen dead control in the codebase. It
 * appeared twice, in gtg-header-base and gtg-header, and one of the two
 * placeholders was mojibake.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT SEARCHES THE MENU AND NOT "EVERYTHING"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There is no global search endpoint, and inventing one that reads across
 * employees, courses, tasks and payroll is a feature, not a repair.
 *
 * The navigation tree, however, is ALREADY LOADED on every page and already
 * answers the question people actually use a header search box for: "where is
 * that screen?". The product has 191 menu rows across 8 modules, and finding one
 * by name beats hunting through a collapsed sidebar.
 *
 * ── AND IT CANNOT LEAK ──────────────────────────────────────────────────────
 *
 * The tree comes from `ajax_sidebar_menu_g2g`, filtered SERVER-SIDE to the
 * caller's own rights before it is sent. So this can only ever find screens the
 * person is already allowed to open - there is no client-side filtering to get
 * wrong, and no way to discover that a module exists which somebody has not
 * been granted.
 */

type Hit = {
  id: string
  label: string
  /** "Organizational Management > User Management" - where the screen lives. */
  trail: string
  href: string
}

/** Every node that has somewhere to go, with the path that leads to it. */
function flatten(nodes: NavNode[], trail: string[] = []): Hit[] {
  const hits: Hit[] = []

  for (const node of nodes) {
    if (node.accessLink) {
      hits.push({
        id: node.id,
        label: node.label,
        trail: trail.join(' / '),
        href: node.accessLink,
      })
    }

    if (node.children.length > 0) {
      hits.push(...flatten(node.children, [...trail, node.label]))
    }
  }

  return hits
}

export function GtgNavSearch({ className }: { className?: string }) {
  const router = useRouter()
  const { modules } = useSidebarNavigation()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const all = useMemo(() => flatten(modules), [modules])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (needle.length < 2) return []

    // Screens whose NAME matches come first; a match only in the trail is a
    // weaker answer and must not push a directly-named screen down the list.
    const byLabel: Hit[] = []
    const byTrail: Hit[] = []

    for (const hit of all) {
      if (hit.label.toLowerCase().includes(needle)) {
        byLabel.push(hit)
      } else if (hit.trail.toLowerCase().includes(needle)) {
        byTrail.push(hit)
      }
    }

    return [...byLabel, ...byTrail].slice(0, 8)
  }, [all, query])

  useEffect(() => {
    if (!open) return

    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function go(hit: Hit) {
    setOpen(false)
    setQuery('')
    router.push(hit.href)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((current) => (current + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) => (current - 1 + results.length) % results.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      go(results[highlighted])
    }
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className={cn('relative flex w-full max-w-md items-center', className)}>
      <Search
        className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="nav-search-results"
        aria-label="Find a screen"
        placeholder="Find a screen..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          // Reset the highlight HERE rather than in an effect keyed on `query`.
          // Typing is the thing that invalidates the selection, so the handler
          // that owns the keystroke is where it belongs - and it avoids the
          // extra render pass an effect would cause on every character.
          setHighlighted(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          'h-10 w-full rounded-md border border-input bg-surface-muted pl-9 pr-3 text-[15px] text-foreground transition-colors duration-200 outline-none',
          'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      />

      {showPanel && (
        <div
          id="nav-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No screen matches that.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((hit, index) => (
                <li key={`${hit.id}-${hit.href}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => go(hit)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      index === highlighted ? 'bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {hit.label}
                      </span>
                      {hit.trail && (
                        <span className="truncate text-xs text-muted-foreground">{hit.trail}</span>
                      )}
                    </span>
                    {index === highlighted && (
                      <CornerDownLeft
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
