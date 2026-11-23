import type { kit } from '../scaffolds/dom-test-kit'
import type { PickerRow, ProductLineRow } from '../../services/product-master/picker-service'

/**
 * Test support for the shared product picker and for every screen that uses it: a fake network (`fetch` replaced, so the REAL services build the REAL
 * requests), a catalogue the fake server answers from, and helpers to type into the picker and choose a row. It has no tests of its own. It never touches a
 * real network; a request it has no answer for gets a 404 and is listed in `calls`, so a screen that reaches for an old endpoint is seen.
 */
export type Kit = Awaited<ReturnType<typeof kit>>

export interface CatalogueEntry extends PickerRow {
  /** `sold` is offered by the picker; the others are only found by name (`paused`, `binned`, `not_sold`). */
  state: 'sold' | 'paused' | 'binned' | 'not_sold'
}

export interface Call {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

export interface Reply {
  status?: number
  body: unknown
  /** Answer after this many milliseconds (a slow server). */
  delay?: number
}

export interface ApiOptions {
  catalogue?: CatalogueEntry[]
  lines?: ProductLineRow[]
  /** The picker answers 403 (a person with no right to prices). */
  pickerForbidden?: boolean
  /** The picker answers 500 while this returns true (it is told the text searched for). */
  pickerFails?: (q: string) => boolean
  /** The server sends no price (a person who may not see them): every row has `unitPrice: null`. */
  hidePrices?: boolean
  /** How long to take over a search for this text. */
  pickerDelay?: (q: string) => number
  /** The screen's own routes, asked first. Return undefined for a request that is not yours. */
  extra?: (call: Call) => Reply | undefined | Promise<Reply | undefined>
}

export const CATALOGUE: CatalogueEntry[] = [
  { crmProductId: 10, masterId: 23, name: 'Scholar Nine', productName: 'ScholarClone', sku: 'SCH-09-SKU', unitPrice: 999, currency: 'INR', taxRateId: 4, type: 'product', state: 'sold' },
  { crmProductId: 11, masterId: 24, name: 'Scholar School ERP', productName: 'ScholarClone', sku: 'SCH-ERP', unitPrice: 25000, currency: 'INR', taxRateId: null, type: 'product', state: 'sold' },
  { crmProductId: 12, masterId: 25, name: 'Implementation Support', productName: 'ScholarClone', sku: 'IMP-SVC', unitPrice: 5000, currency: 'INR', taxRateId: 5, type: 'service', state: 'sold' },
  { crmProductId: 13, masterId: 26, name: 'LMS Basic', productName: 'LMS-PAL', sku: 'LMS-B', unitPrice: 1500, currency: 'INR', taxRateId: null, type: 'product', state: 'sold' },
  { crmProductId: 14, masterId: 27, name: 'Loose Add-on', productName: null, sku: null, unitPrice: 100, currency: 'INR', taxRateId: null, type: 'product', state: 'sold' },
  { crmProductId: 15, masterId: 28, name: 'Old Gujarat Edition', productName: 'ScholarClone', sku: 'SCH-GUJ', unitPrice: 800, currency: 'INR', taxRateId: null, type: 'product', state: 'paused' },
  { crmProductId: 16, masterId: 29, name: 'Retired Pack', productName: 'LMS-PAL', sku: 'LMS-OLD', unitPrice: 50, currency: 'INR', taxRateId: null, type: 'product', state: 'binned' },
]

export const LINES: ProductLineRow[] = [
  { id: 1, key: 'scholarclone', name: 'ScholarClone' },
  { id: 2, key: 'lms-pal', name: 'LMS-PAL' },
]

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** What the fake server answers to the catalogue requests (the picker, the Product list, a record by catalogue id or by master id); undefined for anything else. */
export async function answerCatalogue(call: Pick<Call, 'method' | 'path' | 'query'>, options: ApiOptions = {}): Promise<Reply | undefined> {
  if (call.method !== 'GET') return undefined
  const catalogue = options.catalogue ?? CATALOGUE
  const lines = options.lines ?? LINES
  const path = call.path.replace(/^\/api/, '')

  if (path === '/product-master/picker') {
    const q = (call.query.get('q') ?? '').toLowerCase()
    const delay = options.pickerDelay?.(q) ?? 0
    if (delay > 0) await wait(delay)
    if (options.pickerForbidden) return { status: 403, body: { status: 0, message: 'You do not have the right to view prices of this kind of product.' } }
    if (options.pickerFails?.(q)) return { status: 500, body: { status: 0, message: 'Server error.' } }
    const type = call.query.get('type')
    const limit = Math.min(50, Number(call.query.get('limit') ?? 20))
    const rows = catalogue
      .filter((entry) => entry.state === 'sold' && (!type || entry.type === type) && (q === '' || entry.name.toLowerCase().includes(q) || (entry.sku ?? '').toLowerCase().includes(q)))
      .sort((a, b) => (a.productName ?? 'zzzz').localeCompare(b.productName ?? 'zzzz') || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(({ state: _state, ...row }) => ({ ...row, unitPrice: options.hidePrices ? null : row.unitPrice }))
    return { body: { status: 1, data: rows } }
  }
  if (path === '/product-master/lines') return { body: { status: 1, data: lines } }

  const byCrm = /^\/product-master\/by-crm\/(\d+)$/.exec(path)
  if (byCrm) {
    const entry = catalogue.find((e) => e.crmProductId === Number(byCrm[1]))
    return entry ? { body: { status: 1, data: { id: entry.masterId, kind: 'sub_product' } } } : { status: 404, body: { status: 0, message: 'Product not found.' } }
  }
  const master = /^\/product-master\/(\d+)$/.exec(path)
  if (master) {
    const entry = catalogue.find((e) => e.masterId === Number(master[1]))
    if (entry) return { body: { status: 1, data: { id: entry.masterId, name: entry.name, parent: entry.productName ? { id: 1, name: entry.productName } : null, sell: { state: entry.state } } } }
    const line = lines.find((l) => l.id === Number(master[1]))
    if (line) return { body: { status: 1, data: { id: line.id, name: line.name, parent: null, sell: null } } }
    return { status: 404, body: { status: 0, message: 'Product not found.' } }
  }
  return undefined
}

/** The same answers as a `respond` function for the Leads screen kit (lib/leads/screen-kit.ts): the body, with `__status` for a refusal. A request that is not the catalogue's is `undefined`. */
export function catalogueResponder(options: ApiOptions = {}) {
  return async (call: Pick<Call, 'method' | 'path' | 'query'>): Promise<unknown> => {
    const reply = await answerCatalogue(call, options)
    if (!reply) return undefined
    return reply.status && reply.status !== 200 ? { ...(reply.body as object), __status: reply.status } : reply.body
  }
}

export interface Api {
  calls: Call[]
  /** Every request to the picker, in order. */
  searches: () => Call[]
  /** The text of every picker request, in order. */
  searchTexts: () => string[]
  /** Every request whose path ends with this. */
  to: (suffix: string) => Call[]
}

const json = (reply: Reply) => new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } })

