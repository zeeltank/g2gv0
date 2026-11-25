import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { fakeFactsService } from '../facts/fake-service'
import type { CrmAuditEntry, CrmComment, CrmEmailLinkEntry, CrmLinkedDocument } from '../../types/crm'
import { meera, organization, peopleKit, tagged, type Rights, type World } from './kit'

/**
 * The company page as a person meets it (S18): the People tab after Details, the primary contact line, and the Company only | Everyone switch with the Who chip on
 * the Emails, Schedule, Documents, Comments, History and Quotes tabs. The real page, sidebar hook and services; only the network is replaced.
 */

const email = (id: string, subject: string): CrmEmailLinkEntry => ({ id, subject, body: '', toAddress: 'x@example.org', templateId: null, templateName: null, status: 'Sent', sentAt: null, failureReason: null, assignedTo: null, createdBy: null, createdByName: 'Milan', createdAt: '20 Nov' })
const comment = (id: string, text: string): CrmComment => ({ id, comment: text, createdBy: null, createdByName: 'Milan', createdAt: '20 Nov' })
const document = (id: string, title: string): CrmLinkedDocument => ({ id, title, originalFileName: `${title}.pdf`, mimeType: 'application/pdf', size: 10, uploadedBy: null, uploadedByName: 'Milan', createdAt: '2026-11-20' })
const entry = (id: string): CrmAuditEntry => ({ id, type: 'crm.contact.updated', changes: [], actorId: null, actorName: 'Milan', occurredAt: '20 Nov' })
const quote = (id: string, subject: string) => ({ id, quoteNo: `QT-${id}`, subject, quoteStage: 'Sent', total: 100, currency: 'INR', organizationId: '135', organizationName: 'Hillcrest Academy', contactId: null, contactName: null, opportunityId: null })

const WORLD: Partial<World> = {
  emails: [tagged(email('1', 'Invoice sent'), null), tagged(email('2', 'Re: ERP proposal'), 'Meera Patel', '31')],
  comments: [tagged(comment('1', 'Company note'), null), tagged(comment('2', 'Call note'), 'Meera Patel', '31')],
  documents: [tagged(document('1', 'Agreement'), null), tagged(document('2', 'Meera CV'), 'Meera Patel', '31')],
  history: [tagged(entry('1'), null), tagged(entry('2'), 'Meera Patel', '31')],
  quotes: [tagged(quote('1', 'Company quote'), null), tagged(quote('2', 'Meera quote'), 'Meera Patel', '31')],
  events: [tagged({ id: '1', title: 'Site visit', description: '', location: null, start_at: '2026-11-20 10:00:00', end_at: '2026-11-20 11:00:00', all_day: false, status: 'Planned', owner_id: '2' }, null), tagged({ id: '2', title: 'Call Meera', description: '', location: null, start_at: '2026-11-21 10:00:00', end_at: '2026-11-21 11:00:00', all_day: false, status: 'Planned', owner_id: '2' }, 'Meera Patel', '31')],
  people: [meera()],
}

async function open(options: { rights?: Rights | null; world?: Partial<World>; address?: string } = {}) {
  const screen = await peopleKit({ rights: options.rights, world: { ...WORLD, ...options.world } })
  // The fake window is the same for every test of the file: the address is set every time, so a test never opens on the tab the one before it asked for.
  screen.k.w.history.replaceState({}, '', `/module/crm/marketing/organizations/135${options.address ?? ''}`)
  const { OrganizationDetailPage } = await import('../../components/domain/crm/organization-detail-page')
  const { service } = fakeFactsService()
  void service
  await screen.mount(screen.k.h(OrganizationDetailPage, { organization: organization(), onSaved: () => undefined, onBack: () => undefined, picklists: { accountType: [], industry: [], rating: [] } }), 80)
  const tabs = () => screen.k.all('[data-tab]').map((t) => t.getAttribute('data-tab'))
  const tab = (id: string) => screen.k.one(`[data-tab="${id}"]`) as HTMLElement
  const go = async (id: string, wait = 60) => { await screen.k.click(tab(id)); await screen.k.tick(wait) }
  const scopeButton = (scope: 'people' | 'company') => screen.k.one(`[data-company-activity-switch] [data-scope="${scope}"]`) as HTMLElement | null
  const includes = (pattern: RegExp) => screen.callsTo(pattern, 'GET').map((c) => c.query.get('include'))
  const whoChips = () => screen.k.all('[data-who]').map((c) => c.textContent!.replace('Who: ', ''))
  return { ...screen, tabs, tab, go, scopeButton, includes, whoChips }
}

