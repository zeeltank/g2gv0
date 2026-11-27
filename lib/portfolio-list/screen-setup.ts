import { adminRows, ADMIN_CAN, envelope, matchesData } from './fixtures'
import { LAYOUT_STORAGE_KEY } from './layout'
import { MENU_ROWS, menuOf, screenKit, type Call } from './screen-kit'
import type { MatchesData, PortfolioCan, PortfolioListEnvelope, PortfolioRow } from '../../services/product-master/portfolio-list-types'

/**
 * The Product Portfolio list mounted in a fake browser, with the Laravel API replaced by a small fake that answers each endpoint the screen calls.
 * Every request is recorded (address, query, body, headers), so a test can say "the Type filter reached the server as `type=service`".
 * Call after dom-test-kit has been imported by the test file (it needs the fake DOM).
 */
export interface SetupOptions {
  search?: string
  rows?: PortfolioRow[]
  can?: PortfolioCan
  canManage?: boolean
  /** Drawn inside Market Signals (the Product Portfolio tab): no title of its own. */
  embedded?: boolean
  /** Replaces the list answer. Gets the request's query; return the envelope (or throw / return a `__status` body to refuse). */
  list?: (query: URLSearchParams, call: Call) => unknown
  matches?: MatchesData | 'forbidden' | 'fail'
  /** Called for every request first; return something other than `undefined` to answer it yourself. */
  intercept?: (call: Call) => unknown
  menu?: ReturnType<typeof menuOf>
  /** The whole-list total the fake reports, when more than `rows` (paging tests). */
  total?: number
  lastPage?: number
  /** The List | Grid choice this browser remembered before the page opened (the address may still override it). Absent: nothing remembered, whatever an earlier test left. */
  remembered?: string
  /** Runs after the fake browser exists and before the page is drawn: a test that needs the browser's storage to refuse, for one. */
  beforeMount?: (w: Window & typeof globalThis) => void
}

export const LINES = [{ id: 1, key: 'scholarclone', name: 'ScholarClone' }, { id: 2, key: 'g2g', name: 'G2G' }]
export const READINESS = ['Prototype', 'Live – with client', 'Deferred']
export const PEOPLE = [{ id: 7, first_name: 'Asha', last_name: 'Rao' }, { id: 8, first_name: 'Ravi', last_name: 'Shah' }]

export async function setup(opts: SetupOptions = {}) {
  const sk = await screenKit({
    search: opts.search ?? '',
    menu: opts.menu ?? menuOf(MENU_ROWS.products, MENU_ROWS.services),
    respond: (call) => {
      const early = opts.intercept?.(call)
      if (early !== undefined) return early
      const p = call.path
      if (p.endsWith('/product-master/list')) {
        if (opts.list) return opts.list(call.query, call)
        const rows = opts.rows ?? adminRows()
        const meta: Partial<PortfolioListEnvelope['meta']> = {}
        if (opts.total !== undefined) meta.total = opts.total
        if (opts.lastPage !== undefined) meta.lastPage = opts.lastPage
        return envelope(rows, opts.can ?? ADMIN_CAN, { page: Number(call.query.get('page') ?? 1), ...meta })
      }
      if (p.endsWith('/product-master/lines')) return { status: 1, data: LINES }
      if (p.endsWith('/product-master/meta')) return { status: 1, data: { readinessStatuses: READINESS, itemTypes: ['product', 'service'], taxRates: [], can: {} } }
      if (p.endsWith('/product-master/matches') && call.method === 'GET') {
        if (opts.matches === 'forbidden') return { __status: 403, status: 0, message: 'Only an administrator can review possible product matches.' }
        if (opts.matches === 'fail') return { __status: 500, status: 0, message: 'The matches could not be worked out.' }
        return { status: 1, data: opts.matches ?? matchesData([]) }
      }
      if (p.endsWith('/table_data')) return PEOPLE
      return undefined
    },
  })
  // A remembered layout from an earlier test in this file must not leak into this one: the fake browser (and its storage) lives as long as the test process.
  sk.k.w.localStorage.removeItem(LAYOUT_STORAGE_KEY)
  if (opts.remembered !== undefined) sk.k.w.localStorage.setItem(LAYOUT_STORAGE_KEY, opts.remembered)
  opts.beforeMount?.(sk.k.w)
  const { PortfolioList } = await import('../../components/domain/portfolio/portfolio-list')
  await sk.mount(sk.k.h(PortfolioList, { canManage: opts.canManage ?? true, embedded: opts.embedded }))

  const text = () => sk.k.bodyText()
  /** The request the list sent last, as its query string. */
  const lastList = () => sk.to('/product-master/list').at(-1)

  const { k } = sk
  /** A labelled select of the toolbar. */
  const facet = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement | undefined
  const setSelect = async (select: HTMLSelectElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(30)
  }
  const choose = async (label: string, value: string) => {
    const select = facet(label)
    if (!select) throw new Error(`no filter called ${label}`)
    await setSelect(select, value)
  }
  /** The table row whose first cells name this record (a group header row is found by its name too). */
  const rowOf = (name: string) => k.all('tbody tr').find((tr) => tr.textContent?.includes(name)) as HTMLElement | undefined
  const heads = () => k.all('thead th').map((th) => th.textContent?.trim() ?? '')
  const openMore = async () => {
    const trigger = k.all('button').find((b) => b.getAttribute('aria-label') === 'More actions')
    if (!trigger) throw new Error('there is no More menu')
    await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await k.tick(20)
  }
  const menuItems = () => k.all('[role="menuitem"]')
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim() === label)
  return { ...sk, text, lastList, facet, setSelect, choose, rowOf, heads, openMore, menuItems, button }
}
