'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'
import type { FieldControlProps } from '@/components/shared/scaffolds/form-field'
import { filterOptions, groupOptions, type PickerOption } from '@/lib/workflows/catalog'
import { cn } from '@/lib/utils'

/**
 * A choice from a long list that is grouped and can be searched: the events and the steps of an automation.
 *
 * The list opens in place, under the button, not in a floating layer: it needs no extra focus trap inside the drawer it sits in, it cannot be clipped
 * by the drawer's scrolling body, and it works at a phone width. Typing filters the list (the label, the detail and the group name all count), the arrow
 * keys move through the choices, Enter chooses, and Escape closes the list and nothing else (not the drawer around it). A choice that cannot be made says
 * why, under its name.
 */
export function GroupedPicker({ control, value, options, onChange, placeholder, searchLabel, emptyText = 'Nothing matches that search.', disabled }: {
  control: FieldControlProps
  value: string
  options: readonly PickerOption[]
  onChange: (value: string) => void
  placeholder: string
  searchLabel: string
  emptyText?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const visible = useMemo(() => filterOptions(options, query), [options, query])
  const groups = useMemo(() => groupOptions(visible), [visible])
  const choosable = useMemo(() => visible.filter((o) => !o.disabled), [visible])
  const selected = options.find((o) => o.value === value) ?? null
  const activeOption = choosable[Math.min(active, Math.max(choosable.length - 1, 0))] ?? null
  const optionId = (v: string) => `${listId}-opt-${v.replace(/[^a-zA-Z0-9_-]/g, '_')}`

  const close = (focusTrigger: boolean) => {
    setOpen(false)
    setQuery('')
    setActive(0)
    if (focusTrigger) triggerRef.current?.focus()
  }

  // The search box takes focus when the list opens.
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // Escape closes this list and stops there: the drawer around it must not see it. A listener on the window, in the capture phase, runs before the
  // drawer's own.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      setQuery('')
      setActive(0)
      triggerRef.current?.focus()
    }
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setQuery(''); setActive(0) }
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Keep the highlighted choice in view while the arrow keys move through a long list.
  useEffect(() => {
    if (!open || !activeOption) return
    document.getElementById(optionId(activeOption.value))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeOption?.value])

  const choose = (option: PickerOption) => {
    if (option.disabled) return
    onChange(option.value)
    close(true)
  }

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(0, Math.min(choosable.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (activeOption) choose(activeOption)
    }
  }

  return (
    <div ref={rootRef} className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        {...control}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={cn(
          'flex min-h-8 w-full touch-manipulation items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
          selected ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span className="min-w-0 flex-1 break-words">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-1 space-y-2 rounded-lg border border-border bg-card p-2">
          <SearchInput
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={onSearchKey}
            placeholder="Type to search…"
            aria-label={searchLabel}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={activeOption ? optionId(activeOption.value) : undefined}
            autoComplete="off"
            spellCheck={false}
            name="picker-search"
            icon={<Search className="size-4" aria-hidden="true" />}
          />
          <div id={listId} role="listbox" aria-label={searchLabel} className="max-h-72 overflow-y-auto overscroll-contain">
            {groups.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>}
            {groups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group} className="pb-1">
                <p aria-hidden="true" className="px-2 pb-0.5 pt-2 text-xs font-medium text-muted-foreground">{g.group}</p>
                {g.options.map((option) => {
                  const isActive = activeOption?.value === option.value
                  return (
                    <button
                      key={option.value}
                      id={optionId(option.value)}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={option.value === value}
                      aria-disabled={option.disabled ? true : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                      onMouseMove={() => { const i = choosable.findIndex((o) => o.value === option.value); if (i >= 0 && i !== active) setActive(i) }}
                      className={cn(
                        'flex min-h-8 w-full touch-manipulation items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                        isActive && 'bg-muted',
                        option.disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm text-foreground">{option.label}</span>
                        {option.hint && <span className="block break-words text-xs text-muted-foreground">{option.hint}</span>}
                      </span>
                      {option.value === value && <Check className="mt-0.5 size-4 flex-none text-foreground" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