const LISTS = [/\/organizations\/135\/emails$/, /\/organizations\/135\/comments$/, /\/organizations\/135\/documents$/, /\/organizations\/135\/history$/, /\/crm\/quotes$/]

describe('the company page: the People tab', () => {
  afterEach(async () => { await disposeAll() })

  it('puts People right after Details, with how many people the company has', async () => {
    const s = await open({ world: { people: [meera(), { ...meera(), id: '32', isPrimary: false, firstName: 'Rakesh', lastName: 'Shah' }] } })
    assert.deepEqual(s.tabs().slice(0, 3), ['details', 'people', 'hierarchy'])
    assert.equal(s.tab('people').textContent, 'People2')
    assert.equal(s.tab('people').getAttribute('aria-label'), 'People 2', 'the name says the count with a space')
    s.restore()
  })

  it('hides the People tab, asks for no people, and shows no primary contact line without the contacts view right', async () => {
    const s = await open({ rights: null })
    assert.ok(!s.tabs().includes('people'))
    assert.equal(s.callsTo(/\/crm\/contacts$/).length, 0, 'the people are not even asked for')
    assert.equal(s.k.one('[data-primary-contact]'), null)
    assert.ok(!s.k.bodyText().includes('Primary contact'))
    s.restore()
  })

  it('opens Details for a link to People when the person may not see people', async () => {
    const s = await open({ rights: null, address: '?tab=people' })
    assert.ok(s.k.bodyText().includes('Organization Details'))
    assert.equal(s.k.one('[data-person-rail]'), null)
    s.restore()
  })

  it('opens the People tab, on the person a link asked for', async () => {
    const s = await open({ address: '?tab=people&person=31' })
    assert.ok(s.k.one('[data-person-rail]'), 'the rail is there')
    assert.ok(s.k.one('[data-person-panel] h2')!.textContent!.includes('Mrs. Meera Patel'))
    s.restore()
  })

  it('names the primary contact under the company name and in Details, and the Details link opens that person', async () => {
    const s = await open({ world: { people: [{ ...meera(), id: '32', isPrimary: false, firstName: 'Rakesh', lastName: 'Shah' }, meera()] } })
    assert.equal(s.k.one('[data-primary-contact]')!.textContent, 'Meera Patel')
    assert.ok(s.k.one('h1')!.parentElement!.textContent!.includes('Primary contact: Meera Patel'))
    const link = s.k.one('[data-primary-contact-link]')!
    assert.ok(link.textContent!.includes('Meera Patel · Principal'))
    await s.k.click(link)
    await s.k.tick(80)
    assert.ok(s.k.one('[data-person-panel] h2')!.textContent!.includes('Meera Patel'))
    s.restore()
  })

  it('says "Also transfer this company\'s people" where it used to say contacts', async () => {
    const s = await open()
    await s.k.click(s.k.withText('Transfer Ownership')!)
    await s.k.tick(30)
    assert.ok(s.k.bodyText().includes('Also transfer this company’s people'))
    s.restore()
  })

  it('keeps the tab bar in one scrolling row, so a phone does not scroll the whole page sideways', async () => {
    const s = await open()
    const bar = s.tab('details').parentElement!
    assert.ok(bar.className.includes('overflow-x-auto'))
    assert.ok(s.tab('details').className.includes('whitespace-nowrap'))
    s.restore()
  })
})

