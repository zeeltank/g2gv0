import assert from 'node:assert/strict'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import type { ProductsResponse } from '../../services/portfolio/types'
import type { SignalRun } from '../../services/signal-review/runs-service'
import type { OpportunityListResponse, OpportunityQuery, ResearchRun, ResearchStatusResponse } from '../../services/signals/opportunities'
import { opportunity, opportunityList, portfolioProducts } from './opportunity-fixtures'
import { routerHarness } from './router-harness'
import { historyEntry } from './signal-fixtures'

/**
 * The whole Company Opportunities screen in a fake browser, for the tests of the abilities the Signal Review screen had (run health and cost, export,
 * the Generate checks): the address kept by a stand-in router, and every service the screen talks to replaced by a fake that records what it is asked.
 * Test support only: it has no tests of its own. It never touches the network, and a service it does not fake is not reached by these screens.
 */

export type Kit = Awaited<ReturnType<typeof kit>>
type Status = ResearchStatusResponse['data']

export interface ScreenOptions {
  /** The address's search part, as `?` would carry it. */
  search?: string
  remembered?: string
  /** The opportunity list. Called once per request, with what the screen asked. */
  list?: (q: OpportunityQuery) => Promise<OpportunityListResponse>
  /** The products of the Product Portfolio (what Generate, the pickers and the Main Product box read). */
  products?: () => Promise<ProductsResponse>
  /** The research status the Generate check reads. Receives the product it was asked about. */
  status?: (product: string | undefined) => Promise<{ status: number; data: Status }>
  /** Starting a run. The default accepts it and answers with run 7. */
  runResearch?: (...args: unknown[]) => Promise<{ status: number; message: string; data?: { run_id: number; run: ResearchRun } }>
  /** Following a run. */
  getRun?: (id: number) => Promise<{ status: number; data: ResearchRun }>
  /** The organisation's runs, as Run health & cost reads them. */
  runs?: () => Promise<SignalRun[]>
  /** Leave the runs service alone, so a test that replaces `fetch` sees the REAL request it builds. */
  realRuns?: boolean
  /** Leave the opportunity list alone, so a test that replaces `fetch` sees the REAL request the list and the export build. */
  realList?: boolean
  /** Leave "start a run" alone, so a test that replaces `fetch` sees the REAL request and the real refusal it turns into. */
  realRun?: boolean
}

export const CONTEXT = { organizationId: 1, subInstituteId: 1, userId: 2 } as never

let realRunsList: SignalRunsList | null = null
type SignalRunsList = typeof import('../../services/signal-review/runs-service').signalRunsService.list
let realList: OpportunityList | null = null
type OpportunityList = typeof import('../../services/signals/opportunities').opportunitiesService.list
let realRunResearch: RunResearch | null = null
type RunResearch = typeof import('../../services/signals/opportunities').opportunitiesService.runResearch

/** A status the Generate check accepts: providers set up, nothing running, the asked product ready. */
export function readyStatus(product: string | undefined, over: Partial<Status> = {}): { status: number; data: Status } {
  const model = { ready: true, missing: [] as string[], configured: true }
  return {
    status: 1,
    data: {
      requirements: { profile_complete: true, profile_missing: [], search_configured: true, search_driver: 'x', ai_configured: true, research_enabled: true },
      product: product ? { key: product, label: product, ready: true, missing: [], icp_models: { b2b: model, b2c: model, b2g: model } } : null,
      running: false,
      latest_run: null,
      last_successful_run: null,
      next_scheduled_at: null,
      timezone: 'Asia/Kolkata',
      ...over,
    } as Status,
  }
}

/** A research run as the server presents it, with the figures a test cares about changed. */
export function researchRun(over: Partial<ResearchRun> = {}): ResearchRun {
  return {
    id: 7, product_key: 'scholarclone', report_date: '2026-11-13', trigger: 'manual', status: 'running', stage: 'searching', stage_message: 'Searching the web…',
    started_at: '2026-11-13T09:00:00+05:30', completed_at: null, duration_ms: null, queries_run: 3, queries_failed: 0, sources_found: 1, companies_researched: 0,
    opportunities_qualified: 0, opportunities_new: 0, opportunities_rejected: 0, search_provider: 'x', error_code: null, error_message: null, ...over,
  } as ResearchRun
}

