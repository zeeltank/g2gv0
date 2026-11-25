'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'
import { failureOf, firstSelectable, groupByProduct, isSelectable, limitFor, moveAmongSelectable, notOfferedWords, pickedFromRow, searchText, SEARCH_DEBOUNCE_MS, valueKey, withoutExcluded, type PickedSubProduct, type PickerFailure } from '@/lib/product-picker/model'
import { describeCrmProduct, rememberCrmProduct } from '@/lib/product-picker/resolver'
import { BOX, BOX_EMPTY, POPOVER, RETRY, STATE_WORD } from '@/lib/product-picker/tones'
import { productPickerService, type DescribedProduct, type PickerRow, type PickerScope, type PickerType } from '@/services/product-master/picker-service'
import { PickerList } from './product-picker-list'

export { ProductPicker } from './product-picker-level-one'

export interface SubProductPickerProps {
  /** The catalogue id the document holds (the documents store it as a string); null, blank or 0 means nothing chosen. */
  value: string | number | null | undefined
  /** Called with what the person chose (the id as the documents store it, the price, the currency, the default tax rate), or null when they cleared it. */
  onChange: (picked: PickedSubProduct | null) => void
  /** Only products or only services; none asks for every kind the person may view prices of (one request, not two). */
  type?: PickerType
  /**
   * Which Sub-products are listed. `sold` (the default) is what every caller has always had: the ones a document may sell. `all` also lists the ones that are paused
   * or not sold in CRM, each tagged, so a person sees every Sub-product; they cannot be chosen unless `notSoldSelectable` is set.
   */
  scope?: PickerScope
  /**
   * A listed row that is not sold can be chosen. Off by default: the documents, tickets, assets and FAQs store the id of the entry in CRM, and a
   * Sub-product that is not sold has none. A form that can store something else for it (the Sub-product's own id, `picked.masterId`) turns it on; the chosen row
   * then has an empty `productId` and a null `crmProductId`. The one list of which form does what is lib/product-picker/consumer-rules.ts.
   */
  notSoldSelectable?: boolean
  /** Put on the box so a `<Label htmlFor>` names it. */
  id?: string
  /** Names the box when no `<label>` does. */
  'aria-label'?: string
  placeholder?: string
  disabled?: boolean
  /** Adds a Clear button inside the list, for a field that may be left empty. */
  clearable?: boolean
  /** Catalogue ids the form already holds: they are not offered again. */
  excluded?: ReadonlySet<string>
  className?: string
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'
type NameState = { key: string; described: DescribedProduct | null; failed: boolean }

/**
 * THE Sub-product picker: every document line, ticket, asset and FAQ that chooses something to sell uses this one component (slice 15, P3-C).
 * It searches as the person types (one request after a short pause, an older answer never replaces a newer one), groups the rows by their Product, shows the
 * SKU and (only when the server sent one) the price, and hands back the CATALOGUE id the documents store. A value a document already holds that the list no
 * longer offers (paused, in the Recycle Bin) is read by name, never drawn blank.
 */
export function SubProductPicker({ value, onChange, type, scope = 'sold', notSoldSelectable = false, id, 'aria-label': ariaLabel, placeholder = 'Pick a Sub-product', disabled = false, clearable = false, excluded, className }: SubProductPickerProps) {
  const baseId = useId()
  const key = valueKey(value)
  const hidden = useMemo(() => excluded ?? new Set<string>(), [excluded])
  const limit = limitFor(hidden.size)

  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [settled, setSettled] = useState('')
  const [rows, setRows] = useState<PickerRow[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [failure, setFailure] = useState<PickerFailure | null>(null)
  const [active, setActive] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [openAbove, setOpenAbove] = useState(false)
  const [name, setName] = useState<NameState>({ key: '', described: null, failed: false })

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sequence = useRef(0)

  // The name of what the document holds. A value this picker just chose is already known; any other (a saved document, a paused Sub-product) is read once.
  useEffect(() => {
    if (key === '') return
    let current = true
    describeCrmProduct(key)
      .then((described) => { if (current) setName({ key, described, failed: false }) })
      .catch(() => { if (current) setName({ key, described: null, failed: true }) })
    return () => { current = false }
  }, [key])

  // The search. Each run takes a number; only the newest run may write its answer, so a slow answer to an earlier text can never replace a later one.
  useEffect(() => {
    if (!open) return
    const run = ++sequence.current
    queueMicrotask(() => { if (run === sequence.current) setPhase('loading') })
    productPickerService.search({ type, q: settled, limit, scope })
      .then((response) => {
        if (run !== sequence.current) return
        const answered = Array.isArray(response.data) ? response.data : []
        setRows(answered)
        setFailure(null)
        setActive(firstSelectable(answered.map((row) => isSelectable(row, notSoldSelectable))))
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (run !== sequence.current) return
        setFailure(failureOf(error))
        setPhase('error')
      })
    return () => { sequence.current += 1 }
  }, [open, settled, type, scope, notSoldSelectable, limit, attempt])

  // The pause after the last key before the text becomes a search.
  useEffect(() => {
    if (!open) return
    const text = searchText(typed)
    if (text === settled) return
    const timer = setTimeout(() => setSettled(text), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [open, typed, settled])

  useLayoutEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom
    setOpenAbove(below < 320 && rect.top > below)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const visible = useMemo(() => withoutExcluded(rows, hidden), [rows, hidden])
  const ordered = useMemo(() => groupByProduct(visible).flatMap((group) => group.rows), [visible])
  const selectable = useMemo(() => ordered.map((row) => isSelectable(row, notSoldSelectable)), [ordered, notSoldSelectable])

  const openList = () => {
    setTyped('')
    setSettled('')
    setRows([])
    setFailure(null)
    setPhase('loading')
    setOpen(true)
  }
  const close = useCallback((focus: boolean) => {
    setOpen(false)
    if (focus) triggerRef.current?.focus()
  }, [])

  const choose = (row: PickerRow) => {
    const picked = pickedFromRow(row)
    // A row with no entry in CRM has no id to remember it by: the box then shows whatever value the form holds.
    if (picked.productId !== '') {
      rememberCrmProduct(picked.productId, { masterId: picked.masterId, name: picked.name, productName: picked.productName, state: 'sold' })
      setName({ key: picked.productId, described: { masterId: picked.masterId, name: picked.name, productName: picked.productName, state: 'sold' }, failed: false })
    }
    onChange(picked)
    close(true)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    if (event.key === 'Tab') { close(false); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive((current) => moveAmongSelectable(current, event.key, selectable))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = ordered[active]
      if (row && selectable[active]) choose(row)
    }
  }

  const shown = name.key === key ? name : { key, described: null, failed: false }
  const label = key === '' ? null : shown.described ? shown.described.name : shown.failed ? `Sub-product ${key}` : 'Loading name…'
  const state = shown.described ? notOfferedWords(shown.described.state) : null
  const context = shown.described?.productName ? `${shown.described.productName} › ${shown.described.name}` : label ?? undefined
  const valueId = `${baseId}-value`
  const labelId = `${baseId}-label`
  const loading = phase === 'loading'

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)} data-product-picker="sub-product" data-picker-phase={open ? phase : 'closed'}>
      {ariaLabel && <span id={labelId} className="sr-only">{ariaLabel}</span>}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={ariaLabel ? `${labelId} ${valueId}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => { if (!open && event.key === 'ArrowDown') { event.preventDefault(); openList() } }}
        className={cn(BOX, disabled && 'cursor-not-allowed opacity-50')}
        title={context}
        data-picker-trigger
      >
        <span id={valueId} className={cn('truncate', label === null && BOX_EMPTY)} data-picker-value={key}>{label ?? placeholder}</span>
        <span className="flex shrink-0 items-center gap-2">
          {state && <span className={STATE_WORD} data-picker-state>{state}</span>}
          <ChevronDown className={cn('size-4 text-muted-foreground transition', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className={cn(POPOVER, openAbove ? 'bottom-full mb-1' : 'mt-1')} onKeyDown={onKeyDown} data-picker-popover>
          <div className="border-b border-border/60 p-2">
            <SearchInput
              autoFocus
              role="combobox"
              aria-label="Search Sub-products by name or SKU"
              aria-expanded={ordered.length > 0}
              aria-autocomplete="list"
              aria-controls={ordered.length > 0 ? `${baseId}-list` : undefined}
              aria-activedescendant={ordered.length > 0 ? `${baseId}-option-${active}` : undefined}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Type a name or SKU"
              className="w-full"
              data-picker-search
            />
          </div>
          <PickerList
            rows={visible}
            text={searchText(typed)}
            scope={scope}
            notSoldSelectable={notSoldSelectable}
            limit={limit}
            loading={loading}
            failure={failure}
            activeIndex={active}
            selectedKey={key}
            baseId={baseId}
            onChoose={choose}
            onHover={setActive}
            onRetry={() => setAttempt((n) => n + 1)}
          />
          {clearable && key !== '' && (
            <div className="border-t border-border/60 p-2">
              <button type="button" className={RETRY} onClick={() => { onChange(null); close(true) }} data-picker-clear>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
