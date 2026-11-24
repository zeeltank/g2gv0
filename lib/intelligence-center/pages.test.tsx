import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { axeViolations } from '../agent/a11y'
import type { DetectorSummary, Insight, IntelligenceApi } from '../../services/intelligence/types'
import { allModuleLinks, areaById, domainById, insightHref, insightPageFor } from './domains'
import { COVERAGE_REGISTRY } from './coverage-registry'
import { MODULE_INTELLIGENCE, moduleIntelligenceByKey, moduleIntelligenceHref } from './modules'
import { detectorList, entities, insightOf, insightsData, META, PLATFORM_DETECTOR_IDS, THIN_COVERAGE } from './fixtures'
import { fakeIntelligenceService, pagedInsights } from './fake-service'

afterEach(disposeAll)

const failWith = (status: number) => async (): Promise<never> => {
  throw Object.assign(new Error(`SQLSTATE secret detail ${status}`), { status })
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

/* ── test-only scenario ───────────────────────────────────────────────── */

const LEAVE = insightOf('hr.leave_attention', {
  key: 'hr.leave_attention:org:2026-11',
  severity: 'critical',
  surfaces: ['hr_dashboard', 'leave'],
  title: 'Leave approvals are waiting too long',
  what_happened: '6 leave requests have waited more than 48 hours.',
  why_it_matters: 'People cannot plan time off while approvals are stuck.',
  suggested_action: 'Ask approvers to clear the oldest requests.',
  deep_link: '/dashboard/leave-management',
  evidence: [{ kind: 'metric', label: 'Requests waiting', value: 6, unit: 'requests', source: 'Leave approvals' }, ...entities('leave_request', 6, 'Leave request')],
})
const CRM = insightOf('commercial.deal_health', {
  key: 'commercial.deal_health:crm:2026-11',
  severity: 'high',
  surfaces: ['crm_opportunities'],
  title: 'Opportunities have not been touched',
  what_happened: '11 open opportunities have no recent update.',
  why_it_matters: 'Quiet opportunities tend to be forgotten.',
  suggested_action: 'Review each quiet opportunity with its owner.',
  deep_link: '/module/crm/sales/opportunities',
  evidence: [{ kind: 'window', label: 'Window', from: '2026-10-01', to: '2026-11-21' }, ...entities('crm_opportunity', 11, 'Opportunity')],
  confidence: 'rule_based',
})
const GTM = insightOf('commercial.deal_health', {
  key: 'commercial.deal_health:gtm:2026-11',
  severity: 'attention',
  surfaces: ['gtm_deals', 'gtm_command_center'],
  title: 'Deals have no next step',
  what_happened: '4 GTM deals have no next step.',
  why_it_matters: 'A deal with no next step stalls.',
  suggested_action: 'Agree a next step on each deal.',
  deep_link: '/gtm/deals',
  evidence: entities('gtm_deal', 4, 'Deal'),
})
const TASKS = insightOf('hr.task_workflow', {
  key: 'hr.task_workflow:org:est',
  severity: 'info',
  surfaces: ['tasks'],
  title: 'Task completion may be slowing',
  what_happened: 'An estimate suggests completion may slow.',
  why_it_matters: 'Slower completion delays work downstream.',
  confidence: 'ai_estimate',
  suggested_action: null,
  deep_link: '/module/task-management/task-management-dashboard',
})
const UNKNOWN = insightOf('x.brand_new_detector', { key: 'x.brand_new_detector:1', severity: 'attention', surfaces: [], title: 'A finding from a new check' })
const ALL = [LEAVE, CRM, GTM, TASKS]

function service(overrides: Partial<IntelligenceApi> = {}, insights: Insight[] = ALL, detectors: DetectorSummary[] = detectorList()) {
  return fakeIntelligenceService({
    insights: pagedInsights(insights),
    detectors: async () => ({ status: 1, data: { detectors, meta: META } }),
    ...overrides,
  })
}

type Page = 'IntelligenceHome' | 'DomainPage' | 'AreaPage' | 'InsightDetailPage' | 'ModuleIntelligencePage'

async function mount(page: Page, props: Record<string, unknown>, api = service(), opts: { cooldownMs?: number } = {}) {
  const k = await kit()
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
  const router = await routerHarness('', '/intelligence')
  const components = await import('../../components/domain/intelligence')
  const Page = components[page] as unknown
  const Provider = components.IntelligenceProvider as unknown
  await k.render(router.wrap(k.h(Provider, { service: api.service, cooldownMs: opts.cooldownMs ?? 0 }, k.h(Page, props))))
  await k.tick(20)
  const text = () => k.bodyText().replace(/\s+/g, ' ')
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (el: Element | null | undefined) => { assert.ok(el, 'the control exists'); await k.click(el); await k.tick(20) }
  const hrefs = () => k.all('a[href]').map((a) => a.getAttribute('href') as string)
  return { k, ...api, text, button, press, hrefs }
}

/** Every link that can be drawn must go somewhere that exists: an Intelligence page, a verified module link, a verified record page, or an insight's own deep link. */
// Registry routes are verified to exist by coverage-registry.test.ts, so a link to one is a link to a real screen.
const MODULE_HREFS = new Set([...allModuleLinks().map((l) => l.href), ...COVERAGE_REGISTRY.flatMap((r) => (r.route ? [r.route] : []))])
const DEEP_LINKS = new Set([LEAVE, CRM, GTM, TASKS].map((i) => i.deep_link as string))
function resolves(href: string): boolean {
  const path = href.split('?')[0]
  if (/^\/intelligence(\/|$)/.test(path)) {
    const moduleMatch = /^\/intelligence\/module\/([^/]+)$/.exec(path)
    if (moduleMatch) return moduleIntelligenceByKey(decodeURIComponent(moduleMatch[1])) !== null
    const [domain, area, key, ...rest] = path.split('/').slice(2).map((s) => decodeURIComponent(s))
    if (rest.length > 0) return false
    if (domain === undefined) return true
    if (!domainById(domain)) return false
    if (area === undefined) return true
    return areaById(domain, area) !== null && (key === undefined || key.length > 0)
  }
  if (MODULE_HREFS.has(path) || DEEP_LINKS.has(path)) return true
  return /^\/module\/crm\/sales\/(opportunities|invoices)\/\d+$/.test(path) || /^\/organization\/departments\/\d+$/.test(path) || path === '/gtm/deals'
}
function assertLinksResolve(hrefs: string[]) {
  const bad = hrefs.filter((h) => !resolves(h))
  assert.deepEqual(bad, [], 'links that do not resolve to a known screen')
  assert.equal(hrefs.filter((h) => /^(https?:)?\/\//.test(h) || h.startsWith('javascript:')).length, 0)
}

/* ── Home ─────────────────────────────────────────────────────────────── */

describe('Intelligence home', () => {
  it('shows a loading state while the one load is pending', async () => {
    const pending = deferred<{ status: number; data: ReturnType<typeof insightsData> }>()
    const { k } = await mount('IntelligenceHome', {}, service({ insights: () => pending.promise }))
    const loading = k.one('[data-intelligence-state="loading"]')
    assert.ok(loading)
    assert.equal(loading.getAttribute('role'), 'status')
    pending.resolve({ status: 1, data: insightsData([]) })
  })

  it('answers the first screen: purpose, refresh, last updated, provisional pill, the overview with counts in words, and seven domain cards', async () => {
    const { k, text, calls, button } = await mount('IntelligenceHome', {})
    assert.equal(k.one('h1')?.textContent, 'Intelligence')
    assert.ok(button('Refresh'))
    assert.match(text(), /Last updated 21 Nov 2026, 09:30 UTC/)
    assert.equal(k.one('[data-provisional-banner]')?.textContent, 'Provisional thresholds')
    assert.equal(k.one('[data-summary="critical"]')?.textContent, 'Critical1')
    assert.equal(k.one('[data-summary="high"]')?.textContent, 'High priority1')
    assert.equal(k.one('[data-summary="attention"]')?.textContent, 'Needs a look1')
    assert.equal(k.one('[data-summary="info"]')?.textContent, 'For information1')
    assert.match(k.one('[data-domain-tally]')?.textContent ?? '', /need attention/)
    assert.match(k.one('[data-confidence]')?.textContent ?? '', /This picture rests on 15 of 15 checks that had enough data/)
    assert.equal(k.all('[data-domain-card]').length, 7)
    assert.deepEqual(k.all('[data-domain-card] h3').map((h) => h.textContent), [
      'People & Workforce Health', 'Talent Acquisition & Onboarding', 'Capability, Learning & Certification', 'Work Execution', 'Sales, CRM & Revenue', 'Market Signals', 'Platform, AI & Governance',
    ])
    assert.equal(calls.detectors, 1, 'the detectors were asked once')
    assert.equal(calls.insights.length, 1, 'and the insights once (one page)')
  })

  it('each domain card says its condition as a word, with the top finding, why it matters and the next action', async () => {
    const { k } = await mount('IntelligenceHome', {})
    const people = k.one('[data-domain-card="people-workforce"]')!
    assert.equal(people.getAttribute('data-condition'), 'needs_attention')
    assert.match(people.textContent ?? '', /Needs attention/)
    assert.match(people.textContent ?? '', /Leave approvals are waiting too long/)
    assert.match(people.textContent ?? '', /Why it matters: People cannot plan time off/)
    assert.match(people.textContent ?? '', /Next: Ask approvers to clear the oldest requests\./)
    assert.match(people.textContent ?? '', /1 needs attention/)
    assert.match(people.textContent ?? '', /checks had enough data/)
    assert.ok(people.querySelector('a[href="/intelligence/people-workforce"]'))
    const work = k.one('[data-domain-card="work-execution"]')!
    assert.equal(work.getAttribute('data-condition'), 'watch')
  })

  it('the platform domain, whose new checks have not reported, says Not yet assessed plainly (not Not connected) and is not counted as healthy', async () => {
    const { k } = await mount('IntelligenceHome', {})
    const card = k.one('[data-domain-card="platform-governance"]')!
    assert.equal(card.getAttribute('data-condition'), 'not_assessed')
    assert.match(card.textContent ?? '', /Not yet assessed/)
    assert.doesNotMatch(card.textContent ?? '', /Not connected|Healthy/)
  })

  it('management priorities: the top findings, most urgent first, each with a domain chip, why it matters, details and the module link', async () => {
    const { k, text } = await mount('IntelligenceHome', {})
    const items = k.all('[data-priorities] > li')
    assert.deepEqual(items.map((li) => li.querySelector('h3')?.textContent), ['Leave approvals are waiting too long', 'Opportunities have not been touched', 'Deals have no next step', 'Task completion may be slowing'])
    const first = items[0]
    assert.match(first.textContent ?? '', /Critical/)
    assert.match(first.textContent ?? '', /People & Workforce Health/)
    assert.match(first.textContent ?? '', /People cannot plan time off while approvals are stuck\./)
    assert.ok(first.querySelector(`a[href="${insightPageFor(LEAVE)}"]`), 'a click-through to the finding')
    assert.match(first.querySelector('a[href="/dashboard/leave-management"]')?.textContent ?? '', /^Open in Leave$/)
    assert.doesNotMatch(text(), /\(record \d+\)/)
  })

  it('connected views: Revenue chain and People capacity side by side, each stage with its condition and a link, and the no-causation sentence', async () => {
    const { k } = await mount('IntelligenceHome', {})
    const chains = k.all('[data-chain]')
    assert.deepEqual(chains.map((c) => c.getAttribute('data-chain')), ['revenue-related', 'people-capacity-related'])
    assert.deepEqual(chains.map((c) => c.querySelector('h3')?.textContent), ['Revenue-related checks', 'People-capacity-related checks'])
    assert.equal(k.one('[data-connected-views] ol'), null, 'no numbered list')
    assert.doesNotMatch(k.one('#connected')?.textContent ?? '', /chain|sequence|^\d/i)
    assert.equal(k.one('#connected h2')?.textContent, 'Related screens')
    assert.deepEqual(k.all('[data-chain="revenue-related"] [data-stage]').map((s) => s.getAttribute('data-stage')), ['Market signals', 'CRM opportunities', 'GTM deals', 'Customers & renewals', 'Invoices'])
    assert.deepEqual(k.all('[data-chain="people-capacity-related"] [data-stage]').map((s) => s.getAttribute('data-stage')), ['Recruitment', 'Onboarding', 'Attendance', 'Leave', 'Tasks'])
    for (const stage of k.all('[data-stage]')) {
      assert.ok(stage.querySelector('a[href^="/intelligence/"]'), stage.getAttribute('data-stage') ?? '')
      assert.ok(stage.querySelector('[data-chip="condition"]'))
    }
    assert.match(k.one('[data-stage="CRM opportunities"]')?.textContent ?? '', /Needs attention/)
    assert.equal(k.one('[data-connected-note]')?.textContent, 'These are shown together for context. The relationships between them are not measured.')
    assert.doesNotMatch(k.one('[data-connected-views]')?.textContent ?? '', /cause|because|leads to|drives/i)
  })

  it('"Checked, nothing to flag" lists only checks that ran with enough data and found nothing; opportunities are never invented', async () => {
    const detectors = detectorList({ 'hr.attendance_health': { state: 'insufficient_data' }, 'hr.leave_attention': { insight_count: 1 } })
    const { k } = await mount('IntelligenceHome', {}, service({}, [LEAVE], detectors))
    const clear = k.one('[data-clear-list]')?.textContent ?? ''
    assert.match(clear, /Check hr\.organisation_structure/)
    assert.doesNotMatch(clear, /hr\.attendance_health/)
    assert.doesNotMatch(clear, /hr\.leave_attention/)
    assert.equal(k.one('[data-opportunities]'), null, 'no hard-coded opportunities row on the home')
    assert.doesNotMatch(k.bodyText(), /None were detected/)
    assert.equal(k.one('[data-clear-list]')?.hasAttribute('open'), false, 'the list is collapsed by default')
  })

  it('empty: every check ran and found nothing -> an honest all-clear, no priorities, domains Healthy', async () => {
    const { k, text } = await mount('IntelligenceHome', {}, service({}, []))
    assert.equal(k.one('[data-intelligence-state="empty"]') !== null, true)
    assert.match(text(), /Nothing needs attention/)
    assert.equal(k.one('[data-domain-card="people-workforce"]')?.getAttribute('data-condition'), 'healthy')
    assert.match(k.one('[data-domain-card="people-workforce"]')?.textContent ?? '', /Checked, nothing to flag/)
    assert.equal(k.one('[data-priorities]'), null)
  })

  it('insufficient data: no all-clear is claimed, and the server reason is shown', async () => {
    const detectors = detectorList(Object.fromEntries(detectorList().map((d) => [d.detector, { state: 'insufficient_data' as const, coverage: THIN_COVERAGE, reason: THIN_COVERAGE.reason }])))
    const { k, text } = await mount('IntelligenceHome', {}, service({}, [], detectors))
    assert.equal(k.one('[data-domain-card="people-workforce"]')?.getAttribute('data-condition'), 'not_enough_data')
    assert.match(k.one('[data-domain-card="people-workforce"]')?.textContent ?? '', /Only 3 record\(s\) support this; at least 10 are needed\./)
    assert.match(text(), /Not enough data to assess yet/)
    assert.doesNotMatch(text(), /Nothing needs attention/)
    assert.doesNotMatch(k.one('[data-domain-cards]')?.textContent ?? '', /Healthy/)
    assert.match(k.one('[data-confidence]')?.textContent ?? '', /0 of 15 checks/)
  })

  it('not available for the role: domains with no authorised check say so, distinct from not connected and not enough data', async () => {
    const detectors = detectorList({}, ['hr.leave_attention'])
    const { k } = await mount('IntelligenceHome', {}, service({}, [], detectors))
    const talent = k.one('[data-domain-card="talent-onboarding"]')!
    assert.equal(talent.getAttribute('data-condition'), 'not_available')
    assert.match(talent.textContent ?? '', /Not available for your role/)
    assert.doesNotMatch(talent.textContent ?? '', /Not connected|Not enough data/)
    assert.equal(k.one('[data-domain-card="platform-governance"]')?.getAttribute('data-condition'), 'not_assessed')
  })

  it('an unknown detector lands in an Other findings card (nothing dropped) with a working link', async () => {
    const { k, hrefs } = await mount('IntelligenceHome', {}, service({}, [UNKNOWN, ...ALL]))
    assert.equal(k.all('[data-domain-card]').length, 8)
    assert.ok(k.one('[data-domain-card="other"]'))
    assert.ok(hrefs().includes('/intelligence/other'))
    assert.match(k.bodyText(), /A finding from a new check/)
  })

  it('says how many findings were not loaded when the server has more than the cap', async () => {
    const many = Array.from({ length: 520 }, (_, i) => insightOf('hr.leave_attention', { key: `k${i}`, surfaces: ['leave'], severity: 'info' }))
    const { k, calls } = await mount('IntelligenceHome', {}, service({}, many))
    assert.equal(calls.insights.length, 4)
    assert.match(k.one('[data-truncated]')?.textContent ?? '', /first 200 findings of 520/)
    assert.ok(k.one('[data-summary="info"]')?.parentElement?.parentElement?.querySelector('[data-truncated]'), 'the sentence sits right by the severity tiles')
  })

  it('every link on the page resolves to a known screen, and no record is printed ten times', async () => {
    const { hrefs, text } = await mount('IntelligenceHome', {})
    assert.ok(hrefs().length > 20)
    assertLinksResolve(hrefs())
    assert.doesNotMatch(text(), /\(record \d+\)/)
  })

  it('Refresh loads again and keeps what is on screen', async () => {
    const { calls, button, press, text } = await mount('IntelligenceHome', {})
    await press(button('Refresh'))
    assert.equal(calls.detectors, 2)
    assert.match(text(), /Leave approvals are waiting too long/)
  })

  it('a failed refresh keeps the last findings and says so', async () => {
    let n = 0
    const { button, press, text, k } = await mount('IntelligenceHome', {}, service({
      insights: async (p) => {
        n += 1
        if (n > 1) throw Object.assign(new Error('boom'), { status: 500 })
        return pagedInsights(ALL)(p)
      },
    }))
    await press(button('Refresh'))
    assert.ok(k.one('[data-refresh-failed]'))
    assert.match(text(), /Leave approvals are waiting too long/)
  })

  it('shows a friendly error with Try again, without the server text, and recovers', async () => {
    let attempt = 0
    const { calls, button, press, text, k } = await mount('IntelligenceHome', {}, service({
      detectors: async () => {
        attempt += 1
        if (attempt === 1) throw Object.assign(new Error('SQLSTATE hidden'), { status: 500 })
        return { status: 1, data: { detectors: detectorList(), meta: META } }
      },
    }))
    assert.equal(k.one('[data-intelligence-state="error"]') !== null, true)
    assert.match(text(), /Intelligence could not be shown/)
    assert.doesNotMatch(text(), /SQLSTATE/)
    await press(button('Try again'))
    assert.ok(calls.detectors >= 2)
    assert.match(text(), /Organisation overview/)
  })

  it('forbidden (403): a clear "not available for your account" state, no retry, no server text', async () => {
    const { k, text, button } = await mount('IntelligenceHome', {}, service({ detectors: failWith(403) }))
    assert.equal(k.one('[data-intelligence-state="denied"]') !== null, true)
    assert.match(text(), /Intelligence is not available for your account/)
    assert.doesNotMatch(text(), /SQLSTATE/)
    assert.equal(button('Try again'), undefined)
  })

  it('unavailable (503): says it is switched off, with Try again', async () => {
    const { k, text, button } = await mount('IntelligenceHome', {}, service({ insights: failWith(503) }))
    assert.equal(k.one('[data-intelligence-state="unavailable"]') !== null, true)
    assert.match(text(), /Intelligence is switched off right now/)
    assert.ok(button('Try again'))
    assert.doesNotMatch(text(), /SQLSTATE/)
  })

  it('has no accessibility violations a fake browser can detect', async () => {
    const { k } = await mount('IntelligenceHome', {})
    const root = k.one('[data-intelligence-center]')
    assert.ok(root?.textContent?.includes('Management priorities'))
    assert.deepEqual(await axeViolations(root!), [])
  })
})

/* ── Domain ───────────────────────────────────────────────────────────── */

describe('Intelligence domain page', () => {
  it('breadcrumb, what is happening / what it means / why it matters from the findings own words, areas, evidence, actions and module links', async () => {
    const { k, text, hrefs } = await mount('DomainPage', { domainId: 'revenue-pipeline' })
    assert.deepEqual(k.all('[data-breadcrumb] li').map((li) => li.textContent), ['Intelligence', 'Sales, CRM & Revenue'])
    assert.ok(k.one('[data-breadcrumb] a[href="/intelligence"]'))
    assert.equal(k.one('h1')?.textContent, 'Sales, CRM & Revenue')
    const blocks = k.one('[data-summary-blocks]')?.textContent ?? ''
    assert.match(blocks, /What is happening/)
    assert.match(blocks, /11 open opportunities have no recent update\./)
    assert.match(blocks, /What it means/)
    assert.match(blocks, /2 open findings: 1 high priority or critical, 1 needs a look\./)
    assert.match(blocks, /Why it matters/)
    assert.match(blocks, /Quiet opportunities tend to be forgotten\./)
    assert.deepEqual(k.all('[data-area-card]').map((c) => c.getAttribute('data-area-card')), ['crm-opportunities', 'gtm-deals-pipeline', 'customers-renewals', 'invoices'])
    assert.equal(k.one('[data-area-card="crm-opportunities"]')?.getAttribute('data-condition'), 'needs_attention')
    assert.equal(k.one('[data-area-card="invoices"]')?.getAttribute('data-condition'), 'healthy')
    assert.ok(k.one('[data-coverage-block]'))
    assert.match(text(), /Evidence & coverage/)
    assert.match(text(), /Recommended actions/)
    assert.match(k.one('[data-actions]')?.textContent ?? '', /Review each quiet opportunity with its owner\./)
    for (const label of ['Open GTM Command Center', 'Open Opportunities', 'Open Invoices']) assert.ok(k.all('[data-module-links] a').some((a) => a.textContent?.trim().startsWith(label)), label)
    assert.ok(k.one('[data-back-link]'))
    assertLinksResolve(hrefs())
  })

  it('the Evidence & coverage block lists checks that could not assess first, with the server reason', async () => {
    const detectors = detectorList({ 'commercial.invoice_attention': { state: 'insufficient_data', coverage: THIN_COVERAGE, reason: THIN_COVERAGE.reason } })
    const { k } = await mount('DomainPage', { domainId: 'revenue-pipeline' }, service({}, ALL, detectors))
    const rows = k.all('[data-coverage-block] [data-detector]')
    assert.equal(rows[0].getAttribute('data-detector'), 'commercial.invoice_attention')
    assert.match(rows[0].textContent ?? '', /Not enough data/)
    assert.match(rows[0].textContent ?? '', /Only 3 record\(s\) support this; at least 10 are needed\./)
  })

  it('not yet assessed: says so, lists what has no check with real links, and explains this is not "fine"', async () => {
    const { k, hrefs } = await mount('DomainPage', { domainId: 'platform-governance' })
    assert.ok(k.one('[data-intelligence-state="not-assessed"]'))
    assert.equal(k.one('[data-intelligence-state="not-connected"]'), null)
    assert.match(k.bodyText(), /No check exists for this yet/)
    assert.deepEqual(k.all('[data-covers] a').map((a) => a.textContent?.trim()), [
      'Open Platform Services hub', 'Open Workflows', 'Open Communications', 'Open Documents', 'Open Reports (Sales & Marketing)', 'Open Reports (Learning)',
    ])
    assert.equal(k.one('[data-summary-blocks]'), null)
    assertLinksResolve(hrefs())
  })

  it('not available for the role: its own state, different from not connected', async () => {
    const { k, text } = await mount('DomainPage', { domainId: 'work-execution' }, service({}, [], detectorList({}, ['hr.leave_attention'])))
    assert.ok(k.one('[data-intelligence-state="not-available"]'))
    assert.match(text(), /Not available for your role/)
    assert.doesNotMatch(text(), /No intelligence source is connected/)
    assert.match(k.one('[data-unavailable]')?.textContent ?? '', /Tasks and workflow/)
  })

  it('insufficient data: says the checks could not fully assess, not that all is well', async () => {
    const detectors = detectorList({ 'hr.task_workflow': { state: 'insufficient_data', reason: 'Only 2 owners have tasks.' } })
    const { k } = await mount('DomainPage', { domainId: 'work-execution' }, service({}, [], detectors))
    assert.equal(k.one('h1')?.parentElement?.querySelector('[data-condition]')?.getAttribute('data-condition'), 'not_enough_data')
    assert.match(k.bodyText(), /Only 2 owners have tasks\./)
    assert.doesNotMatch(k.bodyText(), /Healthy/)
  })

  it('an unknown domain is a clear not-found state with a way home', async () => {
    const { k, hrefs } = await mount('DomainPage', { domainId: 'nonsense' })
    assert.ok(k.one('[data-intelligence-state="not-found"]'))
    assert.ok(hrefs().includes('/intelligence'))
    assert.equal(k.one('[data-summary-blocks]'), null)
  })

  it('loading, forbidden and error states keep a way back', async () => {
    const denied = await mount('DomainPage', { domainId: 'people-workforce' }, service({ detectors: failWith(403) }))
    assert.ok(denied.k.one('[data-intelligence-state="denied"]'))
    await disposeAll()
    const broken = await mount('DomainPage', { domainId: 'people-workforce' }, service({ detectors: failWith(500) }))
    assert.ok(broken.k.one('[data-intelligence-state="error"]'))
    assert.ok(broken.hrefs().includes('/intelligence'))
  })
})

/* ── Area ─────────────────────────────────────────────────────────────── */

describe('Intelligence area page', () => {
  it('breadcrumb to the area, findings as expandable cards most urgent first, coverage, and a plain statement that trends are not available', async () => {
    const more = [...ALL, insightOf('hr.leave_attention', { key: 'l2', severity: 'info', surfaces: ['leave'], title: 'A small leave note' })]
    const { k, hrefs, text } = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'leave' }, service({}, more))
    assert.deepEqual(k.all('[data-breadcrumb] li').map((li) => li.textContent), ['Intelligence', 'People & Workforce Health', 'Leave'])
    assert.ok(k.one('[data-breadcrumb] a[href="/intelligence/people-workforce"]'))
    assert.deepEqual(k.all('[data-finding]').map((f) => f.getAttribute('data-severity')), ['critical', 'info'])
    assert.equal(k.one('[data-trends]'), null, 'the trends note is in the domain evidence block, not on every area page')
    assert.ok(k.one('[data-coverage-block]'))
    assert.match(text(), /Open Leave Management/)
    assertLinksResolve(hrefs())
  })

  it('a card opens and closes (aria-expanded) and shows why it matters, the action and links to the full finding and the module', async () => {
    const { k, press, hrefs } = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'leave' })
    const toggle = k.one('[data-finding] button[aria-expanded]')!
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    const panel = k.all('[id]').find((el) => el.id === toggle.getAttribute('aria-controls'))!
    assert.equal(panel.hasAttribute('hidden'), true)
    await press(toggle)
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.hasAttribute('hidden'), false)
    assert.match(panel.textContent ?? '', /Why it matters: People cannot plan time off/)
    assert.match(panel.textContent ?? '', /What to do: Ask approvers/)
    assert.ok(hrefs().includes(insightHref('people-workforce', 'leave', LEAVE.key)))
    await press(toggle)
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  })

  it('the severity filter narrows the list and says when nothing matches', async () => {
    const more = [LEAVE, insightOf('hr.leave_attention', { key: 'l2', severity: 'info', surfaces: ['leave'] })]
    const { k, button, press } = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'leave' }, service({}, more))
    await press(button('For information'))
    assert.deepEqual(k.all('[data-finding]').map((f) => f.getAttribute('data-severity')), ['info'])
    assert.equal(button('For information')?.getAttribute('aria-pressed'), 'true')
    await press(button('High priority'))
    assert.equal(k.all('[data-finding]').length, 0)
    assert.ok(k.one('[data-filter-empty]'))
    await press(button('All'))
    assert.equal(k.all('[data-finding]').length, 2)
  })

  it('empty (healthy) and insufficient-data areas say which it is', async () => {
    const healthy = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'attendance' }, service({}, []))
    assert.match(healthy.k.one('[data-intelligence-state="empty"]')?.textContent ?? '', /Checked, nothing to flag/)
    await disposeAll()
    const thin = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'attendance' }, service({}, [], detectorList({ 'hr.attendance_health': { state: 'insufficient_data', reason: 'Only 4 people have records.' } })))
    assert.match(thin.k.one('[data-intelligence-state="empty"]')?.textContent ?? '', /Not enough data to assess yet/)
    assert.match(thin.k.bodyText(), /Only 4 people have records\./)
    assert.doesNotMatch(thin.k.bodyText(), /Checked, nothing to flag/)
  })

  it('unknown area -> not found with a link to its domain; unknown domain -> link home', async () => {
    const a = await mount('AreaPage', { domainId: 'people-workforce', areaId: 'nope' })
    assert.ok(a.k.one('[data-intelligence-state="not-found"]'))
    assert.ok(a.hrefs().includes('/intelligence/people-workforce'))
    await disposeAll()
    const b = await mount('AreaPage', { domainId: 'nope', areaId: 'nope' })
    assert.ok(b.k.one('[data-intelligence-state="not-found"]'))
    assert.ok(b.hrefs().includes('/intelligence'))
  })
})