export async function openScreen(options: ScreenOptions = {}) {
  const k = await kit()
  const router = await routerHarness(options.search ?? '', '/signals')
  const { opportunitiesService } = await import('../../services/signals/opportunities')
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  const { signalReviewService } = await import('../../services/signal-review/signal-review-service')
  const { signalRunsService } = await import('../../services/signal-review/runs-service')
  const { CompanyOpportunities } = await import('../../components/domain/signals/company-opportunities')

  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  if (options.remembered) k.w.localStorage.setItem('g2g_product_1', options.remembered)
  // next/link reads `self` while it renders; the fake browser does not define it.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })

  const listCalls: OpportunityQuery[] = []
  const runCalls = { runDates: 0, status: [] as Array<string | undefined>, runResearch: [] as unknown[][], getRun: [] as number[], products: 0, runs: 0 }

  // The service objects are shared by every screen the process opens, so the real methods are kept the first time and put back for a test that wants them.
  realList ??= opportunitiesService.list
  realRunResearch ??= opportunitiesService.runResearch
  Object.assign(opportunitiesService, {
    list: options.realList ? realList : async (_c: unknown, q: OpportunityQuery) => { listCalls.push(q); return options.list ? options.list(q) : opportunityList() },
    getRunDates: async () => { runCalls.runDates += 1; return { status: 1, data: { product: 'x', timezone: 'Asia/Kolkata', dates: [] } } },
    getStatus: async (_c: unknown, product?: string) => { runCalls.status.push(product); return options.status ? options.status(product) : readyStatus(product) },
    runResearch: options.realRun ? realRunResearch : async (...args: unknown[]) => {
      runCalls.runResearch.push(args)
      return options.runResearch ? options.runResearch(...args) : { status: 1, message: 'Research started.', data: { run_id: 7, run: researchRun() } }
    },
    getRun: async (_c: unknown, id: number) => { runCalls.getRun.push(id); return options.getRun ? options.getRun(id) : { status: 1, data: researchRun({ id }) } },
  })
  Object.assign(portfolioService, { getProducts: async () => { runCalls.products += 1; return options.products ? options.products() : portfolioProducts() } })
  Object.assign(signalReviewService, {
    decide: async () => { throw new Error('not used here') },
    history: async () => ({ status: 1, data: [historyEntry({ id: 5 })] }),
    promote: async () => { throw new Error('not used here') },
    get: async (id: number) => ({ status: 1, data: opportunity({ id }) }),
    productOptions: async () => ({ status: 1, data: [{ id: 4, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' }] }),
  })
  realRunsList ??= signalRunsService.list
  Object.assign(signalRunsService, options.realRuns ? { list: realRunsList } : { list: async () => { runCalls.runs += 1; return options.runs ? options.runs() : [] } })

  await k.render(router.wrap(k.h(CompanyOpportunities, { context: CONTEXT })))
  await k.tick(20)

  const facet = (label: string) => k.all('select').find((s) => k.w.document.querySelector(`label[for="${s.id}"]`)?.textContent === label) as HTMLSelectElement
  const setSelect = async (select: HTMLSelectElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(select, value); select.dispatchEvent(new k.w.Event('change', { bubbles: true })) })
    await k.tick(20)
  }
  const choose = (label: string, value: string) => setSelect(facet(label), value)
  const mainProduct = () => k.one('#main-product-select') as HTMLSelectElement
  const generate = () => k.withText('Generate Signals') as HTMLButtonElement | null
  const dialogs = () => k.all('[role="dialog"]')

  return { k, router, listCalls, runCalls, facet, choose, setSelect, mainProduct, generate, dialogs }
}

/**
 * Lets the browser's download be seen: `URL.createObjectURL` remembers the file's bytes and the anchor's click is recorded instead of started. Call the
 * returned `restore` in a `finally`, because the stand-ins are global.
 */
export function captureDownloads(k: Kit) {
  const downloads: Array<{ name: string; blob: Blob }> = []
  const realCreate = URL.createObjectURL
  const realRevoke = URL.revokeObjectURL
  const realClick = k.w.HTMLAnchorElement.prototype.click
  let lastBlob: Blob | null = null
  URL.createObjectURL = ((blob: Blob) => { lastBlob = blob; return 'blob:test' }) as typeof URL.createObjectURL
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL
  k.w.HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) { downloads.push({ name: this.download, blob: lastBlob! }) }
  return {
    downloads,
    restore: () => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; k.w.HTMLAnchorElement.prototype.click = realClick },
    /** The bytes of the last file. */
    lastBytes: async () => new Uint8Array(await downloads[downloads.length - 1].blob.arrayBuffer()),
    /** The text of the last file, with its byte-order mark kept (a decoder drops it unless told not to). */
    lastText: async () => new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(await downloads[downloads.length - 1].blob.arrayBuffer())),
  }
}

/**
 * Presses the button with this label. A missing button fails the test on the spot: pressing "nothing" inside React's act() leaves the act unfinished, and the
 * test then HANGS instead of failing (a mutation run found this the slow way: it never came back).
 */
export async function pressLabel(k: Kit, label: string): Promise<void> {
  const button = k.withText(label)
  assert.ok(button, `there is a "${label}" button`)
  await k.click(button)
}

export { disposeAll }
