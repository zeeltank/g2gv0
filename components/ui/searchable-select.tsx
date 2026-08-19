'use client'

import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from './search-input'

export interface SearchableOption {
  value: string
  label: string
  /** Optional second line — a code, a category, whatever disambiguates. */
  hint?: string | null
}

/**
 * A SELECT YOU CAN TYPE INTO — one primitive, four call sites.
 *
 * The competency pickers all choose from lists that grew past what a plain
 * <select> can be used with: one tenant already holds 199 competencies, and
 * scrolling to find one by eye is not a workflow. Every mapping form needs the
 * same control, so it lives here rather than being written four times slightly
 * differently.
 *
 * BUILT FROM WHAT ALREADY EXISTS: SearchInput for the query, the same border,
 * ring, popover and muted tokens the rest of the system uses. No new visual
 * language, and no dependency added.
 *
 * MATCHES ON LABEL AND HINT BOTH, so "ITOPS-01" finds a competency the user
 * knows by code rather than by name.
 *
 * ACCESSIBILITY: combobox/listbox roles, arrow-key navigation, Enter to choose,
 * Escape to close, and focus returns to the trigger on close.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyMessage = 'No matches',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value) ?? null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || (option.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  // Reset the highlight whenever the visible set changes, so Enter never picks
  // a row that scrolled out of the filter.
  React.useEffect(() => setActive(0), [query, open])

  // Close on outside click and on Escape.
  React.useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (option: SearchableOption) => {
    onChange(option.value)
    setOpen(false)
    setQuery('')
    triggerRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1
        const bounded = Math.max(0, Math.min(filtered.length - 1, next))
        listRef.current?.querySelectorAll('[role="option"]')[bounded]?.scrollIntoView({ block: 'nearest' })
        return bounded
      })
      return
    }
    if (event.key === 'Enter' && filtered[active]) {
      event.preventDefault()
      choose(filtered[active])
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring/40',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
          onKeyDown={onKeyDown}
        >
          <div className="border-b border-border/60 p-2">
            <SearchInput
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full"
            />
          </div>

          <div ref={listRef} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    index === active && 'bg-muted',
                    option.value === value && 'text-primary',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-[11px] text-muted-foreground">{option.hint}</span>
                    )}
                  </span>
                  {option.value === value && <Check className="size-4 shrink-0" />}
                </button>
              ))
            )}
          </div>

          {/* Says how much of the list you are actually looking at - a filtered
              view that hides its own truncation is how a missing option reads
              as a missing record. */}
          {options.length > 0 && (
            <div className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
              {filtered.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
