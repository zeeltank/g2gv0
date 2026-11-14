import assert from 'node:assert/strict'
import { kit } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import type { PmEnvelope, PmMeta } from '../../services/product-master/types'
import type { PmFullRecord } from '../../services/product-master/record-types'
import type { CrmProductBundleItem } from '../../types/crm'
import type { PmHistoryRow, PmListRow, PmUsageFull } from '../../services/product-master/record-types'
import { everything, fullRecord, historyRow, listRow, meta as metaFixture, taxonomy, usageFull } from './fixtures'

/**
 * Test support for the Sub-product form and pages: a fake browser, every service the screens talk to replaced by a fake that records what it is asked, and
 * helpers to type into a field by its label. It has no tests of its own and never touches the network. The service objects are shared by every screen the
 * process opens, so a test file that wants the REAL request (the fetch-level files) is a file of its own.
 */

export type Kit = Awaited<ReturnType<typeof kit>>

export interface Calls {
  get: Array<number | string>
  create: Array<Record<string, unknown>>
  update: Array<{ id: number | string; body: Record<string, unknown> }>
  archive: Array<number | string>
  restore: Array<number | string>
  checkConfig: unknown[]
  uploads: Array<{ productId: string; file: unknown }>
  offers: Array<number | string>
  list: Array<Record<string, unknown>>
  usage: Array<number | string>
  history: Array<{ id: number | string; page?: number }>
  deleted: string[]
  bundleAdds: Array<{ productId: string; componentProductId: string; quantity: number }>
  bundleRemoves: Array<{ productId: string; rowId: string }>
  readiness: Array<{ id: number | string; confirmed: boolean; note?: string }>
  pickerQueries: string[]
  /** Every request that reached the network layer (the custom fields call the platform API directly). */
  fetched: string[]
}

export interface World {
  record?: PmFullRecord | null
  meta?: PmMeta
  taxonomy?: ReturnType<typeof taxonomy> | null
  /** What the server answers to a create or an update (default: the record, with the id the create made). */
  saved?: PmFullRecord
  /** A refusal for the next write. */
  refuse?: () => ApiError
  /** The ICP configs the Portfolio read returns for the offer (`individual_icps`). */
  offerIcps?: Record<string, unknown> | null
  uploadFails?: boolean
  picklist?: Array<{ value: string; label: string; sortOrder: number; isDefault: boolean }>
  employees?: Array<{ id: number; first_name: string; last_name?: string }>
  icpProblems?: string[]
  session?: boolean
  /** The row the page's header looks itself up as in the list, and whether the caller may view Sell (the list's own answer). */
  listRow?: PmListRow | null
  viewSell?: boolean
  /** Several rows for the Product page's Sub-products. */
  listRows?: PmListRow[]
  lastPage?: number
  listFails?: boolean
  usage?: PmUsageFull
  usageRefused?: boolean
  history?: PmHistoryRow[]
  bundle?: CrmProductBundleItem[]
  pickerRows?: Array<{ crmProductId: number; masterId: number; name: string; productName: string | null; sku: string | null; unitPrice: number | null; currency: string | null; taxRateId: number | null; type: 'product' | 'service' }>
  customFields?: boolean
  deleteFails?: boolean
}

const ok = <T>(data: T): PmEnvelope<T> => ({ status: 1, data })

