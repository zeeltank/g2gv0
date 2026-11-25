import { addCustom, MAX_PROBLEMS, MAX_PROBLEM_LENGTH, problemLines, splitNeeds } from '@/lib/product-form'
import type { PmItemType, PmTaxRate } from '@/services/product-master/types'
import type { PmFullRecord, PmSell } from '@/services/product-master/record-types'

/*
 * The Add / Edit form of ONE Sub-product, as plain functions (no React), so every rule can be tested without a browser. Three sections: About (the
 * Portfolio's fields), Sell in CRM (every field of the old Products form) and Ideal customer (the ICPs, kept in lib/portfolio/icp-state.ts).
 *
 * What is sent. A CREATE sends every section the person filled in. An EDIT sends only what CHANGED: the sections a person has no right on are then never
 * asked about (a sales person who changes a price never touches the About), and a PAUSED item is never resumed by an unrelated save (the old drawer sent
 * `enabled: true` whenever a row existed). The server stays the authority: its answer is shown next to the field it names.
 */

export type FormMode = 'create' | 'edit'

/** How the record's Sell side stands when the form opens: no row yet, a row that is sold or paused, or a row in the Recycle Bin. */
export type SellStanding = 'none' | 'live' | 'binned'

export interface AboutForm {
  offerId: string
  readiness: string
  whatItDoes: string
  modulesComponents: string
  /** One problem per line, in the person's own words. */
  problems: string
  /** Older problem codes (N01…) a record already carries: kept, shown, removable. */
  legacyNeeds: string[]
  primarySegments: string[]
  triggerSignals: string[]
  proofPoints: string
  pricingModel: string
  typicalDealBand: string
  deploymentModel: string
  implementationEffort: string
  deliveryOwner: string
  notes: string
  /** Offer ids of other Sub-products. */
  oftenSoldTogether: string[]
}

export interface SellForm {
  /** "Sell in CRM": switched on to make the row, or to bring a binned one back. A row that is sold or paused is always on. */
  on: boolean
  /** "Offered on new documents": the ONE switch of a saved row (off = paused, nothing deleted). */
  offered: boolean
  type: PmItemType
  sku: string
  category: string
  glAccount: string
  taxRateId: string
  unitPrice: string
  costPrice: string
  currency: string
  commissionRate: string
  vendor: string
  usageUnit: string
  qtyInStock: string
  qtyInDemand: string
  reorderLevel: string
  weight: string
  assignedTo: string
  descriptionOnQuotes: string
  /** A picture picked in the form; it is sent AFTER the save, through its own call. */
  image: File | null
}

export interface ProductValues {
  productId: string
  name: string
  about: AboutForm
  sell: SellForm
}

export const emptyAbout = (): AboutForm => ({
  offerId: '', readiness: '', whatItDoes: '', modulesComponents: '', problems: '', legacyNeeds: [], primarySegments: [], triggerSignals: [], proofPoints: '',
  pricingModel: '', typicalDealBand: '', deploymentModel: '', implementationEffort: '', deliveryOwner: '', notes: '', oftenSoldTogether: [],
})

/** A new Sell section. `currency` is the organisation's default (`defaultCurrencyCode(meta)`): a Sub-product made in the form is never saved with no currency. */
export const emptySell = (type: PmItemType = 'product', assignedTo = '', currency = ''): SellForm => ({
  on: false, offered: true, type, sku: '', category: '', glAccount: '', taxRateId: '', unitPrice: '', costPrice: '', currency, commissionRate: '', vendor: '',
  usageUnit: '', qtyInStock: '', qtyInDemand: '', reorderLevel: '', weight: '', assignedTo, descriptionOnQuotes: '', image: null,
})

export const emptyValues = (defaults: { productId?: number | null; type?: PmItemType; assignedTo?: string; currency?: string } = {}): ProductValues => ({
  productId: defaults.productId ? String(defaults.productId) : '',
  name: '',
  about: emptyAbout(),
  sell: emptySell(defaults.type ?? 'product', defaults.assignedTo ?? '', defaults.currency ?? ''),
})

