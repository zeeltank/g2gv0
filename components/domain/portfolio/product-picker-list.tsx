'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { contextLabel, cutMessage, emptyMessage, groupByProduct, isSelectable, priceText, rowKey, rowTag, valueKey, type PickerFailure } from '@/lib/product-picker/model'
import { FAILURE, FOOTER, GROUP_HEADING, LIST, MESSAGE, RETRY, ROW, ROW_ACTIVE, ROW_QUIET, ROW_UNAVAILABLE, STATE_WORD } from '@/lib/product-picker/tones'
import type { PickerRow, PickerScope } from '@/services/product-master/picker-service'

/**
 * The inside of the Sub-product picker's list: the rows grouped by the Product above them (Product › Sub-product), each with its SKU and, when the server sent
 * one, its price; and the messages for loading, nothing found, a cut list and a failure with Retry. Presentational: the box owns the state and the requests.
 * A row that is listed but cannot be put on a document (paused, or not sold in CRM) carries its tag, is not chosen by a click and is skipped by the keyboard,
 * unless the box was told that its form can store such a row (`notSoldSelectable`).
 */
export function PickerList({ rows, text, scope, notSoldSelectable, limit, loading, failure, activeIndex, selectedKey, baseId, onChoose, onHover, onRetry }: {
  rows: readonly PickerRow[]
  /** What was searched for (empty for the opening list). */
  text: string
  scope: PickerScope
  notSoldSelectable: boolean
  limit: number
  loading: boolean
  failure: PickerFailure | null
  activeIndex: number
  selectedKey: string
  baseId: string
  onChoose: (row: PickerRow) => void
  onHover: (index: number) => void
  onRetry: () => void
}) {
  const groups = groupByProduct(rows)
  // The index of each group's first row in the one flat list the keyboard walks.
  const starts = groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.rows.length, 0))
  const cut = cutMessage(rows.length, limit)

  return (
    <>
      {failure && (
        <div role="alert" data-picker-failure={failure.kind} className={FAILURE}>
          <span>{failure.message}</span>
          {failure.kind === 'error' && <button type="button" onClick={onRetry} className={RETRY}>Retry</button>}
        </div>
      )}

      {groups.length > 0 && (
      <div role="listbox" id={`${baseId}-list`} aria-label="Sub-products" aria-busy={loading} className={LIST}>
        {groups.map((group, groupIndex) => (
          <div key={group.title} role="group" aria-labelledby={`${baseId}-group-${groupIndex}`}>
            <div id={`${baseId}-group-${groupIndex}`} role="presentation" className={GROUP_HEADING}>{group.title}</div>
            {group.rows.map((row, rowIndex) => {
              const index = starts[groupIndex] + rowIndex
              const price = priceText(row.unitPrice, row.currency)
              const selected = row.crmProductId !== null && valueKey(row.crmProductId) === selectedKey
              const selectable = isSelectable(row, notSoldSelectable)
              const tag = rowTag(row)
              return (
                <div
                  key={rowKey(row)}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={selectable ? undefined : true}
                  data-picker-option={rowKey(row)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={selectable ? () => onHover(index) : undefined}
                  onClick={selectable ? () => onChoose(row) : undefined}
                  className={cn(ROW, selectable ? 'cursor-pointer' : ROW_UNAVAILABLE, selectable && index === activeIndex && ROW_ACTIVE)}
                  title={contextLabel(row)}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{row.name}</span>
                    {row.sku && <span className={ROW_QUIET} data-picker-sku>{row.sku}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {tag && <span className={STATE_WORD} data-picker-tag>{tag}</span>}
                    {price && <span className="whitespace-nowrap text-xs" data-picker-price>{price}</span>}
                    {selected && <Check className="size-4" aria-hidden="true" />}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      )}

      {rows.length === 0 && !failure && (
        <p role="status" className={MESSAGE} data-picker-message={loading ? 'loading' : 'empty'}>{loading ? 'Searching…' : emptyMessage(text, scope)}</p>
      )}
      {rows.length > 0 && loading && <p role="status" className={FOOTER}>Searching…</p>}
      {cut && !loading && <p className={FOOTER} data-picker-cut>{cut}</p>}
    </>
  )
}