/* ── Insight detail ───────────────────────────────────────────────────── */

describe('Intelligence finding page', () => {
  const open = (insight: Insight, api = service({}, [...ALL, insight])) =>
    mount('InsightDetailPage', { domainId: 'x', areaId: 'y', insightKey: encodeURIComponent(insight.key) }, api)

  it('answers the seven questions as headed sections, resolving the URL-encoded key from the loaded data', async () => {
    const { k, text, hrefs } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent(LEAVE.key) })
    assert.deepEqual(k.all('h2').map((h) => h.textContent), ['What is happening', 'What it means', 'Why it matters', 'What to do next', 'Evidence', 'How reliable is this', 'Where to act'])
    assert.equal(k.one('h1')?.textContent, 'Leave approvals are waiting too long')
    assert.match(k.one('[data-section="happening"]')?.textContent ?? '', /6 leave requests have waited more than 48 hours\./)
    assert.match(k.one('[data-section="means"]')?.textContent ?? '', /Critical|most urgent kind of finding/)
    assert.match(k.one('[data-section="why"]')?.textContent ?? '', /People cannot plan time off while approvals are stuck\./)
    assert.match(k.one('[data-section="next"]')?.textContent ?? '', /Ask approvers to clear the oldest requests\./)
    assert.match(k.one('[data-section="evidence"]')?.textContent ?? '', /Requests waiting: 6 requests/)
    assert.match(k.one('[data-section="evidence"]')?.textContent ?? '', /Source: Leave approvals/)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /Measured\. Counted from your records\./)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /Based on 12 of 15 active employees with a recorded expiry date \(80%\)/)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /As of 21 Nov 2026, 09:30 UTC/)
    assert.ok(k.one('[data-provisional-note]'))
    assert.deepEqual(k.all('[data-breadcrumb] li').map((li) => li.textContent), ['Intelligence', 'People & Workforce Health', 'Leave', 'Finding'])
    assert.ok(k.one('[data-section="act"] a[href="/dashboard/leave-management"]'))
    assert.ok(text().length > 0)
    assertLinksResolve(hrefs())
  })

  it('records of a kind with a page link to it: 11 opportunities become one line with 3 links and "and 8 more"', async () => {
    const { k, hrefs, text } = await mount('InsightDetailPage', { domainId: 'revenue-pipeline', areaId: 'crm-opportunities', insightKey: encodeURIComponent(CRM.key) })
    const records = k.one('[data-record-links]')!
    assert.match(records.textContent ?? '', /11 opportunities listed: Opportunity #1, Opportunity #2, Opportunity #3 and 8 more/)
    assert.deepEqual(Array.from(records.querySelectorAll('a')).map((a) => a.getAttribute('href')), ['/module/crm/sales/opportunities/1', '/module/crm/sales/opportunities/2', '/module/crm/sales/opportunities/3'])
    assert.equal(records.querySelector('[data-no-direct-page]'), null)
    assert.match(k.one('[data-section="evidence"]')?.textContent ?? '', /11 opportunities listed/)
    assert.doesNotMatch(text(), /\(record \d+\)/)
    assert.equal((text().match(/Opportunity #/g) ?? []).length, 3, 'only three records are named')
    assertLinksResolve(hrefs())
  })

  it('records of a kind WITHOUT a page are not linked: "no direct page: find it in <module>" with the module link', async () => {
    const { k } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent(LEAVE.key) })
    const records = k.one('[data-record-links]')!
    assert.match(records.textContent ?? '', /6 leave requests listed: Record #1, Record #2, Record #3 and 3 more/)
    assert.match(records.querySelector('[data-no-direct-page]')?.textContent ?? '', /No direct page for these records: find them in Leave Management\./)
    assert.deepEqual(Array.from(records.querySelectorAll('a')).map((a) => a.getAttribute('href')), ['/dashboard/leave-management'])
  })

  it('an AI estimate is never styled or worded as measured', async () => {
    const { k } = await open(TASKS)
    assert.equal(k.one('[data-chip="confidence"]')?.textContent, 'AI estimate')
    assert.match(k.one('[data-chip="confidence"]')?.className ?? '', /border-dashed/)
    assert.doesNotMatch(k.one('[data-chip="confidence"]')?.className ?? '', /border-success/)
    assert.match(k.one('[data-estimate-note]')?.textContent ?? '', /estimate and must not be read as a measured fact/)
    assert.doesNotMatch(k.one('[data-section="reliable"]')?.textContent ?? '', /Measured/)
    assert.match(k.one('[data-section="next"]')?.textContent ?? '', /No specific action was suggested/)
  })

  it('rule-based is labelled as such, and thin coverage says "Not enough data to assess" with the reason', async () => {
    const thin = insightOf('hr.leave_attention', { key: 'thin', surfaces: ['leave'], coverage: THIN_COVERAGE, confidence: 'rule_based' })
    const { k } = await open(thin)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /Rule-based\. A fixed rule applied to your records\./)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /Not enough data to assess/)
    assert.match(k.one('[data-section="reliable"]')?.textContent ?? '', /Only 3 record\(s\) support this; at least 10 are needed\./)
  })

  it('a finding that no longer exists shows "This finding is no longer open" with a way back', async () => {
    const { k, hrefs } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent('hr.leave_attention:gone') })
    assert.ok(k.one('[data-intelligence-state="no-longer-open"]'))
    assert.match(k.bodyText(), /This finding is no longer open/)
    assert.ok(hrefs().includes('/intelligence/people-workforce/leave'))
    assert.ok(hrefs().includes('/intelligence'))
  })

  it('works on a deep-link refresh: the same address resolves after a fresh load, from the URL alone', async () => {
    const key = 'hr.leave_attention:org:2026-11'
    const url = insightHref('people-workforce', 'leave', key)
    const segments = url.split('/')
    const { k } = await mount('InsightDetailPage', { domainId: segments[2], areaId: segments[3], insightKey: segments[4] })
    assert.equal(k.one('h1')?.textContent, 'Leave approvals are waiting too long')
  })

  it('shows loading, forbidden and unavailable states with a way back', async () => {
    const denied = await mount('InsightDetailPage', { domainId: 'a', areaId: 'b', insightKey: 'c' }, service({ insights: failWith(403) }))
    assert.ok(denied.k.one('[data-intelligence-state="denied"]'))
    await disposeAll()
    const off = await mount('InsightDetailPage', { domainId: 'a', areaId: 'b', insightKey: 'c' }, service({ insights: failWith(503) }))
    assert.ok(off.k.one('[data-intelligence-state="unavailable"]'))
    assert.ok(off.hrefs().includes('/intelligence'))
  })
})