describe('the company page: Company only | Everyone', () => {
  afterEach(async () => { await disposeAll() })

  it('asks for Everyone by default: every company list is read with include=people', async () => {
    const s = await open()
    for (const list of LISTS) assert.deepEqual(s.includes(list), ['people'], String(list))
    s.restore()
  })

  it('reads every list again with include=company when Company only is chosen, and back with include=people', async () => {
    const s = await open()
    await s.go('emails')
    assert.equal(s.scopeButton('people')!.getAttribute('aria-pressed'), 'true', 'Everyone is on')
    await s.k.click(s.scopeButton('company')!)
    await s.k.tick(60)
    for (const list of LISTS) assert.deepEqual(s.includes(list), ['people', 'company'], String(list))
    assert.equal(s.scopeButton('company')!.getAttribute('aria-pressed'), 'true')
    await s.k.click(s.scopeButton('people')!)
    await s.k.tick(60)
    for (const list of LISTS) assert.deepEqual(s.includes(list), ['people', 'company', 'people'], String(list))
    s.restore()
  })

  it('shows the Who chip of each row on Everyone: the person\'s name, or Company, and only the company\'s rows on Company only', async () => {
    const s = await open()
    await s.go('emails')
    assert.deepEqual(s.whoChips(), ['Company', 'Meera Patel'])
    assert.ok(s.k.bodyText().includes('Re: ERP proposal') && s.k.bodyText().includes('Invoice sent'))
    await s.k.click(s.scopeButton('company')!)
    await s.k.tick(60)
    assert.deepEqual(s.whoChips(), ['Company'])
    assert.ok(!s.k.bodyText().includes('Re: ERP proposal'))
    s.restore()
  })

  it('puts the chip on Comments, Documents, History and Quotes too', async () => {
    const s = await open()
    for (const id of ['comments', 'documents', 'history', 'quotes']) {
      await s.go(id)
      assert.deepEqual(s.whoChips(), ['Company', 'Meera Patel'], id)
      assert.ok(s.scopeButton('people'), `${id} has the switch`)
    }
    s.restore()
  })

  it('asks the Schedule for include=people too, and shows whose each event is', async () => {
    const s = await open()
    await s.go('schedule')
    assert.deepEqual(s.includes(/\/linked\/ORGANIZATION\/135$/), ['people'])
    assert.deepEqual(s.whoChips(), ['Company', 'Meera Patel'])
    await s.k.click(s.scopeButton('company')!)
    await s.k.tick(60)
    assert.deepEqual(s.includes(/\/linked\/ORGANIZATION\/135$/), ['people', 'company'])
    assert.ok(!s.k.bodyText().includes('Call Meera'))
    s.restore()
  })

  it('has the switch on those six tabs only, not on Details, Hierarchy or Opportunities', async () => {
    const s = await open()
    for (const id of ['details', 'hierarchy', 'opportunities']) {
      await s.go(id)
      assert.equal(s.scopeButton('people'), null, id)
    }
    await s.go('quotes')
    assert.ok(s.scopeButton('people'))
    s.restore()
  })

  it('offers no switch and asks only for the company\'s own rows without the contacts view right', async () => {
    const s = await open({ rights: null })
    await s.go('emails')
    assert.equal(s.scopeButton('people'), null)
    for (const list of LISTS) assert.deepEqual(s.includes(list), ['company'], String(list))
    s.restore()
  })

  it('has no axe violations on the switch', async () => {
    const s = await open()
    await s.go('emails')
    const { axeViolations } = await import('../agent/a11y')
    assert.deepEqual(await axeViolations(s.scopeButton('people')!.parentElement!.parentElement!), [])
    s.restore()
  })

  it('does not read the opportunities or the projects again when the switch changes', async () => {
    const s = await open()
    await s.go('emails')
    const before = s.callsTo(/\/crm\/opportunities$/).length
    await s.k.click(s.scopeButton('company')!)
    await s.k.tick(60)
    assert.equal(s.callsTo(/\/crm\/opportunities$/).length, before)
    s.restore()
  })
})
