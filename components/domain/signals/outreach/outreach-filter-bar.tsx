'use client'

import { useId } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FILTER_KEYS, FILTER_LABEL, FILTER_NOTE, filterOptions, filtersActive, type FilterKey } from '@/lib/signals/outreach-model'
import type { OutreachFacets, OutreachFilters } from '@/services/signals/outreach-types'

/**
 * The four filters of the Outreach tab: Product, Sub-product, ICP and Region. The same bar sits on Companies, All people and Messages and reads the same address, so the
 * three screens always narrow together. Each select starts at "All ...", lists the server's options as "Name (count)" with the rows each would show, and ends with "Not recorded (count)"
 * for the rows that have nothing recorded, because most signals lack one or more of these and a short list should not read as a broken filter. The Sub-product list shows
 * the chosen product's sub-products only, and choosing another product clears a sub-product that does not belong to it (the model keeps that rule).
 *
 * The lists are the shared Select: it adds a search box once a list has eight options or more, so the Region list (the longest) can be typed into and the short ones stay plain.
 * On a phone the four stack in one column; they widen to two and then four as the page does (the container decides, not the screen).
 *
 * `facets` are the options the server counted for the list that is on screen; without them (not read yet) the selects offer only "All ...". `onChange` gets the filter that changed.
 */
export function OutreachFilterBar({ filters, facets, onChange, onClear }: {
  filters: OutreachFilters
  facets: OutreachFacets | null | undefined
  onChange: (patch: Partial<Record<FilterKey, string>>) => void
  onClear: () => void
}) {
  const noteId = useId()

  return (
    <div className="@container/filters space-y-2">
      <div role="group" aria-label="Filter by product, sub-product, ICP and region" aria-describedby={noteId} data-outreach-filters className="grid grid-cols-1 gap-3 @lg/filters:grid-cols-2 @3xl/filters:grid-cols-4">
        {FILTER_KEYS.map((key) => (
          <div key={key} className="min-w-0 space-y-1">
            {/* The select's own name is the same word; this copy is for the eye, so a screen reader does not hear it twice. */}
            <span aria-hidden="true" className="block text-xs font-medium text-muted-foreground">{FILTER_LABEL[key]}</span>
            <Select
              aria-label={FILTER_LABEL[key]}
              value={filters[key] ?? ''}
              options={filterOptions(key, facets, filters)}
              onChange={(value) => onChange({ [key]: value })}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p id={noteId} className="text-xs text-muted-foreground">{FILTER_NOTE}</p>
        {filtersActive(filters) && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1.5 size-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
