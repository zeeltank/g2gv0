import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import type { AgentApi } from '../../services/agent/api-types'
import { fakeAgentService } from './fake-service'
import { proposalsPage } from './fixtures'

/**
 * The Run Log page in a fake browser: the real wrapper, the real Sales & Marketing screen inside it, a stand-in for the Agentic AI runs (that screen has its own tests), a router that
 * keeps the address, and the agent API replaced by a fake. What is proved: who is offered the second section, that the address keeps the section apart from the sub-tab, and that a
 * person without the right who pastes the address lands on the first section.
 */

async function page(search: string, overrides: Partial<AgentApi> = {}) {
  const k = await kit()
  const router = await routerHarness(search, '/module/agentic-ai/run-log')
  const { AgRunLogPage } = await import('../../components/domain/agentic/ag-run-log-page')
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 1, user_id: 2 }))
  const { service, calls } = fakeAgentService(overrides)
  await k.render(router.wrap(k.h(AgRunLogPage, { service, agenticPanel: k.h('p', { 'data-agentic': 'yes' }, 'the Agentic AI runs') })))
  await k.tick(30)
  const sections = () => k.all('[role="tablist"][aria-label="Run log sections"] [role="tab"]').map((t) => t.textContent?.trim() ?? '')
  const selected = () => k.all('[role="tablist"][aria-label="Run log sections"] [role="tab"]').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent?.trim())
  const subTabs = () => k.all('[role="tablist"][aria-label="Agent run history sections"] [role="tab"]').map((t) => t.textContent?.trim() ?? '')
  return { k, router, calls, sections, selected, subTabs }
}

const forbidden = () => Promise.reject(Object.assign(new Error('forbidden'), { status: 403 }))
const broken = () => Promise.reject(Object.assign(new Error('server error'), { status: 500 }))

describe('the Run Log page', () => {
  afterEach(disposeAll)

  it('offers both sections to a person the agent API lets in, with the number waiting, and opens the Agentic AI runs', async () => {
    const s = await page('', { proposals: async () => proposalsPage() })
    assert.equal(s.sections()[0], 'Agentic AI runs')
    assert.ok(s.sections()[1]?.startsWith('Sales & Marketing agents'), JSON.stringify(s.sections()))
    assert.deepEqual(s.selected(), ['Agentic AI runs'])
    assert.ok(s.k.one('[data-agentic]'), 'the Agentic AI runs are what opens')
    assert.deepEqual(s.subTabs(), [], 'the Sales & Marketing screen is not built until its section is opened')
  })

  it('opens the Sales & Marketing agents with their own Runs and Waiting for you tabs, and keeps the section apart from the sub-tab in the address', async () => {
    const s = await page('', { proposals: async () => proposalsPage() })
    const second = s.k.all('[role="tablist"][aria-label="Run log sections"] [role="tab"]')[1]
    await s.k.click(second)
    await s.k.tick(30)
    assert.match(s.router.lastSearch(), /(^|&)section=sales-marketing(&|$)/)
    assert.ok(s.subTabs().includes('Runs') && s.subTabs().some((t) => t.startsWith('Waiting for you')), JSON.stringify(s.subTabs()))
    const waiting = s.k.all('[role="tablist"][aria-label="Agent run history sections"] [role="tab"]').find((t) => t.textContent?.trim().startsWith('Waiting for you'))!
    await s.k.click(waiting)
    await s.k.tick(30)
    assert.match(s.router.lastSearch(), /(^|&)section=sales-marketing(&|$)/, 'choosing a sub-tab keeps the section')
    assert.match(s.router.lastSearch(), /(^|&)tab=waiting(&|$)/, 'and writes the sub-tab in its own parameter')
  })

  it('opens the Sales & Marketing agents on the sub-tab an old Agent Run History link named', async () => {
    const s = await page('section=sales-marketing&tab=waiting', { proposals: async () => proposalsPage() })
    assert.deepEqual(s.selected()[0]?.startsWith('Sales & Marketing agents'), true)
    const open = s.k.all('[role="tablist"][aria-label="Agent run history sections"] [role="tab"]').filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent?.trim())
    assert.ok(open[0]?.startsWith('Waiting for you'), JSON.stringify(open))
  })

  it('offers only the Agentic AI runs, with no section bar, to a person without the right, and the agent API is asked once', async () => {
    const s = await page('', { proposals: forbidden })
    assert.deepEqual(s.sections(), [], 'one section is nothing to switch between')
    assert.ok(s.k.one('[data-agentic]'))
    assert.equal(s.calls.proposals.length, 1)
  })

  it('sends a person without the right who pastes the Sales & Marketing address to the Agentic AI runs, and says so in the address', async () => {
    const s = await page('section=sales-marketing', { proposals: forbidden })
    assert.ok(s.k.one('[data-agentic]'), 'what they see is the Agentic AI runs')
    assert.deepEqual(s.subTabs(), [], 'the Sales & Marketing screen was never built')
    assert.ok(!/section=sales-marketing/.test(s.router.lastSearch()), 'the address no longer says Sales & Marketing')
  })

  it('does not offer the section on a guess when the answer fails for another reason, but shows it when the address asks, so the screen can say what went wrong', async () => {
    const quiet = await page('', { proposals: broken })
    assert.deepEqual(quiet.sections(), [])
    await disposeAll()
    const asked = await page('section=sales-marketing', { proposals: broken })
    assert.ok(asked.sections()[1]?.startsWith('Sales & Marketing agents'), JSON.stringify(asked.sections()))
  })
})