// ---------------------------------------------------------------------------------------------------------------------------- currency and tax (S16)

/** The tax rates a Sub-product priced in `currency` may use: the rates tied to that currency and the ones tied to none (a rate with no currency fits any). */
export function ratesForCurrency<T extends { currency?: string | null }>(rates: readonly T[], currency: string): T[] {
  const code = currency.trim().toUpperCase()
  return rates.filter((r) => !r.currency || r.currency.trim().toUpperCase() === code)
}

export interface CurrencyChange {
  patch: Partial<SellForm>
  /** The tax rate the change let go of because it is for another currency; null when the rate stays (or none was chosen). */
  dropped: PmTaxRate | null
}

/**
 * What changing the currency does to the form: the currency itself, and the tax rate chosen so far when it is tied to another currency (it is dropped, back to
 * "Default", and the screen says so, so a price in dollars is never saved under a rupee tax). `fallback` is the code an empty currency stands for.
 */
export function changeCurrency(sell: SellForm, next: string, rates: readonly PmTaxRate[], fallback: string): CurrencyChange {
  const chosen = rates.find((r) => String(r.id) === sell.taxRateId) ?? null
  const fits = chosen === null || ratesForCurrency([chosen], next === '' ? fallback : next).length > 0

  return fits ? { patch: { currency: next }, dropped: null } : { patch: { currency: next, taxRateId: '' }, dropped: chosen }
}

/** The five fields a Service does not have (the server blanks the first four on every write; the weight is a product idea too). */
export const PRODUCT_ONLY_SELL_FIELDS = ['vendor', 'qtyInStock', 'qtyInDemand', 'reorderLevel', 'weight'] as const

const text = (value: string | number | null | undefined): string => (value === null || value === undefined ? '' : String(value))

export function standingOf(sell: PmSell | null): SellStanding {
  return sell === null ? 'none' : sell.state === 'binned' ? 'binned' : 'live'
}