/** Installs the fakes and the session; returns the call log. Import the services only AFTER the kit has installed the fake DOM. */
export async function installWorld(k: Kit, world: World = {}): Promise<Calls> {
  const calls: Calls = { get: [], create: [], update: [], archive: [], restore: [], checkConfig: [], uploads: [], offers: [], list: [], usage: [], history: [], deleted: [], bundleAdds: [], bundleRemoves: [], readiness: [], pickerQueries: [], fetched: [] }
  if (world.session === false) k.w.localStorage.removeItem('userData')
  else k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  // The custom fields read the platform API through fetch: answer it here, with or without definitions, and record anything else that reaches the network.
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    calls.fetched.push(`${init?.method ?? 'GET'} ${url}`)
    if (url.includes('/platform/fields/values/crm_products/')) {
      const fields = world.customFields ? [{ id: 5, field_name: 'region', field_label: 'Sales region', field_type: 'text', field_message: null, required: false, sort_order: 1, min_value: null, max_value: null, validation_pattern: null, options: [], value: 'West' }] : []
      return new Response(JSON.stringify({ success: true, message: '', data: { record_table: 'crm_products', record_id: 301, fields } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ message: 'not faked' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  const { productRecordService } = await import('../../services/product-master/record-service')
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  const { crmService } = await import('../../services/crm')
  const { productIcpService } = await import('../../services/signals/product-icp')
  const { taskService } = await import('../../services/task')

  const record = world.record
  Object.assign(productRecordService, {
    meta: async () => ok(world.meta ?? metaFixture()),
    everything: async () => everything(),
    get: async (id: number | string) => { calls.get.push(id); if (!record) throw new ApiError('Product not found', 404); return ok(record) },
    create: async (body: Record<string, unknown>) => {
      calls.create.push(body)
      if (world.refuse) throw world.refuse()
      return ok(world.saved ?? fullRecord({ id: 77 }))
    },
    list: async (params: Record<string, unknown>) => {
      calls.list.push(params)
      if (world.listFails) throw new ApiError('List unavailable', 500)
      const rows = world.listRows ?? (world.listRow === null ? [] : [world.listRow ?? listRow({ id: record?.id ?? 11 })])
      return { status: 1, data: rows, meta: { available: true, total: rows.length, page: Number(params.page ?? 1), perPage: 20, lastPage: world.lastPage ?? 1, can: { createProduct: true, createSubProduct: true, editSubProduct: true, viewSell: world.viewSell ?? true, confirmMatches: true } } }
    },
    usage: async (id: number | string) => {
      calls.usage.push(id)
      if (world.usageRefused) throw new ApiError('You do not have the right to view how this product is used.', 403)
      return ok(world.usage ?? usageFull())
    },
    history: async (id: number | string, params: { page?: number } = {}) => {
      calls.history.push({ id, page: params.page })
      const rows = world.history ?? [historyRow()]
      return { status: 1, data: rows, meta: { total: rows.length, page: params.page ?? 1, perPage: 20, lastPage: world.lastPage ?? 1 } }
    },
    pickerParts: async (q: string) => { calls.pickerQueries.push(q); return ok(world.pickerRows ?? []) },
    archive: async (id: number | string) => { calls.archive.push(id); return ok({ ...(record ?? fullRecord()), status: 'archived' as const }) },
    restore: async (id: number | string) => { calls.restore.push(id); return ok({ ...(record ?? fullRecord()), status: 'active' as const }) },
    update: async (id: number | string, body: Record<string, unknown>) => {
      calls.update.push({ id, body })
      if (world.refuse) throw world.refuse()
      return ok(world.saved ?? record ?? fullRecord())
    },
  })
  Object.assign(portfolioService, {
    getTaxonomy: async () => {
      if (world.taxonomy === null) throw new Error('no taxonomy')
      return { status: 1, data: world.taxonomy ?? taxonomy() }
    },
    getOffer: async (_c: unknown, id: number | string) => { calls.offers.push(id); return { status: 1, data: { id, individual_icps: world.offerIcps ?? null } } },
    getReadinessLog: async () => ({ status: 1, data: [{ id: 1, action: 'confirmed', readiness_status: 'Prototype', actor_id: 2, note: 'Checked on site', created_at: '2026-11-01T10:00:00Z' }] }),
    setReadiness: async (_c: unknown, id: number | string, confirmed: boolean, note?: string) => { calls.readiness.push({ id, confirmed, note }); return { status: 1, message: 'ok', data: {} } },
  })
  Object.assign(crmService, {
    getPicklistValues: async () => ({ status: 1, message: '', data: { products: { category: world.picklist ?? [{ value: 'Software', label: 'Software', sortOrder: 1, isDefault: false }, { value: 'Training', label: 'Training', sortOrder: 2, isDefault: false }] } } }),
    getBundleItems: async () => ({ status: 1, message: '', data: world.bundle ?? [] }),
    addBundleItem: async (_c: unknown, productId: string, componentProductId: string, quantity: number) => { calls.bundleAdds.push({ productId, componentProductId, quantity }); return { status: 1, message: 'ok' } },
    removeBundleItem: async (_c: unknown, productId: string, rowId: string) => { calls.bundleRemoves.push({ productId, rowId }); return { status: 1, message: 'ok' } },
    deleteProduct: async (_c: unknown, id: string) => { calls.deleted.push(id); if (world.deleteFails) throw new Error('The entry could not be deleted.'); return { status: 1, message: 'ok' } },
    uploadProductImage: async (_c: unknown, productId: string, file: unknown) => {
      calls.uploads.push({ productId, file })
      if (world.uploadFails) throw new Error('The picture was too large.')
      return { status: 1, message: 'Uploaded.' }
    },
  })
  Object.assign(productIcpService, {
    checkConfig: async (_c: unknown, config: unknown) => { calls.checkConfig.push(config); return { status: 1, data: { valid: !world.icpProblems, problems: world.icpProblems ?? [] } } },
  })
  Object.assign(taskService, {
    getAssignmentUsers: async () => world.employees ?? [{ id: 2, first_name: 'Asha', last_name: 'Rao' }, { id: 5, first_name: 'Ravi', last_name: 'Shah' }],
  })

  return calls
}

// ---------------------------------------------------------------------------------------------------------------------------- the person's hands

const nativeValue = (w: Kit['w'], proto: 'HTMLInputElement' | 'HTMLTextAreaElement' | 'HTMLSelectElement') => Object.getOwnPropertyDescriptor(w[proto].prototype, 'value')!.set!

/** The control a label names (`for`), or the one wrapped by the label. A missing one fails the test on the spot. */
export function controlOf(k: Kit, label: string): HTMLElement {
  const every = k.all('label')
  const exact = every.filter((l) => (l.textContent ?? '').replace(/\*$/, '').trim() === label)
  const labels = exact.length > 0 ? exact : every.filter((l) => (l.textContent ?? '').trim().startsWith(label))
  assert.ok(labels.length > 0, `there is a field labelled "${label}"`)
  const target = labels.map((l) => (l.getAttribute('for') ? k.w.document.getElementById(l.getAttribute('for')!) : l.querySelector('input,select,textarea'))).find(Boolean)
  assert.ok(target, `"${label}" has a control`)
  return target as HTMLElement
}

export async function fill(k: Kit, label: string, value: string): Promise<void> {
  const el = controlOf(k, label)
  const proto = el.tagName === 'SELECT' ? 'HTMLSelectElement' : el.tagName === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'
  await k.act(async () => {
    nativeValue(k.w, proto).call(el, value)
    el.dispatchEvent(new k.w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

/** Presses a button by its whole text. A missing button fails the test (pressing "nothing" inside act() would hang it instead). */
export async function press(k: Kit, text: string): Promise<void> {
  const button = k.withText(text)
  assert.ok(button, `there is a "${text}" button`)
  await k.click(button)
}

export async function openTab(k: Kit, text: string): Promise<void> {
  const tab = k.all('[role="tab"]').find((t) => (t.textContent ?? '').trim().startsWith(text))
  assert.ok(tab, `there is a "${text}" tab`)
  await k.click(tab)
}

export const tabLabels = (k: Kit): string[] => k.all('[role="tab"]').map((t) => (t.textContent ?? '').trim())

/** A switch by its label. */
export function switchOf(k: Kit, label: string): HTMLInputElement | null {
  const l = k.all('label').find((x) => (x.textContent ?? '').trim() === label)
  return l ? (k.w.document.getElementById(l.getAttribute('for') ?? '') as HTMLInputElement | null) : null
}

export async function toggle(k: Kit, el: HTMLInputElement): Promise<void> {
  await k.click(el)
}

export const refusal = (status: number, message: string, errors: Record<string, string[]>) => () => new ApiError(message, status, errors)
