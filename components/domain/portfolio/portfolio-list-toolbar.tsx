'use client'

import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/shared/scaffolds/form-field'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import type { ListQuery } from '@/components/shared/scaffolds/list-query'
import { PER_PAGE_LABELS, productChoices, readinessChoices, SOLD_CHOICES, STATUS_CHOICES, TYPE_CHOICES, type Choice } from '@/lib/portfolio-list/query'

/** A labelled native select: it takes the label wiring, and these lists are short. */
function Facet({ label, value, choices, onChange }: { label: string; value: string; choices: readonly Choice[]; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex min-w-[9rem] max-w-[12rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}

/**
 * The search and the five filters (Product, Type, Sold in CRM, Readiness, Status), kept in the address by the screen around it. They wrap, so a narrow screen
 * never scrolls sideways. "Sold in CRM" is drawn only for a caller who may open the Products screen (the mock-up shows it to no one else).
 */
export function PortfolioListToolbar({ query, lines, readinessWords, canViewSell, narrowed, onSearch, onFilter, onClear }: {
  query: ListQuery
  lines: ReadonlyArray<{ id: number; name: string }>
  readinessWords: readonly string[]
  canViewSell: boolean
  narrowed: boolean
  onSearch: (q: string) => void
  onFilter: (name: string, value: string) => void
  onClear: () => void
}) {
  const f = query.filters
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:min-w-[14rem] sm:max-w-sm sm:flex-1">
        <ListSearch value={query.q} onSearch={onSearch} placeholder={canViewSell ? 'Search by name, ID, SKU or product number…' : 'Search by name or ID…'} label="Search the portfolio" />
      </div>
      <Facet label="Product" value={f.product ?? ''} choices={productChoices(lines, f.product ?? '')} onChange={(v) => onFilter('product', v)} />
      <Facet label="Type" value={f.type} choices={TYPE_CHOICES} onChange={(v) => onFilter('type', v)} />
      {canViewSell && <Facet label="Sold in CRM" value={f.sold} choices={SOLD_CHOICES} onChange={(v) => onFilter('sold', v)} />}
      <Facet label="Readiness" value={f.readiness ?? ''} choices={readinessChoices(readinessWords, f.readiness ?? '')} onChange={(v) => onFilter('readiness', v)} />
      <Facet label="Status" value={f.status} choices={STATUS_CHOICES} onChange={(v) => onFilter('status', v)} />
      <Facet label="Page size" value={f.per} choices={PER_PAGE_LABELS} onChange={(v) => onFilter('per', v)} />
      {narrowed && <Button type="button" variant="outline" onClick={onClear}>Clear filters</Button>}
    </div>
  )
}