/** The form as an existing record fills it. */
export function valuesFromRecord(record: PmFullRecord): ProductValues {
  const about = record.offer?.about
  const sell = record.sell
  const needs = splitNeeds(about?.needsSolved ?? [])
  return {
    productId: record.parent ? String(record.parent.id) : '',
    name: record.name,
    about: {
      offerId: record.offer?.offerId ?? '',
      readiness: record.offer?.readiness ?? '',
      whatItDoes: text(about?.whatItDoes),
      modulesComponents: text(about?.modulesComponents),
      problems: needs.text,
      legacyNeeds: needs.codes,
      primarySegments: [...(about?.primarySegments ?? [])],
      triggerSignals: [...(about?.triggerSignals ?? [])],
      proofPoints: text(about?.proofPoints),
      pricingModel: text(about?.pricingModel),
      typicalDealBand: text(about?.typicalDealBand),
      deploymentModel: text(about?.deploymentModel),
      implementationEffort: text(about?.implementationEffort),
      deliveryOwner: text(about?.deliveryOwner),
      notes: text(about?.notes),
      oftenSoldTogether: [...(about?.oftenSoldTogether ?? [])],
    },
    sell: sell === null ? emptySell() : {
      on: sell.state !== 'binned',
      offered: sell.state === 'binned' ? true : sell.isActive,
      type: sell.type ?? 'product',
      sku: text(sell.sku), category: text(sell.category), glAccount: text(sell.glAccount), taxRateId: text(sell.taxRateId),
      unitPrice: text(sell.unitPrice), costPrice: text(sell.costPrice), currency: text(sell.currency), commissionRate: text(sell.commissionRate),
      vendor: text(sell.vendor), usageUnit: text(sell.usageUnit), qtyInStock: text(sell.qtyInStock), qtyInDemand: text(sell.qtyInDemand),
      reorderLevel: text(sell.reorderLevel), weight: text(sell.weight), assignedTo: text(sell.assignedTo), descriptionOnQuotes: text(sell.descriptionOnQuotes),
      image: null,
    },
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- what the person typed

const ID = /^[A-Za-z0-9._-]{1,50}$/

/** Has the person written anything in the About: an ID, a readiness, or any of its fields? The Product and the name alone are not an About. */
export function aboutFilled(a: AboutForm): boolean {
  return a.offerId.trim() !== '' || a.readiness !== '' || [a.whatItDoes, a.modulesComponents, a.problems, a.proofPoints, a.pricingModel, a.typicalDealBand, a.deploymentModel, a.implementationEffort, a.deliveryOwner, a.notes]
    .some((v) => v.trim() !== '') || [a.legacyNeeds, a.primarySegments, a.triggerSignals, a.oftenSoldTogether].some((l) => l.length > 0)
}

/** The field-path keys the server and this file use, so a message lands next to its field. The section keys (`about`, `sell`, `icp`) carry a 403's refusal. */
export const FORM_FIELDS: readonly string[] = [
  'sections', 'name', 'productId', 'offerId', 'readiness', 'about', 'icp', 'sell', 'kind', 'key',
  'about.whatItDoes', 'about.modulesComponents', 'about.needsSolved', 'about.primarySegments', 'about.triggerSignals', 'about.proofPoints', 'about.pricingModel',
  'about.typicalDealBand', 'about.deploymentModel', 'about.implementationEffort', 'about.deliveryOwner', 'about.notes', 'about.oftenSoldTogether',
  'sell.enabled', 'sell.type', 'sell.sku', 'sell.category', 'sell.glAccount', 'sell.taxRateId', 'sell.unitPrice', 'sell.basePrice', 'sell.costPrice', 'sell.currency',
  'sell.commissionRate', 'sell.vendor', 'sell.usageUnit', 'sell.qtyInStock', 'sell.qtyInDemand', 'sell.reorderLevel', 'sell.weight', 'sell.assignedTo', 'sell.isActive',
  'sell.descriptionOnQuotes', 'sell.description',
]

/** Which tab of the form a field-path key belongs to. */
export type SectionId = 'about' | 'sell' | 'icp'
export function sectionOf(field: string): SectionId {
  if (field === 'sell' || field.startsWith('sell.')) return 'sell'
  if (field === 'icp' || field.startsWith('icp.')) return 'icp'
  return 'about'
}

export interface CheckContext {
  mode: FormMode
  /** The record already has an About (an offer row). */
  hasAbout: boolean
}

/** What can be seen to be wrong without asking the server; the server checks again. Keys are field paths (see FORM_FIELDS). */
export function checkValues(values: ProductValues, ctx: CheckContext): Record<string, string> {
  const e: Record<string, string> = {}
  const name = values.name.trim()
  if (name === '') e.name = 'A name is required.'
  else if (name.length < 2) e.name = 'Use at least 2 characters.'
  else if (name.length > 191) e.name = 'At most 191 characters.'

  const addingAbout = !ctx.hasAbout && aboutFilled(values.about)
  if (ctx.hasAbout || addingAbout) {
    const a = values.about
    if (values.productId === '') e.productId = 'Choose a Product.'
    if (!ctx.hasAbout) {
      if (a.offerId.trim() === '') e.offerId = 'An ID is required.'
      else if (!ID.test(a.offerId.trim())) e.offerId = 'Use letters, digits, dot, dash or underscore (up to 50 characters).'
    }
    if (a.readiness === '') e.readiness = 'Choose a readiness.'
    const problems = problemLines(a.problems)
    if (problems.length + a.legacyNeeds.length > MAX_PROBLEMS) e['about.needsSolved'] = `At most ${MAX_PROBLEMS} problems.`
    else if (problems.some((p) => p.length > MAX_PROBLEM_LENGTH)) e['about.needsSolved'] = `Each problem can be up to ${MAX_PROBLEM_LENGTH} characters. Put each one on its own line.`
    if (a.pricingModel.length > 191) e['about.pricingModel'] = 'At most 191 characters.'
    if (a.typicalDealBand.length > 50) e['about.typicalDealBand'] = 'At most 50 characters.'
    if (a.deploymentModel.length > 100) e['about.deploymentModel'] = 'At most 100 characters.'
    if (a.implementationEffort.length > 100) e['about.implementationEffort'] = 'At most 100 characters.'
    if (a.deliveryOwner.length > 100) e['about.deliveryOwner'] = 'At most 100 characters.'
  }
  if (ctx.mode === 'create' && !addingAbout && !values.sell.on) {
    e.sections = 'Add an About (an ID and a readiness), or switch Sell in CRM on: a sub-product needs at least one section.'
  }

  return e
}

// ---------------------------------------------------------------------------------------------------------------------------- the payload

const maybe = (v: string): string | null => (v.trim() === '' ? null : v.trim())
const number = (v: string): number | string | null => {
  const t = v.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : t
}

const SELL_TEXT = ['sku', 'category', 'glAccount', 'currency', 'vendor', 'usageUnit', 'descriptionOnQuotes'] as const
const SELL_NUMBER = ['taxRateId', 'unitPrice', 'costPrice', 'commissionRate', 'qtyInStock', 'qtyInDemand', 'reorderLevel', 'weight', 'assignedTo'] as const

/** One Sell field as the server wants it: text trimmed or null, a number as a number. */
function sellValue(key: (typeof SELL_TEXT)[number] | (typeof SELL_NUMBER)[number], sell: SellForm): unknown {
  return (SELL_TEXT as readonly string[]).includes(key) ? maybe(sell[key as (typeof SELL_TEXT)[number]]) : number(sell[key as (typeof SELL_NUMBER)[number]])
}

const hiddenForService = (key: string, type: PmItemType): boolean => type === 'service' && (PRODUCT_ONLY_SELL_FIELDS as readonly string[]).includes(key)

/** Every Sell field that has a value, for a section that is new (a row to make). A blank field is left out: the server writes NULL for it. */
function newSell(sell: SellForm): Record<string, unknown> {
  const out: Record<string, unknown> = { enabled: true, type: sell.type }
  for (const key of [...SELL_TEXT, ...SELL_NUMBER]) {
    if (hiddenForService(key, sell.type)) continue
    const value = sellValue(key, sell)
    if (value !== null) out[key] = value
  }

  return out
}

/** The Sell fields that differ from what was loaded; a field the person emptied is sent as null (cleared), except the assignee, which is never blank. */
function changedSell(initial: SellForm, sell: SellForm): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of [...SELL_TEXT, ...SELL_NUMBER]) {
    if (hiddenForService(key, sell.type)) continue
    if (sell[key as 'sku'] === initial[key as 'sku']) continue
    const value = sellValue(key, sell)
    if (key === 'assignedTo' && value === null) continue
    out[key] = value
  }

  return out
}

