import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent } from '../agent/assertions'
import type { Lead } from '../../types/crm'
import { lead } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/**
 * A lead's whole page as a person meets it (FIX-e2e A2): the real screen that loads the lead, the real page, the real Convert dialog, only the network
 * replaced. The day-in-the-life run never saw "No contact was created", because the reload after Convert unmounted the page and its notice with it.
 */

const NOTICE = 'No contact was created: this lead names no person, only a company.'

interface Setup {
  /** What the Nth load of the lead answers with (0 is the first). Return a promise to hold the answer. */
  leadAnswer?: (n: number) => unknown | Promise<unknown>
  onLead?: (l: Lead | null) => void
}

async function open(setup: Setup = {}) {
  let loads = 0
  const screen = await screenKit({
    pathname: '/module/crm/marketing/leads/41',
    respond: (call: Call) => {
      if (call.method === 'GET' && call.path.endsWith('/crm/leads/41')) {
        const n = loads++
        return setup.leadAnswer ? setup.leadAnswer(n) : { status: 1, message: 'Lead.', data: lead({ assignedTo: '2', converted: n > 0, convertedOrganizationId: n > 0 ? '5' : null }) }
      }
      if (call.method === 'POST' && call.path.endsWith('/crm/leads/41/convert')) {
        return { status: 1, message: 'Lead converted.', data: { organizationId: '5', contactId: null, opportunityId: null, contactSkipped: true, notice: NOTICE } }
      }
      if (call.path.endsWith('/crm/picklist-values')) return { status: 1, message: 'ok', data: { leads: {} } }
      return undefined
    },
  })
  const { LeadDetailScreen } = await import('../../components/domain/crm/lead-detail-screen')
  let backs = 0
  const mount = async () => screen.mount(screen.k.h(LeadDetailScreen, { id: '41', onBack: () => { backs++ }, onLead: setup.onLead }), 60)
  const leadLoads = () => screen.calls.filter((c) => c.method === 'GET' && c.path.endsWith('/crm/leads/41')).length
  const notice = () => screen.k.one('[data-lead-notice]')
  const convert = async () => {
    await screen.k.click(screen.k.withText('Convert')!)
    await screen.k.tick(30)
    const submit = screen.k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === 'Convert')
    assert.ok(submit, 'the dialog\'s Convert button is drawn')
    await screen.k.click(submit)
    await screen.k.tick(60)
  }
  return { ...screen, mount, leadLoads, notice, convert, backs: () => backs }
}

describe('a lead\'s whole screen: the notice after a reload (A2)', () => {
  afterEach(async () => { await disposeAll() })

  it('keeps "No contact was created" on the page after Convert reloads the lead', async () => {
    // The reload answers a little later, as a real server does, so the screen really paints between asking and receiving (an instant answer would be batched into one paint and hide the bug).
    const s = await open({
      leadAnswer: (n) => (n === 0
        ? { status: 1, message: 'Lead.', data: lead({ assignedTo: '2' }) }
        : new Promise((resolve) => setTimeout(() => resolve({ status: 1, message: 'Lead.', data: lead({ assignedTo: '2', converted: true, convertedOrganizationId: '5' }) }), 25))),
    })
    await s.mount()
    assert.equal(s.leadLoads(), 1, 'one load so far')
    await s.convert()
    assert.equal(s.leadLoads(), 2, 'Convert reloaded the lead')
    assert.ok(s.notice(), 'the notice box is on the page after the reload')
    assert.equal(s.notice()!.textContent, NOTICE)
    assert.ok(s.k.one('[data-lead-converted]'), 'and the page shows the reloaded (converted) lead')
    s.restore()
  })

  it('does not put "Opening lead…" back while the lead is being reloaded', async () => {
    let release: (v: unknown) => void = () => undefined
    const held = new Promise((resolve) => { release = resolve })
    const s = await open({
      leadAnswer: (n) => (n === 0 ? { status: 1, message: 'Lead.', data: lead({ assignedTo: '2' }) } : held),
    })
    await s.mount()
    assert.equal(s.k.bodyText().includes('Opening lead'), false, 'the first load is done')
    await s.convert()
    assert.equal(s.leadLoads(), 2, 'the reload is in flight')
    assert.equal(s.k.bodyText().includes('Opening lead'), false, 'the loading state is not shown again')
    assert.equal(s.notice()!.textContent, NOTICE, 'the notice is on the page while the reload is still pending')
    assert.ok(s.k.bodyText().includes('LEAD-0041'), 'the lead itself is still drawn')
    release({ status: 1, message: 'Lead.', data: lead({ assignedTo: '2', converted: true, convertedOrganizationId: '5' }) })
    await s.k.tick(40)
    assert.equal(s.notice()!.textContent, NOTICE, 'and after it arrives')
    s.restore()
  })

  it('shows "Opening lead…" on the first load only', async () => {
    let release: (v: unknown) => void = () => undefined
    const held = new Promise((resolve) => { release = resolve })
    const s = await open({ leadAnswer: () => held })
    await s.mount()
    assert.ok(s.k.bodyText().includes('Opening lead'), 'the first load says so')
    release({ status: 1, message: 'Lead.', data: lead() })
    await s.k.tick(60)
    assert.equal(s.k.bodyText().includes('Opening lead'), false)
    assert.ok(s.k.bodyText().includes('LEAD-0041'))
    s.restore()
  })

  it('a reload that fails leaves the page and its notice, because what the person did was saved', async () => {
    const s = await open({
      leadAnswer: (n) => (n === 0 ? { status: 1, message: 'Lead.', data: lead({ assignedTo: '2' }) } : { status: 0, message: 'Server error.', __status: 500 }),
    })
    await s.mount()
    await s.convert()
    assert.equal(s.leadLoads(), 2)
    assert.equal(s.notice()!.textContent, NOTICE)
    assert.equal(s.k.bodyText().includes('Server error'), false, 'no error screen replaced the page')
    s.restore()
  })

  it('a FIRST load that fails still shows the error and a way back', async () => {
    const s = await open({ leadAnswer: () => ({ status: 0, message: 'You cannot open this lead.', __status: 403 }) })
    await s.mount()
    assert.ok(s.k.bodyText().includes('You cannot open this lead.'))
    await s.k.click(s.k.withText('Back to Leads')!)
    assert.equal(s.backs(), 1)
    absent(s.notice(), 'there is no lead page')
    s.restore()
  })

  it('the route hands the whole load to this screen (a scan: the route holds no loading state of its own that a reload could flip)', () => {
    const route = readFileSync(path.resolve('app/module/crm/marketing/leads/[id]/page.tsx'), 'utf8')
    assert.ok(/<LeadDetailScreen\s+id=\{id\}\s+onBack=\{backToLeads\}\s+onLead=\{setLead\}\s*\/>/.test(route), 'the route draws LeadDetailScreen with the id, the way back and the breadcrumb hook')
    assert.equal(/setIsLoading|<LeadDetailPage/.test(route), false, 'the route neither loads the lead nor draws the page itself')
  })

  it('tells the route which lead is open, for its breadcrumb', async () => {
    const seen: Array<string | null> = []
    const s = await open({ onLead: (l) => { seen.push(l ? l.lastName : null) } })
    await s.mount()
    assert.deepEqual(seen, ['Menon'])
    s.restore()
  })
})
