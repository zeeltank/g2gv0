'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Field, FormErrorSummary, FormLayout, FormSection, NativeSelect, RecordDrawer, splitFieldErrors, type SplitErrors,
} from '@/components/shared/scaffolds'
import { ApiError } from '@/services/core'
import { productMasterService } from '@/services/product-master/product-master-service'
import type { PmItemType, PmKind, PmMeta, PmRecord } from '@/services/product-master/types'
import {
  addableItemTypes, createPayload, emptyForm, FORM_FIELDS, formFromRecord, isDirty, kindLabel, maxOfferIdLength, updatePayload,
  type ProductForm, type SellForm,
} from './product-master-model'

/** What the drawer is for: a new record of a kind (a sub-product may start under a product, an item with a type), or an existing record. */
export type FormTarget =
  | { mode: 'create'; kind: PmKind; productId?: number | null; itemType?: PmItemType }
  /** `enableSell` opens a sub-product that is not in the catalogue with "Sell in CRM" already switched on. */
  | { mode: 'edit'; record: PmRecord; enableSell?: boolean }

const NO_ERRORS: SplitErrors = { byField: {}, unplaced: [] }
const FORM_ID = 'product-master-form'
const ITEM_TYPE_LABELS: Record<PmItemType, string> = { product: 'Product', service: 'Service' }

function describeSaveError(cause: unknown): SplitErrors {
  if (cause instanceof ApiError) {
    const split = splitFieldErrors(cause.errors, FORM_FIELDS)
    if (Object.keys(split.byField).length === 0 && split.unplaced.length === 0) split.unplaced.push(cause.message)
    return split
  }
  return { byField: {}, unplaced: [cause instanceof Error ? cause.message : 'This could not be saved.'] }
}

function titleFor(target: FormTarget | null): string {
  if (!target) return ''
  if (target.mode === 'edit') return `Edit ${target.record.name}`
  return target.kind === 'product' ? 'New product line' : target.kind === 'sub_product' ? 'New sub-product' : 'New catalogue item'
}

/** The part of the API the form writes through; the real one by default, a stand-in in a test. */
export type ProductMasterWriter = Pick<typeof productMasterService, 'create' | 'update'>

/**
 * The one form for creating and editing a product line, a sub-product or a catalogue item, in a drawer. Each section says where it saves, because one form
 * can write to the Product Master, the Portfolio and the CRM catalogue.
 *
 * It sends only what the server accepts and shows what the server answers, field by field: there is no client-side validation, so the messages are the
 * server's own. The drawer stays mounted and is opened with `open`; pointing it at a new `target` starts a fresh form.
 *
 * `showSell={false}` leaves out the "Sell in CRM" section, for the catalogue item's own page, where the item's price, SKU and tax rate already have their
 * own Edit button and must not be editable in two places.
 */