const aboutBody = (a: AboutForm): Record<string, unknown> => ({
  whatItDoes: maybe(a.whatItDoes),
  modulesComponents: maybe(a.modulesComponents),
  deploymentModel: maybe(a.deploymentModel),
  proofPoints: maybe(a.proofPoints),
  notes: maybe(a.notes),
  needsSolved: [...a.legacyNeeds, ...problemLines(a.problems)],
  primarySegments: a.primarySegments,
  triggerSignals: a.triggerSignals,
  pricingModel: maybe(a.pricingModel),
  typicalDealBand: maybe(a.typicalDealBand),
  implementationEffort: maybe(a.implementationEffort),
  deliveryOwner: maybe(a.deliveryOwner),
  oftenSoldTogether: a.oftenSoldTogether,
})

/** The About keys whose value differs from the loaded one. */
function changedAbout(initial: AboutForm, a: AboutForm): Record<string, unknown> {
  const now = aboutBody(a)
  const before = aboutBody(initial)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(now)) if (JSON.stringify(now[key]) !== JSON.stringify(before[key])) out[key] = now[key]

  return out
}

export interface PayloadInput {
  mode: FormMode
  initial: ProductValues
  values: ProductValues
  standing: SellStanding
  hasAbout: boolean
  /** The ICP models (b2b, b2g, b2c) to send, already built. Empty when the person left the ICPs alone. */
  icp?: Record<string, unknown>
}

