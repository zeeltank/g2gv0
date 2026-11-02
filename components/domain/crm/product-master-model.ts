import type { PmCan, PmItemType, PmKind, PmOption, PmRecord } from '@/services/product-master/types'

/**
 * The rules of the Product Master screen that need no browser: how the form's state becomes the API's request, when a form counts as changed, and a few
 * words and choices the screens share. Tested on their own (lib/product-master/model.test.ts).
 *
 * The form's field names match the API's field paths (name, offerId, about.whatItDoes, sell.taxRateId, …), so a server error keyed by one of them
 * lands next to the right field.
 */

export interface SellForm {
  enabled: boolean
  type: PmItemType
  sku: string
  glAccount: string
  taxRateId: string
  basePrice: string
  currency: string
}

export interface ProductForm {
  kind: PmKind
  name: string
  /** A product's short key (its signal key); only used when creating a product. */
  key: string
  /** The product a sub-product belongs to, as the select's value ("" when none is chosen). */
  productId: string
  /** The sub-product's ID in the Portfolio. */
  offerId: string
  readiness: string
  whatItDoes: string
  /** One problem the sub-product solves per line. */
  needsSolved: string
  sell: SellForm
}

/** The fields the form shows, named as the API names them, so server errors can be placed (see splitFieldErrors). */
export const FORM_FIELDS = [
  'name', 'key', 'productId', 'offerId', 'readiness', 'about.whatItDoes', 'about.needsSolved',
  'sell.type', 'sell.sku', 'sell.glAccount', 'sell.taxRateId', 'sell.basePrice', 'sell.currency',
] as const

const KIND_LABELS: Record<PmKind, string> = { product: 'Product', sub_product: 'Sub-product', item: 'Catalogue item' }
export const kindLabel = (kind: PmKind): string => KIND_LABELS[kind]

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '')
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim())

/** A number when the text is one, else the text itself, so the server's own "must be a number" message reaches the person instead of a silent null. */
function numberish(value: string): number | string | null {
  const text = value.trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : text
}

export function emptySell(type: PmItemType = 'product', enabled = false): SellForm {
  return { enabled, type, sku: '', glAccount: '', taxRateId: '', basePrice: '', currency: '' }
}

export function emptyForm(kind: PmKind, defaults: { productId?: number | null; itemType?: PmItemType } = {}): ProductForm {
  return {
    kind,
    name: '',
    key: '',
    productId: defaults.productId ? String(defaults.productId) : '',
    offerId: '',
    readiness: '',
    whatItDoes: '',
    needsSolved: '',
    sell: emptySell(defaults.itemType ?? 'product', kind === 'item'),
  }
}

/** The form for editing a record, filled from what the record already holds. */
export function formFromRecord(record: PmRecord): ProductForm {
  const crm = record.crmProduct
  return {
    kind: record.kind,
    name: record.name,
    key: record.kind === 'product' ? record.key : '',
    productId: record.parent ? String(record.parent.id) : '',
    offerId: record.offer?.offerId ?? '',
    readiness: record.offer?.readiness ?? '',
    whatItDoes: record.offer?.about.whatItDoes ?? '',
    needsSolved: (record.offer?.about.needsSolved ?? []).join('\n'),
    sell: crm
      ? {
        enabled: true,
        type: crm.type ?? 'product',
        sku: crm.sku ?? '',
        glAccount: crm.glAccount ?? '',
        taxRateId: crm.taxRateId !== null ? String(crm.taxRateId) : '',
        basePrice: crm.unitPrice !== null ? String(crm.unitPrice) : '',
        currency: crm.currency ?? '',
      }
      : emptySell('product', record.kind === 'item'),
  }
}

/** The "sell" part of a request. A blank field is sent as null, which clears it. */
export function sellPayload(sell: SellForm): Record<string, unknown> {
  return {
    enabled: true,
    type: sell.type,
    sku: orNull(sell.sku),
    glAccount: orNull(sell.glAccount),
    taxRateId: numberish(sell.taxRateId),
    basePrice: numberish(sell.basePrice),
    currency: orNull(sell.currency),
  }
}

/** The request that creates what the form describes. */
export function createPayload(form: ProductForm): Record<string, unknown> {
  if (form.kind === 'product') return { kind: 'product', name: form.name.trim(), key: form.key.trim() }
  if (form.kind === 'item') return { kind: 'item', name: form.name.trim(), sell: sellPayload(form.sell) }

  return {
    kind: 'sub_product',
    name: form.name.trim(),
    productId: numberish(form.productId),
    offerId: form.offerId.trim(),
    readiness: form.readiness,
    about: { whatItDoes: orNull(form.whatItDoes), needsSolved: splitLines(form.needsSolved) },
    ...(form.sell.enabled ? { sell: sellPayload(form.sell) } : {}),
  }
}

