'use client'

import * as React from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'

export interface MultiOption {
  value: string
  label: string
  /** A second line — a code, a department, whatever disambiguates. */
  hint?: string | null
}

/**
 * A SEARCHABLE MULTI-SELECT.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `components/ui/searchable-select.tsx` is the same control for ONE value, and
 * the LMS authoring forms need several: a course belongs to more than one
 * department, is aimed at more than one job role, and develops more than one
 * competency. Those fields were plain text inputs, so the data behind them —
 * 266 job roles, a real competency graph — could not be reached from the form.
 *
 * ── WHY IT IS HERE AND NOT IN components/ui ─────────────────────────────────
 *
 * `components/ui/*` is the shared design system and is off limits in this work.
 * This is deliberately built FROM it — SearchInput for the query, the same
 * border/ring/popover/muted tokens, the same combobox and listbox roles, the
 * same arrow/Enter/Escape handling — so it behaves like a native member of that
 * library without modifying it. If it earns promotion later, it moves as-is.
 *
 * MATCHES ON LABEL AND HINT BOTH, so a job role can be found by its department
 * and a competency by its code.
 */
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyMessage = 'No matches',
  disabled = false,
  /** Cap the chips shown before collapsing to "+N more". */
  maxChips = 3,
  className,
  'aria-label': ariaLabel,
}: {
  options: MultiOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  maxChips?: number
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedSet = React.useMemo(() => new Set(values), [values])
  const selected = React.useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) || (option.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  React.useEffect(() => setActive(0), [query, open])

  React.useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  /*
   * Toggling does NOT close the popover.
   *
   * The single-select closes on choose, which is right for one value and wrong
   * for several — picking four departments should not mean opening the list
   * four times.
   */
  const toggle = (option: MultiOption) => {
    onChange(
      selectedSet.has(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value],
    )
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
        listRef.current
          ?.querySelectorAll('[role="option"]')
          [bounded]?.scrollIntoView({ block: 'nearest' })
        return bounded
      })
      return
    }
    if (event.key === 'Enter' && filtered[active]) {
      event.preventDefault()
      toggle(filtered[active])
    }
  }

  const shown = selected.slice(0, maxChips)
  const overflow = selected.length - shown.length

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
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-left text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring/40',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected.length === 0 ? (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {shown.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-[14rem] items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                <span className="truncate">{option.label}</span>
                {/*
                  * A span, not a nested <button> — a button inside the combobox
                  * trigger is invalid HTML and swallows the click that should
                  * open the list.
                  */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${option.label}`}
                  className="shrink-0 rounded-sm text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange(values.filter((v) => v !== option.value))
                  }}
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-xs font-medium text-muted-foreground">+{overflow} more</span>
            )}
          </span>
        )}
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
        />
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

          <div
            ref={listRef}
            role="listbox"
            aria-multiselectable
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((option, index) => {
                const isSelected = selectedSet.has(option.value)

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => toggle(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                      index === active && 'bg-muted',
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-foreground">{option.label}</span>
                      {option.hint && (
                        <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
                      )}
                    </span>
                    {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              <button
                type="button"
                className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