/** The body of POST (create) or PUT (edit). */
export function buildPayload({ mode, initial, values, standing, hasAbout, icp }: PayloadInput): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const productId = values.productId === '' ? null : Number(values.productId)
  const addingAbout = !hasAbout && aboutFilled(values.about)

  if (mode === 'create') {
    body.kind = 'sub_product'
    body.name = values.name.trim()
    if (productId !== null) body.productId = productId
  } else {
    if (values.name.trim() !== initial.name.trim()) body.name = values.name.trim()
    if (productId !== null && values.productId !== initial.productId) body.productId = productId
  }

  if (mode === 'create' ? addingAbout : (hasAbout || addingAbout)) {
    if (mode === 'create' || addingAbout) {
      // A new About: the server needs its ID, its readiness and its Product with it, and takes every field.
      body.offerId = values.about.offerId.trim()
      body.readiness = values.about.readiness
      if (addingAbout && productId !== null) body.productId = productId
      body.about = aboutBody(values.about)
    } else {
      if (values.about.readiness !== initial.about.readiness) body.readiness = values.about.readiness
      const changed = changedAbout(initial.about, values.about)
      if (Object.keys(changed).length > 0) body.about = changed
    }
  }

  if (icp && Object.keys(icp).length > 0) body.icp = icp

  const sell = sellSection(mode, initial, values, standing)
  if (sell !== null) body.sell = sell

  return body
}

/** The Sell section of the body, or null when there is nothing to say about it. */
export function sellSection(mode: FormMode, initial: ProductValues, values: ProductValues, standing: SellStanding): Record<string, unknown> | null {
  const sell = values.sell
  if (mode === 'create') return sell.on ? newSell(sell) : null
  if (standing === 'none') return sell.on ? newSell(sell) : null
  if (standing === 'binned') {
    if (!sell.on) return null
    return { enabled: true, ...changedSell(initial.sell, sell) }
  }
  const out = changedSell(initial.sell, sell)
  // The ONE switch: paused or offered. It is `isActive` alone (never `enabled`): a save that does not touch the switch cannot resume a paused row.
  if (sell.offered !== initial.sell.offered) out.isActive = sell.offered

  return Object.keys(out).length > 0 ? out : null
}

/** A snapshot for the dirty guard: everything the person can type, the picture by its name and size. */
export function snapshot(values: ProductValues): string {
  const image = values.sell.image ? `${values.sell.image.name}:${values.sell.image.size}` : null
  return JSON.stringify({ ...values, sell: { ...values.sell, image } })
}

export function isDirty(initial: ProductValues, values: ProductValues, icpChanged = false): boolean {
  return icpChanged || snapshot(initial) !== snapshot(values)
}

/** The Product the form's ID suggestion and its "often sold together" list read from: Products with their Sub-products (`GET /product-master`, every status). */
export interface ProductChoice {
  id: number
  key: string
  name: string
  /** The Portfolio group (a code such as "Scholar K-12"), which decides the prefix of a suggested ID. */
  portfolioName: string | null
  shared: boolean
  status: 'active' | 'archived'
  subProducts: Array<{ id: number; name: string; offerId: string | null; status: 'active' | 'archived' }>
}

/** Ticks or unticks an offer id in the "often sold together" list. */
export const toggleOffer = (list: string[], offerId: string): string[] => (list.includes(offerId) ? list.filter((x) => x !== offerId) : [...list, offerId])

export { addCustom }