/* ── review fixes ─────────────────────────────────────────────────────── */

const WITHHOLD = { ...META, suppressed_count: 2 }

describe('home layout and honesty', () => {
  it('management priorities come directly under the overview, before the domain cards', async () => {
    const { k } = await mount('IntelligenceHome', {})
    const ids = k.all('section[id]').map((s) => s.id)
    assert.deepEqual(ids.slice(0, 3), ['overview', 'priorities', 'domains'])
  })

  it('each domain card blurb is one line, and each priority card has one link to its finding plus the module link', async () => {
    const { k } = await mount('IntelligenceHome', {})
    assert.ok(k.all('[data-domain-card] p.line-clamp-1').length === 7)
    const first = k.all('[data-priorities] > li')[0]
    const hrefs = Array.from(first.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    assert.deepEqual(hrefs, [insightPageFor(LEAVE), '/dashboard/leave-management'])
    assert.doesNotMatch(first.textContent ?? '', /View details/)
    assert.doesNotMatch(first.firstElementChild?.parentElement?.className ?? '', /hover:-translate-y/, 'not wholly clickable: no hover lift')
  })

  it('results withheld from a small-group viewer: no Healthy anywhere, an honest empty state, and an empty clear list', async () => {
    const api = service({ insights: pagedInsights([], WITHHOLD) }, [])
    const { k, text } = await mount('IntelligenceHome', {}, api)
    assert.equal(k.all('[data-condition="healthy"]').length, 0)
    assert.equal(k.one('[data-domain-card="people-workforce"]')?.getAttribute('data-condition'), 'no_findings')
    assert.match(k.one('[data-domain-card="people-workforce"]')?.textContent ?? '', /No findings shown/)
    assert.match(k.one('[data-priorities-empty]')?.textContent ?? '', /No findings shown.*not an all-clear/)
    assert.doesNotMatch(text(), /Nothing needs attention|Healthy/)
    assert.match(k.one('[data-clear-list]')?.textContent ?? '', /\(0\)/)
  })

  it('a truncated load is not called healthy either', async () => {
    const many = Array.from({ length: 300 }, (_, i) => insightOf('hr.leave_attention', { key: `k${i}`, surfaces: ['leave'], severity: 'info' }))
    const { k } = await mount('IntelligenceHome', {}, service({}, many))
    assert.equal(k.one('[data-domain-card="talent-onboarding"]')?.getAttribute('data-condition'), 'no_findings')
  })

  it('a first-load 429 shows a friendly too-many-requests state with Try again, and a real heading', async () => {
    let n = 0
    const { k, text, button, press } = await mount('IntelligenceHome', {}, service({
      detectors: async () => {
        n += 1
        if (n === 1) throw Object.assign(new Error('SQLSTATE'), { status: 429 })
        return { status: 1, data: { detectors: detectorList(), meta: META } }
      },
    }))
    assert.equal(k.one('h1')?.textContent, 'Too many requests')
    assert.match(text(), /Try again in a minute/)
    assert.doesNotMatch(text(), /SQLSTATE/)
    await press(button('Try again'))
    assert.match(text(), /Organisation overview/)
  })

  it('error, loading and not-found states each have a proper h1', async () => {
    const pending = deferred<{ status: number; data: ReturnType<typeof insightsData> }>()
    const loading = await mount('IntelligenceHome', {}, service({ insights: () => pending.promise }))
    assert.equal(loading.k.all('h1').length, 1)
    pending.resolve({ status: 1, data: insightsData([]) })
    await disposeAll()
    const broken = await mount('IntelligenceHome', {}, service({ detectors: failWith(500) }))
    assert.equal(broken.k.one('h1')?.textContent, 'Intelligence could not be shown')
    await disposeAll()
    const missing = await mount('DomainPage', { domainId: 'nope' })
    assert.equal(missing.k.all('h1').length, 1)
  })

  it('Refresh is off for a few seconds after a load (the API rate limit), and on when the cooldown is over', async () => {
    const cold = await mount('IntelligenceHome', {}, service(), { cooldownMs: 60_000 })
    assert.equal(cold.button('Refresh')?.disabled, true)
    await cold.press(cold.button('Refresh'))
    assert.equal(cold.calls.detectors, 1, 'a press during the cooldown asks for nothing')
    await disposeAll()
    const warm = await mount('IntelligenceHome', {}, service(), { cooldownMs: 30 })
    await warm.k.tick(80)
    assert.equal(warm.button('Refresh')?.disabled, false)
  })
})

describe('shared detectors and empty buckets', () => {
  it('an empty CRM opportunities area never says Healthy: it says the check also covers GTM deals', async () => {
    const { k } = await mount('AreaPage', { domainId: 'revenue-pipeline', areaId: 'crm-opportunities' }, service({}, []))
    const empty = k.one('[data-intelligence-state="empty"]')!
    assert.match(empty.textContent ?? '', /No findings shown/)
    assert.match(empty.textContent ?? '', /No findings in this area \(this check also covers GTM deals & pipeline\)\./)
    assert.equal(k.one('[data-chip="condition"]')?.getAttribute('data-condition'), 'no_findings')
    assert.doesNotMatch(k.bodyText(), /Healthy/)
  })

  it('the domain page shows the trends note and the opportunities note once, in Evidence & coverage, and the plain unavailable wording', async () => {
    const detectors = detectorList({}, ['commercial.invoice_attention'])
    const { k } = await mount('DomainPage', { domainId: 'revenue-pipeline' }, service({}, [], detectors))
    assert.equal(k.all('[data-trends]').length, 1)
    assert.equal(k.one('[data-coverage-block] [data-trends]')?.textContent, 'Trends: not available yet. Trend lines need stored history, and that history does not exist.')
    assert.equal(k.one('[data-coverage-block] [data-opportunities-note]')?.textContent, 'The current checks look for things that need attention; they do not look for opportunities.')
    assert.match(k.one('[data-unavailable]')?.textContent ?? '', /No result from these checks \(not available to your role, or did not run\): /)
  })

  it('Other findings, when empty, says Nothing here and not "not connected"', async () => {
    const { k, text } = await mount('DomainPage', { domainId: 'other' })
    assert.match(k.one('[data-intelligence-state="empty"]')?.textContent ?? '', /Nothing here/)
    assert.doesNotMatch(text(), /Not connected|No intelligence source/)
    await disposeAll()
    const area = await mount('AreaPage', { domainId: 'other', areaId: 'other-findings' })
    assert.match(area.k.one('[data-intelligence-state="empty"]')?.textContent ?? '', /Nothing here/)
    assert.doesNotMatch(area.text(), /Not connected/)
  })

  it('the coverage block lists each check on its own and does not add figures together', async () => {
    const cov = { observed: 8, expected: 10, percent: 80, basis: 'deals', sufficient: true, reason: null }
    const detectors = detectorList({ 'commercial.deal_health': { coverage: cov }, 'commercial.pipeline_attention': { coverage: cov } })
    const { k } = await mount('DomainPage', { domainId: 'revenue-pipeline' }, service({}, ALL, detectors))
    assert.equal(k.one('[data-coverage-ratio]'), null)
    assert.match(k.one('[data-coverage-basis]')?.textContent ?? '', /each with its own basis/)
    assert.equal((k.one('[data-coverage-block]')?.textContent ?? '').match(/Based on 8 of 10 deals/g)?.length, 2)
    assert.doesNotMatch(k.one('[data-coverage-block]')?.textContent ?? '', /16 of 20/)
  })
})

describe('parent-module Intelligence', () => {
  it('renders the registered module page for every direct Intelligence URL', async () => {
    for (const definition of MODULE_INTELLIGENCE) {
      const { k } = await mount('ModuleIntelligencePage', { moduleKey: definition.key }, service({}, []))
      assert.equal(moduleIntelligenceHref(definition.key), `/intelligence/module/${definition.key}`)
      assert.equal(k.one('h1')?.textContent, `${definition.title} Intelligence`, definition.key)
      assert.match(k.one('nav[data-breadcrumb]')?.textContent ?? '', new RegExp(definition.title))
      await disposeAll()
    }
  })

  it('shows module-wide findings, expandable submodules and explicit unsupported HRIT data without inventing payroll findings', async () => {
    const { k, text, hrefs } = await mount('ModuleIntelligencePage', { moduleKey: 'hrms' }, service({}, [LEAVE]))
    const links = hrefs()
    const breadcrumb = k.one('nav[data-breadcrumb]')
    assert.match(text(), /HRIT Management Intelligence/)
    // Module context: "HRIT Management › Intelligence" — no Global crumb, no Main Dashboard.
    assert.match(breadcrumb?.textContent ?? '', /HRIT ManagementIntelligence/)
    assert.doesNotMatch(breadcrumb?.textContent ?? '', /Main Dashboard/)
    assert.match(text(), /Module-wide summary/)
    assert.match(text(), /Submodule Intelligence/)
    assert.ok(k.one('details[data-submodule="leave"]'))
    // The old ad-hoc "Not Enough Data" gap list is replaced by the coverage registry: every functionality is listed with its own state.
    assert.ok(k.one('details[data-coverage-registry]'))
    assert.equal(k.one('details[data-coverage-registry]')?.getAttribute('data-registry-total'), '21')
    assert.equal(k.one('[data-registry-row="H9"]')?.getAttribute('data-registry-state'), 'excluded')
    assert.equal(k.one('[data-registry-row="H16"]')?.getAttribute('data-registry-state'), 'excluded')
    assert.match(k.one('[data-registry-row="H9"]')?.textContent ?? '', /Excluded — pending separate approval and security review/)
    assert.match(k.one('[data-registry-row="H17"]')?.textContent ?? '', /Not yet assessed/)
    assert.doesNotMatch(k.one('[data-registry-row="H9"]')?.textContent ?? '', /Not Enough Data|Not yet assessed/i)
    assert.match(text(), /Leave approvals are waiting too long/)
    assert.ok(links.includes('/dashboard/leave-management'))
    // Payroll is excluded (D2): no link to it anywhere. The expense screen is only listed in the coverage registry, never as a finding.
    assert.doesNotMatch(links.join(' '), /payroll-management|my-hr/)
    assert.ok(k.all('[data-coverage-registry] a').some((a) => a.getAttribute('href')?.includes('expense-management')))
    assert.equal(k.all('[data-submodule] a').some((a) => a.getAttribute('href')?.includes('expense-management')), false)
    // Global and module Intelligence are never mixed: a module page offers no link to /intelligence.
    assert.ok(!links.includes('/intelligence'))
    assertLinksResolve(links)
  })

  it('does not present an unknown module as an empty successful result', async () => {
    const { k, text } = await mount('ModuleIntelligencePage', { moduleKey: 'unknown' })
    assert.ok(k.one('[data-intelligence-state="not-found"]'))
    assert.match(text(), /does not exist/)
  })

  it('Agentic AI is labelled by its true state: Not yet assessed (data exists), never Not connected', async () => {
    const { k, text } = await mount('ModuleIntelligencePage', { moduleKey: 'agentic-ai' })
    assert.equal(k.one('[data-chip="condition"]')?.getAttribute('data-condition'), 'not_assessed')
    assert.equal(k.one('[data-intelligence-state="not-connected"]'), null)
    assert.doesNotMatch(text(), /Not connected|No Intelligence source is connected/)
    assert.equal(k.one('[data-registry-row="A1"]')?.getAttribute('data-registry-state'), 'not_assessed', 'the check has not reported, so the row is not shown as partially covered')
    assert.equal(k.one('[data-registry-row="A2"]')?.getAttribute('data-registry-state'), 'not_assessed')
  })

  it('Agentic AI follows the detector once it reports (partially covered, from its own states)', async () => {
    const { k } = await mount('ModuleIntelligencePage', { moduleKey: 'agentic-ai' }, service({}, [], detectorList({}, ['agentic.run_health'])))
    assert.equal(k.one('[data-registry-row="A1"]')?.getAttribute('data-registry-state'), 'partial')
    assert.notEqual(k.one('[data-chip="condition"]')?.getAttribute('data-condition'), 'not_assessed')
  })

  it('Platform Services has its own module page with its areas, its not-yet-assessed rows and only real links', async () => {
    const { k, text, hrefs } = await mount('ModuleIntelligencePage', { moduleKey: 'platform-services' })
    assert.equal(k.one('h1')?.textContent, 'Platform Services Intelligence')
    assert.ok(k.one('details[data-submodule="scheduler-reliability"]'))
    assert.ok(k.one('details[data-submodule="ai-usage"]'))
    assert.equal(k.one('details[data-submodule="agentic-runs"]'), null, 'agent runs belong to Agentic AI only')
    assert.equal(k.one('[data-chip="condition"]')?.getAttribute('data-condition'), 'not_assessed')
    for (const id of ['P1', 'P2', 'P5', 'P7', 'P8']) assert.equal(k.one(`[data-registry-row="${id}"]`)?.getAttribute('data-registry-state'), 'not_assessed', id)
    assert.equal(k.one('[data-registry-row="P3"]')?.getAttribute('data-registry-state'), 'not_assessed', 'new check has not reported')
    assert.ok(!hrefs().includes('/intelligence'), 'a module page never links to Global Intelligence')
    assert.doesNotMatch(text(), /Not connected/)
    assertLinksResolve(hrefs())
  })

  it('Platform Services reports through the new detectors once the server sends them', async () => {
    const platform = insightOf('platform.scheduler_reliability', { key: 'platform.scheduler_reliability:org:2026-11', severity: 'high', domain: 'platform', surfaces: ['platform_scheduler'], title: 'Scheduled tasks are failing', deep_link: '/platform-services/scheduler' })
    const { k, text, hrefs } = await mount('ModuleIntelligencePage', { moduleKey: 'platform-services' }, service({}, [platform], detectorList({ 'platform.scheduler_reliability': { insight_count: 1 } }, PLATFORM_DETECTOR_IDS)))
    assert.match(text(), /Scheduled tasks are failing/)
    assert.equal(k.one('[data-registry-row="P3"]')?.getAttribute('data-registry-state'), 'partial')
    assert.ok(hrefs().includes('/platform-services/scheduler'))
  })

  it('Capability Intelligence is Not yet assessed with its eight screens listed, and owns no detector area', async () => {
    const { k, text } = await mount('ModuleIntelligencePage', { moduleKey: 'competency' })
    assert.equal(k.one('[data-chip="condition"]')?.getAttribute('data-condition'), 'not_assessed')
    assert.equal(k.one('details[data-coverage-registry]')?.getAttribute('data-registry-total'), '8')
    assert.equal(k.all('[data-registry-row][data-registry-state="not_assessed"]').length, 8)
    assert.equal(k.one('[data-submodule]'), null)
    assert.doesNotMatch(text(), /Capability development/)
  })

  it('Talent Intelligence owns capability development (its screens are routed under /module/talent-management)', async () => {
    const { k } = await mount('ModuleIntelligencePage', { moduleKey: 'talent' })
    assert.ok(k.one('details[data-submodule="capability-development"]'))
  })

  it('Access Restricted is its own state: nothing is shown or implied, and it is not zero, healthy or not enough data', async () => {
    const detectors = detectorList({ 'hr.attendance_health': { state: 'access_restricted', reason: 'Restricted.' }, 'hr.leave_attention': { state: 'access_restricted', reason: 'Restricted.' } }, ['hr.attendance_health', 'hr.leave_attention'])
    const { k } = await mount('ModuleIntelligencePage', { moduleKey: 'hrms' }, service({}, [], detectors))
    assert.equal(k.one('header [data-chip="condition"]')?.getAttribute('data-condition'), 'access_restricted')
    assert.match(k.one('header')?.textContent ?? '', /Access restricted/)
    assert.doesNotMatch(k.one('header')?.textContent ?? '', /Healthy|Not enough data/)
    assert.ok(k.one('[data-state="access_restricted"]'))
  })

  it('Data unavailable (an API/source failure) is its own state and is never shown as zero or healthy', async () => {
    const detectors = detectorList({ 'hr.attendance_health': { state: 'data_unavailable', reason: 'Source could not be read.' } }, ['hr.attendance_health'])
    const { k } = await mount('ModuleIntelligencePage', { moduleKey: 'hrms' }, service({}, [], detectors))
    assert.equal(k.one('header [data-chip="condition"]')?.getAttribute('data-condition'), 'data_unavailable')
    assert.ok(k.one('[data-state="data_unavailable"]'))
  })

  it('an unrecognised detector state is shown as such and never as checked', async () => {
    const detectors = detectorList({ 'hr.attendance_health': { state: 'quantum' as never } }, ['hr.attendance_health'])
    const { k } = await mount('ModuleIntelligencePage', { moduleKey: 'hrms' }, service({}, [], detectors))
    assert.ok(k.one('[data-state="unrecognised"]'))
    assert.match(k.one('[data-state="unrecognised"]')?.textContent ?? '', /not recognised/)
    assert.notEqual(k.one('header [data-chip="condition"]')?.getAttribute('data-condition'), 'healthy')
  })

  it('excluded functionality is never linked, summarised or counted anywhere on a module page', async () => {
    for (const [moduleKey, ids] of [['hrms', ['H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16']], ['talent', ['T9', 'T10', 'T16']], ['organization', ['O10']]] as const) {
      const { k, hrefs } = await mount('ModuleIntelligencePage', { moduleKey })
      for (const id of ids) {
        const li = k.one(`[data-registry-row="${id}"]`)
        assert.equal(li?.getAttribute('data-registry-state'), 'excluded', id)
        assert.equal(li?.querySelector('a'), null, `${id} has no link`)
      }
      assert.doesNotMatch(hrefs().join(' '), /payroll|performance-reviews|compensation|offboarding|disciplinary|my-hr/)
      await disposeAll()
    }
  })
})

describe('finding addresses', () => {
  const SERVER_KEY = 'hr.leave_attention:org:t17:org0:leave:2026-11-24'
  const dated = (day: string, extra: Partial<Insight> = {}) => insightOf('hr.leave_attention', { key: SERVER_KEY.replace('2026-11-24', day), surfaces: ['leave'], title: `Leave on ${day}`, ...extra })

  it('every link to a finding uses the stable key: no tenant and no date in any href', async () => {
    const { hrefs } = await mount('IntelligenceHome', {}, service({}, [dated('2026-11-24', { severity: 'critical' })]))
    const links = hrefs().filter((h) => h.includes('/leave/'))
    assert.ok(links.length > 0)
    for (const h of links) assert.doesNotMatch(decodeURIComponent(h), /:t\d+|\d{4}-\d{2}-\d{2}/, h)
  })

  it('round trip: the address built for a finding opens that finding', async () => {
    const insight = dated('2026-11-24')
    const url = insightPageFor(insight)
    const [domain, area, key] = url.split('/').slice(2)
    const { k } = await mount('InsightDetailPage', { domainId: domain, areaId: area, insightKey: key }, service({}, [insight]))
    assert.equal(k.one('h1')?.textContent, 'Leave on 2026-11-24')
  })

  it('date rollover: a bookmark made yesterday opens the same finding computed today', async () => {
    const yesterdayUrl = insightPageFor(dated('2026-11-24'))
    const [domain, area, key] = yesterdayUrl.split('/').slice(2)
    const { k } = await mount('InsightDetailPage', { domainId: domain, areaId: area, insightKey: key }, service({}, [dated('2026-11-25')]))
    assert.equal(k.one('h1')?.textContent, 'Leave on 2026-11-25')
  })

  it('old links with the exact (dated) key still work', async () => {
    const { k } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent(SERVER_KEY) }, service({}, [dated('2026-11-24')]))
    assert.equal(k.one('h1')?.textContent, 'Leave on 2026-11-24')
  })

  it('two findings with one stable key: the exact match wins, otherwise the newest', async () => {
    const older = dated('2026-11-23', { as_of: '2026-11-23T09:00:00Z' })
    const newer = dated('2026-11-25', { as_of: '2026-11-25T09:00:00Z' })
    const exact = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent(older.key) }, service({}, [older, newer]))
    assert.equal(exact.k.one('h1')?.textContent, 'Leave on 2026-11-23')
    await disposeAll()
    const stable = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent('hr.leave_attention:org:org0:leave') }, service({}, [older, newer]))
    assert.equal(stable.k.one('h1')?.textContent, 'Leave on 2026-11-25')
  })

  it('a link that no longer matches says so neutrally, never "resolved", with buttons to the area and the domain', async () => {
    const { k, hrefs, text } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: encodeURIComponent('hr.leave_attention:gone') })
    assert.ok(k.one('[data-intelligence-state="no-longer-open"]'))
    assert.match(text(), /This link is out of date, or the finding is no longer reported\./)
    assert.doesNotMatch(text(), /resolved|usually means/i)
    assert.ok(hrefs().includes('/intelligence/people-workforce/leave'))
    assert.ok(hrefs().includes('/intelligence/people-workforce'))
    assert.ok(hrefs().includes('/intelligence'))
  })

  it('an unknown kind of statement on the finding page is Unclassified and not styled as measured or AI', async () => {
    const odd = insightOf('hr.leave_attention', { key: 'odd', surfaces: ['leave'], confidence: 'mystery' as never })
    const { k } = await mount('InsightDetailPage', { domainId: 'people-workforce', areaId: 'leave', insightKey: 'odd' }, service({}, [odd]))
    assert.equal(k.one('[data-chip="confidence"]')?.textContent, 'Unclassified')
    assert.doesNotMatch(k.one('[data-chip="confidence"]')?.className ?? '', /border-success|border-dashed/)
    assert.doesNotMatch(k.one('[data-section="reliable"]')?.textContent ?? '', /Measured|AI estimate/)
  })
})