function sellChanged(a: SellForm, b: SellForm): boolean {
  return a.enabled !== b.enabled || a.type !== b.type || a.sku.trim() !== b.sku.trim() || a.glAccount.trim() !== b.glAccount.trim()
    || a.taxRateId !== b.taxRateId || a.basePrice.trim() !== b.basePrice.trim() || a.currency.trim() !== b.currency.trim()
}

/**
 * The request that saves the changes between `initial` and `form`: only what changed, because the API takes a partial update and a field that was not
 * sent is left alone. Empty when nothing changed. The Sell part is sent whole whenever any of it changed, because the API replaces all five of its
 * fields together.
 */
export function updatePayload(initial: ProductForm, form: ProductForm): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (form.name.trim() !== initial.name.trim()) body.name = form.name.trim()

  if (form.kind === 'sub_product') {
    if (form.readiness !== initial.readiness) body.readiness = form.readiness
    const about: Record<string, unknown> = {}
    if (form.whatItDoes.trim() !== initial.whatItDoes.trim()) about.whatItDoes = orNull(form.whatItDoes)
    if (JSON.stringify(splitLines(form.needsSolved)) !== JSON.stringify(splitLines(initial.needsSolved))) about.needsSolved = splitLines(form.needsSolved)
    if (Object.keys(about).length > 0) body.about = about
  }

  if ((form.kind === 'sub_product' || form.kind === 'item') && form.sell.enabled && sellChanged(initial.sell, form.sell)) {
    body.sell = sellPayload(form.sell)
  }

  return body
}

/** True when the form holds something the person has typed or changed (so closing it should ask first). */
export function isDirty(initial: ProductForm, form: ProductForm): boolean {
  const canonical = (f: ProductForm) => JSON.stringify({
    kind: f.kind, name: f.name.trim(), key: f.key.trim(), productId: f.productId, offerId: f.offerId.trim(), readiness: f.readiness,
    whatItDoes: f.whatItDoes.trim(), needsSolved: splitLines(f.needsSolved),
    sell: { ...f.sell, sku: f.sell.sku.trim(), glAccount: f.sell.glAccount.trim(), basePrice: f.sell.basePrice.trim(), currency: f.sell.currency.trim() },
  })
  return canonical(initial) !== canonical(form)
}

/** The longest sub-product ID that keeps its key (`<product key>/<id>`) within the 50 characters the key may have. The ID itself is at most 50. */
export function maxOfferIdLength(productKey: string | null): number {
  return productKey ? Math.max(1, Math.min(50, 50 - productKey.length - 1)) : 50
}

export type ReadinessTone = 'success' | 'primary' | 'pending' | 'inactive' | 'default'

/** The colour a readiness state is drawn in: live and proven read as good, in progress as pending, concept and deferred as quiet. */
export function readinessTone(readiness: string | null | undefined): ReadinessTone {
  switch (readiness) {
    case 'Live – with client':
    case 'Proven on real client data (pilot)':
      return 'success'
    case 'Built – no production client':
      return 'primary'
    case 'In development':
    case 'Pilot planned':
    case 'Prototype':
      return 'pending'
    case 'Proposal / concept':
    case 'Deferred':
      return 'inactive'
    default:
      return 'default'
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "22 sub-products in 5 products." with an item count added when there are catalogue-only items. */
export function listSummary(totals: { products: number; subProducts: number; items: number }): string {
  const base = `${plural(totals.subProducts, 'sub-product', 'sub-products')} in ${plural(totals.products, 'product', 'products')}`
  return totals.items > 0 ? `${base}, and ${plural(totals.items, 'other catalogue item', 'other catalogue items')}.` : `${base}.`
}

export interface NewChoice {
  kind: PmKind
  label: string
  description: string
}

/** What the "New…" menu offers this person: only what the server says they may create. */
export function newChoices(can: PmCan | null): NewChoice[] {
  if (!can) return []
  const choices: NewChoice[] = []
  if (can.createProduct) choices.push({ kind: 'product', label: 'A product', description: 'A top-level group such as Scholar K-12.' })
  if (can.createSubProduct) choices.push({ kind: 'sub_product', label: 'A sub-product', description: 'An item inside a product. It appears in the Portfolio.' })
  if (can.createItem.product || can.createItem.service) {
    choices.push({ kind: 'item', label: 'A service or other catalogue item', description: 'Something you quote but never look for buyers of, such as a training day.' })
  }
  return choices
}

/** The item types a person may add to the catalogue, in the order the form lists them. */
export function addableItemTypes(can: PmCan | null, kind: 'create' | 'sell'): PmItemType[] {
  if (!can) return []
  const allowed = kind === 'create' ? can.createItem : can.sellInCrm
  return (['product', 'service'] as const).filter((type) => allowed[type])
}

/** The products a sub-product can be placed under, from the pickers list. */
export function productChoices(options: readonly PmOption[]): Array<{ id: number; key: string; name: string }> {
  return options.filter((o) => o.kind === 'product').map((o) => ({ id: o.id, key: o.key, name: o.name }))
}

export function formatPrice(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `${currency ?? ''} ${amount.toFixed(2)}`.trim()
}
