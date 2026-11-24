import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signal-review/router-harness'
import { axeViolations } from '../agent/a11y'
import type { IntelligenceApi } from '../../services/intelligence/types'
import { insight, insightsData, META } from './fixtures'
import { fakeIntelligenceService } from './fake-service'

afterEach(disposeAll)

const failWith = (status: number) => async (): Promise<never> => {
  throw Object.assign(new Error(`SQLSTATE secret detail ${status}`), { status })
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

/** A component on a page in a fake browser, inside a stand-in router (next/link needs one) with the Intelligence API replaced by a fake. */
async function mount(name: 'ContextualInsights' | 'InsightCard', props: Record<string, unknown>, overrides: Partial<IntelligenceApi> = {}) {
  const k = await kit()
  // next/link reads `self` (a browser global) when it mounts; the fake browser is that window, as in the other screen tests.
  Object.defineProperty(globalThis, 'self', { value: k.w, configurable: true, writable: true })
  const router = await routerHarness('', '/dashboard')
  const components = await import('../../components/domain/intelligence')
  const { service, calls } = fakeIntelligenceService(overrides)
  const Component = components[name] as unknown
  const withService = name === 'InsightCard' ? props : { service, ...props }
  await k.render(router.wrap(k.h(Component, withService)))
  await k.tick(10)
  const text = () => k.bodyText().replace(/\s+/g, ' ')
  const button = (label: string) => k.all('button').find((b) => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined
  const press = async (el: Element | null | undefined) => { assert.ok(el, 'the control exists'); await k.click(el); await k.tick(10) }
  return { k, service, calls, text, button, press }
}

describe('InsightCard', () => {
  it('shows the severity and the kind of statement as WORDS, with evidence, coverage, action and a link to the module', async () => {
    const { k, text } = await mount('InsightCard', { insight: insight() })

    assert.match(text(), /High priority/)
    assert.match(text(), /Measured/)
    assert.match(text(), /Certifications expire within 30 days/)
    assert.match(text(), /Why it matters: An expired certification/)
    assert.match(text(), /Certifications due in 30 days: 4 certifications/)
    assert.match(text(), /Window: 2026-11-21 to 2026-12-21/)
    assert.match(text(), /1 certification listed: Record #91/)
    assert.match(text(), /No direct page for this record: find it in Certifications/)
    assert.doesNotMatch(text(), /\(record \d+\)/)
    assert.match(text(), /Source: Certifications register/)
    assert.match(text(), /Based on 12 of 15 active employees with a recorded expiry date \(80%\)/)
    assert.match(text(), /What to do: Ask the holders to book their renewal\./)
    assert.match(text(), /21 Nov 2026, 09:30 UTC/)
    const link = k.one('a[href="/module/lms/learning/my-learning"]')
    assert.ok(link, 'a link to the module')
    assert.match(link.textContent ?? '', /Open in Learning/)
  })

  it('says an AI estimate is not a measured fact, and never labels it Measured', async () => {
    const { k, text } = await mount('InsightCard', { insight: insight({ confidence: 'ai_estimate' }) })

    assert.match(text(), /AI estimate/)
    assert.match(text(), /Estimate, not a measured fact\./)
    assert.equal(k.one('[data-chip="confidence"]')?.textContent, 'AI estimate')
    assert.doesNotMatch(k.one('[data-chip="confidence"]')?.textContent ?? '', /Measured/)
  })

  it('never links to an address that is not inside the app', async () => {
    for (const bad of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)']) {
      const { k } = await mount('InsightCard', { insight: insight({ deep_link: bad, key: `k-${bad.length}` }) })
      assert.equal(k.all('article a').filter((a) => a.getAttribute('href') !== '/module/talent-management/certifications').length, 0, bad)
      assert.equal(k.all('a[href^="http"], a[href^="//"], a[href^="javascript"]').length, 0, bad)
      await disposeAll()
    }
  })

  it('says "Not enough data to assess" with the reason instead of a figure when coverage is thin', async () => {
    const coverage = { observed: 2, expected: 10, percent: 20, basis: 'records', sufficient: false, reason: 'Only 2 record(s) support this; at least 5 are needed.' }
    const { text } = await mount('InsightCard', { insight: insight({ coverage }) })

    assert.match(text(), /Not enough data to assess/)
    assert.match(text(), /Only 2 record\(s\) support this; at least 5 are needed\./)
    assert.doesNotMatch(text(), /Based on 2 of 10/)
  })

  it('compact form keeps the title, the finding, the chips and the link, and drops the long parts', async () => {
    const { text, k } = await mount('InsightCard', { insight: insight(), compact: true })

    assert.match(text(), /Certifications expire within 30 days/)
    assert.doesNotMatch(text(), /Why it matters/)
    assert.doesNotMatch(text(), /Evidence/)
    assert.ok(k.one('a[href="/module/lms/learning/my-learning"]'))
  })
})

describe('ContextualInsights badge', () => {
  it('says how many it counted among, when only the first page is loaded', async () => {
    const many = ['a', 'b', 'c'].map((key) => insight({ key, severity: 'high', title: `Insight ${key}` }))
    const data = { ...insightsData(many), pagination: { page: 1, per_page: 3, total: 40, total_pages: 14 } }
    const { text } = await mount('ContextualInsights', { surface: 'gtm_deals' }, { insights: async () => ({ status: 1, data }) })
    assert.match(text(), /3 among the first 3 need attention/)
  })

  it('is plain when everything is loaded, and never says the old "Intelligence Center"', async () => {
    const { text } = await mount('ContextualInsights', { surface: 'gtm_deals' })
    assert.match(text(), /1 needs attention/)
    assert.doesNotMatch(text(), /Intelligence Center/)
  })

  it('an unknown kind of statement is Unclassified: neither Measured nor AI estimate', async () => {
    const { k } = await mount('InsightCard', { insight: insight({ confidence: 'something_new' as never }) })
    const chip = k.one('[data-chip="confidence"]')!
    assert.equal(chip.textContent, 'Unclassified')
    assert.doesNotMatch(chip.className, /border-success|border-dashed/)
  })
})

describe('ContextualInsights', () => {
  it('asks the server for its own surface only and shows the insights with a link to the Center', async () => {
    const { calls, text, k } = await mount('ContextualInsights', { surface: 'gtm_deals' })

    assert.deepEqual(calls.insights, [{ surface: 'gtm_deals', per_page: 10 }])
    assert.match(text(), /Intelligence/)
    assert.match(text(), /Certifications expire within 30 days/)
    assert.match(text(), /1 needs attention/)
    assert.ok(k.one('a[href="/intelligence"]'))
    assert.match(text(), /Provisional thresholds/)
  })

  it('shows a loading state while the answer is pending', async () => {
    const pending = deferred<{ status: number; data: ReturnType<typeof insightsData> }>()
    const { k } = await mount('ContextualInsights', { surface: 'attendance' }, { insights: () => pending.promise })

    const loading = k.one('[data-intelligence-state="loading"]')
    assert.ok(loading, 'a loading state')
    assert.equal(loading.getAttribute('role'), 'status')
    pending.resolve({ status: 1, data: insightsData([]) })
  })

  it('says "Nothing needs attention" ONLY when the checks ran and found nothing', async () => {
    const meta = { ...META, states: { 'hr.attendance_health': 'ok' as const } }
    const { text } = await mount('ContextualInsights', { surface: 'attendance' }, { insights: async () => ({ status: 1, data: insightsData([], meta) }) })

    assert.match(text(), /Nothing needs attention/)
  })

  it('says "Not enough data to assess yet" when no check could run, and does not claim an all-clear', async () => {
    const meta = { ...META, states: { 'hr.attendance_health': 'insufficient_data' as const } }
    const { text } = await mount('ContextualInsights', { surface: 'attendance' }, { insights: async () => ({ status: 1, data: insightsData([], meta) }) })

    assert.match(text(), /Not enough data to assess yet/)
    assert.doesNotMatch(text(), /Nothing needs attention/)
  })

  it('does not claim an all-clear when the server did not say whether the checks ran', async () => {
    const meta = { ...META, states: undefined }
    const { text } = await mount('ContextualInsights', { surface: 'attendance' }, { insights: async () => ({ status: 1, data: insightsData([], meta) }) })

    assert.doesNotMatch(text(), /Nothing needs attention/)
    assert.match(text(), /No insights to show right now/)
  })

  it('renders nothing at all in a host screen when this account may not see Intelligence', async () => {
    const { k } = await mount('ContextualInsights', { surface: 'gtm_deals' }, { insights: failWith(403) })

    assert.equal(k.one('[data-intelligence-surface]'), null)
    assert.equal(k.bodyText().trim(), '')
  })

  it('renders nothing when the session has ended (the host screen handles sign-in)', async () => {
    const { k } = await mount('ContextualInsights', { surface: 'gtm_deals' }, { insights: failWith(401) })

    assert.equal(k.bodyText().trim(), '')
  })

  it('says so in one sentence inside a card whose whole purpose is Intelligence (widget + note), without the server text', async () => {
    const { text } = await mount('ContextualInsights', { surface: 'hr_dashboard', variant: 'widget', whenDenied: 'note' }, { insights: failWith(403) })

    assert.match(text(), /Intelligence is not available for your account\./)
    assert.doesNotMatch(text(), /SQLSTATE/)
  })

  it('shows a friendly error with Try again, and asks again when pressed', async () => {
    let attempt = 0
    const { calls, text, button, press, k } = await mount('ContextualInsights', { surface: 'signals' }, {
      insights: async () => {
        attempt += 1
        if (attempt === 1) throw Object.assign(new Error('SQLSTATE hidden'), { status: 500 })
        return { status: 1, data: insightsData() }
      },
    })

    assert.equal(k.one('[role="alert"]')?.textContent?.includes('Intelligence could not be loaded. Try again.'), true)
    assert.doesNotMatch(text(), /SQLSTATE/)
    await press(button('Try again'))
    assert.equal(calls.insights.length, 2)
    assert.match(text(), /Certifications expire within 30 days/)
  })

  it('can be collapsed and expanded, and says which it is', async () => {
    const { k, press } = await mount('ContextualInsights', { surface: 'leave' })
    const toggle = k.all('button').find((b) => b.getAttribute('aria-expanded') !== null)
    assert.ok(toggle)
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')

    await press(toggle)

    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(k.one(`#${toggle.getAttribute('aria-controls')}`)?.hasAttribute('hidden'), true)
  })

  it('mentions withheld insights without a number', async () => {
    const meta = { ...META, suppressed_count: 4 }
    const { text } = await mount('ContextualInsights', { surface: 'attendance' }, { insights: async () => ({ status: 1, data: insightsData([insight()], meta) }) })

    assert.match(text(), /too few people/)
    assert.doesNotMatch(text(), /4 insights/)
  })

  it('points at the full list when more insights exist than are shown', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((key) => insight({ key, title: `Insight ${key}` }))
    const data = { ...insightsData(many), pagination: { page: 1, per_page: 10, total: 5, total_pages: 1 } }
    const { text, k } = await mount('ContextualInsights', { surface: 'gtm_deals', maxItems: 2 }, { insights: async () => ({ status: 1, data }) })

    assert.match(text(), /Showing 2 of 5 findings\./)
    assert.ok(k.all('a[href="/intelligence"]').some((a) => a.textContent?.trim() === 'Open Intelligence'), 'the link says where it goes: the Intelligence home')
  })
})