/** Signs a person in (a token the shared client sends as a bearer header) and replaces `fetch` with the fake server. */
export function installApi(k: Kit, options: ApiOptions = {}): Api {
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
  const calls: Call[] = []

  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const call: Call = {
      method: init?.method ?? 'GET',
      path: url.pathname.replace(/^\/api/, ''),
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    }
    calls.push(call)
    const own = options.extra ? await options.extra(call) : undefined
    if (own) { if (own.delay) await wait(own.delay); return json(own) }
    const reply = await answerCatalogue(call, options)
    if (reply) return json(reply)
    return json({ status: 404, body: { status: 0, message: `not faked: ${call.method} ${call.path}` } })
  }) as typeof fetch

  return {
    calls,
    searches: () => calls.filter((c) => c.path === '/product-master/picker'),
    searchTexts: () => calls.filter((c) => c.path === '/product-master/picker').map((c) => c.query.get('q') ?? ''),
    to: (suffix) => calls.filter((c) => c.path.endsWith(suffix)),
  }
}

/** Types into the picker's search box one letter at a time, as a person does (React's value setter, then an input event). */
export async function typeInto(k: Kit, input: HTMLInputElement, text: string, gapMs = 0) {
  for (let i = 1; i <= text.length; i++) {
    await k.act(async () => {
      const setter = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, text.slice(0, i))
      input.dispatchEvent(new k.w.Event('input', { bubbles: true }))
    })
    if (gapMs > 0) await k.tick(gapMs)
  }
}

/** The picker's box (the button that opens the list), the nth one in the document. */
export const box = (k: Kit, index = 0) => k.all('[data-picker-trigger]')[index] ?? null
export const searchBox = (k: Kit) => k.one('[data-picker-search]') as HTMLInputElement | null
export const optionNames = (k: Kit) => k.all('[role="option"]').map((o) => o.querySelector('span span')?.textContent ?? '')
export const optionById = (k: Kit, crmProductId: number) => k.one(`[data-picker-option="${crmProductId}"]`)

/** Opens the picker at `index` and waits for its first answer. */
export async function openPicker(k: Kit, index = 0, settleMs = 30) {
  await k.click(box(k, index)!)
  await k.tick(settleMs)
}

/** Opens the picker, then chooses the row for this catalogue id. */
export async function pick(k: Kit, crmProductId: number, index = 0) {
  await openPicker(k, index)
  const row = optionById(k, crmProductId)
  if (!row) throw new Error(`the picker does not offer catalogue id ${crmProductId}; it offers ${optionNames(k).join(', ')}`)
  await k.click(row)
  await k.tick(10)
}