export function ProductMasterForm({ open, target, meta, products, onClose, onSaved, service = productMasterService, showSell = true }: {
  open: boolean
  target: FormTarget | null
  meta: PmMeta | null
  /** The product lines a sub-product can be placed under. */
  products: Array<{ id: number; key: string; name: string }>
  onClose: () => void
  onSaved: (record: PmRecord, message: string) => void
  service?: ProductMasterWriter
  showSell?: boolean
}) {
  const [seen, setSeen] = useState<FormTarget | null>(null)
  const [initial, setInitial] = useState<ProductForm>(() => emptyForm('sub_product'))
  const [form, setForm] = useState<ProductForm>(initial)
  const [errors, setErrors] = useState<SplitErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)

  // A new target starts a fresh form (state derived from props, settled before the first paint). A new item starts on the first type the person may add.
  if (target !== seen) {
    setSeen(target)
    if (target) {
      const itemType = target.mode === 'create' ? (target.itemType ?? addableItemTypes(meta?.can ?? null, 'create')[0]) : undefined
      const start = target.mode === 'edit' ? formFromRecord(target.record) : emptyForm(target.kind, { productId: target.productId, itemType })
      const sellType = addableItemTypes(meta?.can ?? null, 'sell')[0]
      const opened = target.mode === 'edit' && target.enableSell && !start.sell.enabled && sellType
        ? { ...start, sell: { ...start.sell, enabled: true, type: sellType } }
        : start
      setInitial(start)
      setForm(opened)
      setErrors(NO_ERRORS)
      setBusy(false)
    }
  }

  const editRecord = target?.mode === 'edit' ? target.record : null
  const editing = editRecord !== null
  const dirty = isDirty(initial, form)
  const kind = form.kind
  const hasCatalogueRow = editRecord?.crmProduct != null

  const itemTypes = useMemo(() => {
    const allowed = addableItemTypes(meta?.can ?? null, kind === 'item' ? 'create' : 'sell')
    return hasCatalogueRow ? [form.sell.type] : allowed
  }, [meta, kind, hasCatalogueRow, form.sell.type])

  const set = (patch: Partial<ProductForm>, ...fields: string[]) => {
    setForm((f) => ({ ...f, ...patch }))
    clear(fields)
  }
  const setSell = (patch: Partial<SellForm>, ...fields: string[]) => {
    setForm((f) => ({ ...f, sell: { ...f.sell, ...patch } }))
    clear(fields)
  }
  /** An error stops being true when the person edits its field. */
  const clear = (fields: string[]) => {
    if (fields.length === 0) return
    setErrors((e) => {
      const byField = { ...e.byField }
      for (const name of fields) delete byField[name]
      return { ...e, byField }
    })
  }
  const err = (name: string) => errors.byField[name]

  const submit = async () => {
    if (!target || busy) return
    setBusy(true)
    setErrors(NO_ERRORS)
    try {
      if (target.mode === 'create') {
        const response = await service.create(createPayload(form))
        onSaved(response.data, `${kindLabel(form.kind)} created.`)
      } else {
        const body = updatePayload(initial, form)
        if (Object.keys(body).length === 0) {
          onClose()
          return
        }
        const response = await service.update(target.record.id, body)
        onSaved(response.data, 'Saved.')
      }
    } catch (cause) {
      setErrors(describeSaveError(cause))
    } finally {
      setBusy(false)
    }
  }

  const productKey = products.find((p) => String(p.id) === form.productId)?.key ?? null
  const readinessOptions = useMemo(() => {
    const list = meta?.readinessStatuses ?? []
    return form.readiness && !list.includes(form.readiness) ? [form.readiness, ...list] : list
  }, [meta, form.readiness])
  const sellOffered = kind === 'item' || form.sell.enabled
  const cannotSell = kind === 'sub_product' && !hasCatalogueRow && itemTypes.length === 0

  const savesTo = kind === 'product' ? 'saves as a product line' : kind === 'sub_product' ? 'saves to the product line and the Portfolio' : 'saves to the CRM catalogue'

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={titleFor(target)}
      description={kind === 'sub_product' ? 'An item inside a product line. It appears in the Portfolio.' : undefined}
      dirty={dirty}
      busy={busy}
      footer={(requestClose) => (
        <>
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={busy || (editing && !dirty)}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create'}
          </Button>
        </>
      )}
    >
      <FormLayout id={FORM_ID} onSubmit={() => void submit()}>
        <FormErrorSummary messages={errors.unplaced} />

        <FormSection title="Identity" saves={savesTo}>
          <Field label="Name" required wide={kind !== 'product'} error={err('name')}>
            {(c) => <Input {...c} value={form.name} onChange={(e) => set({ name: e.target.value }, 'name')} disabled={busy || (editing && kind === 'product')} autoComplete="off" />}
          </Field>

          {kind === 'product' && (
            <Field label="Key" required error={err('key')} hint="3 to 20 characters: lower-case letters, digits and underscores, starting with a letter. It cannot be changed later.">
              {(c) => <Input {...c} value={form.key} onChange={(e) => set({ key: e.target.value }, 'key')} disabled={busy || editing} maxLength={20} autoComplete="off" />}
            </Field>
          )}

          {kind === 'sub_product' && (
            <>
              <Field label="Product line" required error={err('productId')}>
                {(c) => (
                  <NativeSelect {...c} value={form.productId} onChange={(e) => set({ productId: e.target.value }, 'productId', 'offerId')} disabled={busy || editing}>
                    <option value="">Choose a product line…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </NativeSelect>
                )}
              </Field>
              <Field
                label="Sub-product ID"
                required
                error={err('offerId')}
                hint={editing ? 'The ID cannot be changed.' : 'Letters, numbers and dashes, for example P7 or SCH-12. It cannot be changed later.'}
              >
                {(c) => <Input {...c} value={form.offerId} onChange={(e) => set({ offerId: e.target.value }, 'offerId')} disabled={busy || editing} maxLength={maxOfferIdLength(productKey)} autoComplete="off" />}
              </Field>
              <Field label="Readiness" required error={err('readiness')} hint="Confirming it as ready is done in the Portfolio, by a person.">
                {(c) => (
                  <NativeSelect {...c} value={form.readiness} onChange={(e) => set({ readiness: e.target.value }, 'readiness')} disabled={busy}>
                    <option value="">Choose a state…</option>
                    {readinessOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </NativeSelect>
                )}
              </Field>
            </>
          )}
        </FormSection>

        {kind === 'sub_product' && (
          <FormSection title="About" saves="saves to the Portfolio">
            <Field label="What it does" wide error={err('about.whatItDoes')} hint="In plain words. The signal matching reads this.">
              {(c) => <Textarea {...c} rows={3} value={form.whatItDoes} onChange={(e) => set({ whatItDoes: e.target.value }, 'about.whatItDoes')} disabled={busy} />}
            </Field>
            <Field label="Customer problems it solves" wide error={err('about.needsSolved')} hint="One per line.">
              {(c) => <Textarea {...c} rows={4} value={form.needsSolved} onChange={(e) => set({ needsSolved: e.target.value }, 'about.needsSolved')} disabled={busy} />}
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Who it is for and the buying events that point to it are edited in the <Link href="/portfolio" className="text-primary underline underline-offset-2">Portfolio</Link>.
            </p>
          </FormSection>
        )}

        {(kind === 'sub_product' || kind === 'item') && showSell && (
          <FormSection
            title="Sell in CRM"
            saves="saves to the CRM catalogue"
            badge={<span className="rounded-full border border-border px-2 py-0.5">{hasCatalogueRow || (kind === 'item' && editing) ? 'Sold' : sellOffered ? 'Will be sold' : 'Not sold yet'}</span>}
          >
            {kind === 'sub_product' && (
              <div className="flex items-start justify-between gap-4 sm:col-span-2">
                <div className="min-w-0">
                  <label htmlFor="pm-sell-switch" className="text-sm font-medium text-foreground">Sell this in the CRM</label>
                  <p className="text-xs text-muted-foreground">
                    {cannotSell
                      ? 'You do not have the right to add to the CRM catalogue.'
                      : hasCatalogueRow
                        ? 'It is in the catalogue. Taking it out is not supported yet: archive it instead.'
                        : 'Switching it on creates the catalogue item and links it. Prices are set in price books, not here.'}
                  </p>
                </div>
                <Switch
                  id="pm-sell-switch"
                  checked={form.sell.enabled}
                  disabled={busy || hasCatalogueRow || cannotSell}
                  onChange={(e) => setSell({ enabled: e.target.checked, type: itemTypes.includes(form.sell.type) ? form.sell.type : (itemTypes[0] ?? form.sell.type) })}
                />
              </div>
            )}

            {sellOffered && (
              <>
                <Field label="Type" error={err('sell.type')}>
                  {(c) => (
                    <NativeSelect {...c} value={form.sell.type} onChange={(e) => setSell({ type: e.target.value as PmItemType }, 'sell.type')} disabled={busy || hasCatalogueRow || (kind === 'item' && editing)}>
                      {itemTypes.map((t) => <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>)}
                    </NativeSelect>
                  )}
                </Field>
                <Field label="SKU" error={err('sell.sku')}>
                  {(c) => <Input {...c} value={form.sell.sku} onChange={(e) => setSell({ sku: e.target.value }, 'sell.sku')} disabled={busy} autoComplete="off" />}
                </Field>
                <Field label="Tax rate" error={err('sell.taxRateId')}>
                  {(c) => (
                    <NativeSelect {...c} value={form.sell.taxRateId} onChange={(e) => setSell({ taxRateId: e.target.value }, 'sell.taxRateId')} disabled={busy}>
                      <option value="">Default</option>
                      {(meta?.taxRates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.percentage}%)</option>)}
                    </NativeSelect>
                  )}
                </Field>
                <Field label="GL account" error={err('sell.glAccount')} hint="Optional.">
                  {(c) => <Input {...c} value={form.sell.glAccount} onChange={(e) => setSell({ glAccount: e.target.value }, 'sell.glAccount')} disabled={busy} autoComplete="off" />}
                </Field>
                <Field label="Base price" error={err('sell.basePrice')} hint="Used only when a price book has no price for it.">
                  {(c) => <Input {...c} type="text" inputMode="decimal" value={form.sell.basePrice} onChange={(e) => setSell({ basePrice: e.target.value }, 'sell.basePrice')} disabled={busy} autoComplete="off" />}
                </Field>
                <Field label="Currency" error={err('sell.currency')}>
                  {(c) => <Input {...c} value={form.sell.currency} onChange={(e) => setSell({ currency: e.target.value }, 'sell.currency')} disabled={busy} maxLength={10} placeholder="INR" autoComplete="off" />}
                </Field>
              </>
            )}
          </FormSection>
        )}
      </FormLayout>
    </RecordDrawer>
  )
}
