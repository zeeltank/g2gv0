'use client'

import { useId, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { addCustom, customEntries, removeEntry, toggle } from '@/lib/product-form'
import type { ProductChoice } from '@/lib/portfolio/form-model'
import { toggleOffer } from '@/lib/portfolio/form-model'

export interface TickOption { code: string; label: string; detail?: string; title?: string }

/**
 * A tickable list with an "Other" box: the person ticks from the list or types their own entry, which is kept with the ticked ones. Entries from an older
 * list (`legacy`) that the record already carries stay visible and removable. The same control the Portfolio's own form has always had.
 */
export function TickList({ legend, hint, options, legacy = {}, value, onChange, disabled, otherLabel, error }: {
  legend: string
  hint: string
  options: TickOption[]
  legacy?: Record<string, string>
  value: string[]
  onChange: (next: string[]) => void
  disabled: boolean
  otherLabel: string
  error?: string
}) {
  const [draft, setDraft] = useState('')
  const hintId = useId()
  const known = options.map((o) => o.code)
  const older = value.filter((v) => !known.includes(v) && v in legacy)
  const own = customEntries(value, [...known, ...Object.keys(legacy)])
  const add = () => { onChange(addCustom(value, draft)); setDraft('') }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={hintId}>
      <legend className="mb-0.5 text-sm font-medium text-foreground">{legend}</legend>
      <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
        {options.map((o) => (
          <label key={o.code} title={o.title} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted/50">
            <input type="checkbox" className="mt-1" checked={value.includes(o.code)} disabled={disabled} onChange={() => onChange(toggle(value, o.code))} />
            <span className="min-w-0 break-words">
              {o.label}
              {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
            </span>
          </label>
        ))}
        {options.length === 0 && <p className="text-xs text-muted-foreground">No choices are available. Use Other to add your own.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={otherLabel}
          placeholder={otherLabel}
          value={draft}
          disabled={disabled}
          maxLength={160}
          className="min-w-0 flex-1"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" size="sm" variant="outline" disabled={disabled || draft.trim() === ''} onClick={add}><Plus className="mr-1 size-3.5" aria-hidden="true" />Add</Button>
      </div>
      {(own.length > 0 || older.length > 0) && (
        <ul aria-label={`${legend}: your own and older entries`} className="flex flex-wrap gap-1.5">
          {own.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
              <span className="min-w-0 break-words">{e}</span>
              {!disabled && <button type="button" aria-label={`Remove ${e}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeEntry(value, e))}><X className="size-3" aria-hidden="true" /></button>}
            </li>
          ))}
          {older.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground" title="An older code this record already carries">
              <span className="min-w-0 break-words">{legacy[e]} (older)</span>
              {!disabled && <button type="button" aria-label={`Remove ${legacy[e]}`} className="rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeEntry(value, e))}><X className="size-3" aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
    </fieldset>
  )
}

/**
 * "Often sold together": the other Sub-products, found by name or ID and ticked. It stores the IDs of the Sub-products (the server checks that each one exists
 * and is not this one). A stored ID whose Sub-product is no longer in the list stays visible and removable, so nothing is dropped silently.
 */
export function SubProductMultiSelect({ legend, hint, choices, ownOfferId, value, onChange, disabled, error }: {
  legend: string
  hint: string
  choices: readonly ProductChoice[]
  /** This record's own ID, which cannot be its own companion. */
  ownOfferId: string
  value: string[]
  onChange: (next: string[]) => void
  disabled: boolean
  error?: string
}) {
  const [filter, setFilter] = useState('')
  const filterId = useId()
  const hintId = useId()
  const all = useMemo(() => choices.flatMap((p) => p.subProducts
    .filter((s) => s.offerId !== null && s.offerId !== ownOfferId && s.status === 'active')
    .map((s) => ({ offerId: s.offerId as string, name: s.name, product: p.name }))), [choices, ownOfferId])
  const needle = filter.trim().toLowerCase()
  const shown = needle === '' ? all : all.filter((s) => `${s.name} ${s.offerId} ${s.product}`.toLowerCase().includes(needle))
  const nameOf = (offerId: string) => all.find((s) => s.offerId === offerId)?.name

  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={hintId}>
      <legend className="mb-0.5 text-sm font-medium text-foreground">{legend}</legend>
      <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      <Input id={filterId} aria-label="Find a sub-product" placeholder="Find a sub-product by name or ID" value={filter} disabled={disabled} onChange={(e) => setFilter(e.target.value)} />
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
        {shown.map((s) => (
          <label key={s.offerId} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted/50">
            <input type="checkbox" className="mt-1" checked={value.includes(s.offerId)} disabled={disabled} onChange={() => onChange(toggleOffer(value, s.offerId))} />
            <span className="min-w-0 break-words">{s.name} <span className="text-xs text-muted-foreground">({s.offerId}, {s.product})</span></span>
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-muted-foreground">{all.length === 0 ? 'There are no other sub-products yet.' : 'No sub-product matches.'}</p>}
      </div>
      {value.length > 0 && (
        <ul aria-label="Sold together with" className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
              <span className="min-w-0 break-words">{nameOf(id) ? `${nameOf(id)} (${id})` : id}</span>
              {!disabled && <button type="button" aria-label={`Remove ${nameOf(id) ?? id}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onChange(removeEntry(value, id))}><X className="size-3" aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className={`text-xs ${FIELD_ERROR_TEXT}`}>{error}</p>}
    </fieldset>
  )
}
