'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { filterByQuery, foldText } from '@/lib/location-api'

export interface SelectOption {
  value: string
  label: string
  /** Shown before the label (a flag). */
  prefix?: string | null
  /** Small text after the label (a code). */
  hint?: string | null
}

/**
 * A searchable single-choice dropdown (the ARIA "select-only combobox with a listbox"):
 *  - a button shows the choice; opening it focuses a search box and lists the options;
 *  - Up / Down / Home / End move, Enter chooses, Escape closes and returns to the button, Tab leaves;
 *  - nothing in it can submit a form: every control is `type="button"` and Enter is handled here;
 *  - with `onQuery` the options come from the server for what was typed (cities); without it the list is filtered here (countries, states).
 * The listing is drawn in place (not in a portal), so it works inside the Region popover.
 */
export function SearchableSelect({
  id,
  label,
  required = false,
  options,
  value,
  onSelect,
  onQuery,
  loading = false,
  error = null,
  helper = null,
  note = null,
  emptyText,
  placeholder,
  searchPlaceholder = 'Search…',
  disabled = false,
  clearable = false,
}: {
  id: string
  label: string
  required?: boolean
  options: SelectOption[]
  /** The current choice. It may be a place that is not in `options` (an older saved region): it is shown as it is. */
  value: SelectOption | null
  onSelect: (option: SelectOption | null) => void
  /** Server-side search: called (by the caller, who debounces) with what was typed. When given, `options` is shown as it is. */
  onQuery?: (query: string) => void
  loading?: boolean
  error?: string | null
  helper?: string | null
  /** A line under the list, e.g. "Showing the first 50 of 309. Type to narrow". */
  note?: string | null
  emptyText: string
  placeholder: string
  searchPlaceholder?: string
  disabled?: boolean
  clearable?: boolean
}) {
  const uid = useId()
  const listId = `${uid}-list`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const shown = useMemo(() => {
    if (onQuery) return options
    return filterByQuery(options, query, (o) => o.label, (o) => o.hint)
  }, [options, query, onQuery])

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (onQuery) onQuery('')
    if (refocus) trigger.current?.focus()
  }, [onQuery])

  // Clicking anywhere else closes it.
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open, close])

  useEffect(() => {
    if (open) search.current?.focus()
  }, [open])

  // The highlighted option is always inside the list (a shorter list clamps it), and kept in view.
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1))
  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, open, listId])

  const choose = (option: SelectOption) => {
    onSelect(option)
    close(true)
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive(Math.min(shown.length - 1, activeIndex + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive(Math.max(0, activeIndex - 1))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(Math.max(0, shown.length - 1))
        break
      case 'Enter':
        event.preventDefault()   // never submits a surrounding form
        if (shown[activeIndex]) choose(shown[activeIndex])
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()   // closes this list, not the Region popover around it
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setOpen(true)
    }
  }

  const describedBy = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined

  return (
    <div ref={root} className="relative space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
          {required && <span aria-hidden className="ml-0.5 text-destructive">*</span>}
        </label>
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onSelect(null)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>

      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-left text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {value ? (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {value.prefix && <span aria-hidden>{value.prefix}</span>}
            <span className="truncate">{value.label}</span>
          </span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        )}
        {loading ? <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      </button>

      {helper && <p id={`${id}-help`} className="text-[11px] text-muted-foreground">{helper}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-[11px] text-destructive">{error}</p>}

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="relative border-b border-border/60 p-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={search}
              type="text"
              role="searchbox"
              aria-label={`Search ${label}`}
              aria-controls={listId}
              aria-activedescendant={shown.length > 0 ? `${listId}-${activeIndex}` : undefined}
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                onQuery?.(event.target.value)
              }}
              onKeyDown={onSearchKey}
              className="h-7 w-full rounded-md border border-input bg-background pl-6 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto py-1">
            {loading && shown.length === 0 && (
              <li role="presentation" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…
              </li>
            )}
            {!loading && shown.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</li>
            )}
            {shown.map((option, index) => {
              const selected = value?.value === option.value
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}   // keep focus in the search box
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${index === activeIndex ? 'bg-accent text-accent-foreground' : ''}`}
                >
                  {option.prefix && <span aria-hidden>{option.prefix}</span>}
                  <span className="truncate">{option.label}</span>
                  {option.hint && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{option.hint}</span>}
                  {selected && <Check className="ml-auto size-3.5 shrink-0 text-primary" aria-hidden />}
                </li>
              )
            })}
          </ul>
          {note && <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  )
}
