import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent } from '../agent/assertions'
import { ApiError } from '../../services/core'
import { getLaravelContext } from '../laravel-context'
import type { FactsApi } from '../../services/facts/api-types'
import type { Contact } from '../../types/crm'
import { fakeFactsService } from '../facts/fake-service'
import { appliedFact, consentData, dismissedFact, entityData, fact, phoneFact } from '../facts/fixtures'
import { meera, peopleKit, person, rakesh, type Rights, type World } from './kit'

/**
 * The Person panel as a person meets it: the real panel, the real sidebar hook, services and tab components; only the network (a stand-in for the CRM API with
 * a little state) and the facts API (a fake that records its calls) are replaced. The Evidence and Consent tests are the ones of the former Contact detail page
 * (lib/facts/contact-detail.test.tsx, moved here ON PURPOSE: that page's sections are this panel's Overview now).
 */

async function open(options: { rights?: Rights | null; world?: Partial<World>; person?: Contact; facts?: Partial<FactsApi>; showCompany?: boolean; withClose?: boolean; personId?: number } = {}) {
  const base = options.person ?? person({ email: null, title: null, department: null })
  const screen = await peopleKit({ rights: options.rights, world: { people: [base, rakesh()], ...options.world } })
  const { PersonPanel } = await import('../../components/domain/crm/people/person-panel')
  const { service, calls } = fakeFactsService(options.facts)
  const events = { changed: 0, closed: 0 }
  const props = {
    context: getLaravelContext(), personId: options.personId ?? Number(base.id), factsService: service, showCompany: options.showCompany,
    onChanged: () => { events.changed += 1 }, ...(options.withClose === false ? {} : { onClose: () => { events.closed += 1 } }),
  }
  await screen.mount(screen.k.h(PersonPanel, props), 60)
  const rerender = async (next: Partial<typeof props>) => { await screen.k.render(screen.wrap(screen.k.h(PersonPanel, { ...props, ...next }))); await screen.k.tick(60) }
  const section = (title: string) => screen.k.one(`[data-section="${title}"]`)
  const card = (id: number) => screen.k.one(`li[data-fact="${id}"]`)
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(25) }
  const tab = (label: string) => screen.k.all('[role="tab"]').find((t) => t.textContent?.trim() === label) as HTMLElement
  const button = (label: string) => screen.k.all('button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
  const openMenu = async () => {
    const trigger = screen.k.one('button[aria-label="More actions"]')!
    await screen.k.act(async () => { trigger.dispatchEvent(new screen.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await screen.k.tick(15)
  }
  const menuItem = (text: string) => screen.k.all('[role="menuitem"]').find((i) => i.textContent?.trim() === text)
  const headings = () => screen.k.all('h2, h3').map((h) => h.textContent)
  const value = (label: string) => Array.from(screen.k.all('dt')).find((dt) => dt.textContent === label)?.parentElement?.textContent ?? ''
  return { ...screen, service, factsCalls: calls, events, rerender, section, card, press, tab, button, openMenu, menuItem, headings, value, props }
}

describe('the Person panel: header, actions and tabs', () => {
  afterEach(async () => { await disposeAll() })

  it('shows the name with Primary and Role, the title, department and CON number, and the tabs of the mock-up (no Custom unless defined)', async () => {
    const s = await open({ person: meera(), showCompany: true })
    assert.equal(s.k.one('h2')!.textContent, 'Mrs. Meera PatelPrimaryDecision maker', 'name, then the Primary pill, then the Role pill')
    assert.ok(s.k.one('[data-pill="primary"]'))
    assert.equal(s.k.one('[data-pill="role"]')!.textContent, 'Decision maker')
    const header = s.k.one('h2')!.parentElement!.textContent!
    assert.ok(header.includes('Principal · Management · CON-0031'), header)
    assert.ok(header.includes('Hillcrest Academy'), 'the company is named when the panel was asked to show it')
    assert.deepEqual(s.k.all('[role="tab"]').map((t) => t.textContent), ['Overview', 'Deals', 'Schedule', 'Notes', 'Files', 'Emails', 'History'])
    s.restore()
  })

  it('names the company only when asked to (a company\'s own People tab leaves it out)', async () => {
    const s = await open({ person: meera() })
    assert.equal(s.k.one('[data-person-company]'), null)
    s.restore()
  })

  it('offers Email, SMS, WhatsApp, Call, Edit, Make or Remove primary and the more menu; Call is a tel: link to the mobile number', async () => {
    const s = await open({ person: meera() })
    for (const label of ['Email', 'SMS', 'WhatsApp', 'Edit', 'Remove primary']) assert.ok(s.button(label), label)
    assert.equal(s.k.one('a[href^="tel:"]')!.getAttribute('href'), 'tel:9825011122')
    assert.ok(s.k.one('button[aria-label="More actions"]'))
    s.restore()
  })

  it('has no phone actions for a person with no number, and says why', async () => {
    const s = await open({ person: person({ phone: null, mobile: null }) })
    assert.equal(s.button('SMS')!.disabled, true)
    assert.equal(s.button('WhatsApp')!.disabled, true)
    assert.equal(s.k.one('a[href^="tel:"]'), null)
    assert.equal(s.button('Call')!.disabled, true)
    assert.equal(s.button('SMS')!.getAttribute('title'), 'This person has no phone number.')
    s.restore()
  })

  it('adds the Custom tab when the organisation defines custom fields on people', async () => {
    const s = await open({ world: { customFields: [{ id: 5, field_label: 'School board', field_type: 'text', value: 'CBSE' }] } })
    assert.deepEqual(s.k.all('[role="tab"]').map((t) => t.textContent), ['Overview', 'Deals', 'Schedule', 'Notes', 'Files', 'Emails', 'History', 'Custom'])
    s.restore()
  })

  it('has a Back button only when it was given onClose, and it calls it', async () => {
    const withBack = await open()
    await withBack.press(withBack.k.one('[data-person-back]'))
    assert.equal(withBack.events.closed, 1)
    withBack.restore()
    await disposeAll()
    const without = await open({ withClose: false })
    assert.equal(without.k.one('[data-person-back]'), null)
    without.restore()
  })

  it('says a person was not found, and offers no retry for it', async () => {
    const s = await open({ personId: 4040 })
    assert.ok(s.k.bodyText().includes('This person was not found.'))
    absent(s.button('Try again'), 'a missing person is not retried')
    s.restore()
  })

  it('opens another person when personId changes, with nothing of the first left over', async () => {
    const s = await open({ person: meera() })
    await s.press(s.tab('Notes'))
    await s.rerender({ personId: 32 })
    assert.ok(s.k.one('h2')!.textContent!.includes('Rakesh Shah'))
    assert.equal(s.tab('Overview').getAttribute('aria-selected'), 'true', 'back on the Overview')
    s.restore()
  })

  it('has no axe violations', async () => {
    const s = await open({ person: meera(), showCompany: true })
    assert.deepEqual(await axeViolations(s.k.one('[data-person-panel]')!), [])
    s.restore()
  })
})

describe('the Person panel: Overview', () => {
  afterEach(async () => { await disposeAll() })

  it('has the sections of the mock-up in order, with Consent and Evidence after the person\'s own, and no new tab for them', async () => {
    const s = await open({ person: person({ linkedinUrl: 'linkedin.com/in/meera', reportsToName: 'Kunal Desai', contactRole: 'Billing', birthday: '1980-03-14', assistant: 'Divya', assistantPhone: '079 4000 1299', mailingStreet: '12 Ashram Road', mailingCity: 'Ahmedabad', mailingState: 'Gujarat', mailingCode: '380009', description: 'Prefers email.' }) })
    const headings = s.headings()
    const at = (text: string) => headings.findIndex((h) => h === text)
    const order = ['Contact', 'Role in the company', 'Address', 'Personal', 'Description', 'Preferences', 'Consent', 'Evidence'].map(at)
    assert.ok(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])), `in order: ${JSON.stringify(headings)}`)
    assert.equal(s.k.all('button').filter((b) => ['Evidence', 'Consent', 'Suggestions'].includes(b.textContent?.trim() ?? '')).length, 0, 'no new tab')
    assert.ok(s.value('LinkedIn').includes('linkedin.com/in/meera'))
    assert.ok(s.value('Role').includes('Billing'))
    assert.ok(s.value('Reports to').includes('Kunal Desai'))
    assert.ok(s.value('Birthday').includes('14 Mar'))
    assert.ok(s.value('Assistant').includes('Divya (079 4000 1299)'))
    assert.ok(s.value('Mailing').includes('12 Ashram Road, Ahmedabad, Gujarat 380009'))
    s.restore()
  })

  it('reads the facts and the consent of THIS person, once each', async () => {
    const s = await open()
    assert.deepEqual(s.factsCalls.entity, [{ type: 'contact', id: '31' }])
    assert.deepEqual(s.factsCalls.consent, [{ type: 'contact', id: '31' }])
    s.restore()
  })

  it('shows the person\'s facts with their evidence, and the consent per channel in words', async () => {
    const s = await open()
    assert.ok(s.section('Evidence')!.textContent!.includes('asha.menon@hillcrest.example.edu'))
    assert.ok(s.section('Evidence')!.textContent!.includes('2 waiting, 1 accepted, 1 dismissed'))
    assert.equal(s.section('Evidence')!.querySelectorAll('li[data-evidence]').length, 2 + 1 + 1 + 1, 'every fact\'s evidence is in the page')
    assert.equal(s.k.one('[data-consent-summary]')!.textContent, 'Email allowed · SMS not allowed · WhatsApp not allowed')
    s.restore()
  })

  it('a failing evidence or consent read never breaks the rest of the panel', async () => {
    const s = await open({ facts: { entity: async () => { throw new ApiError('busy', 500) }, consent: async () => { throw new ApiError('no', 403) } } })
    assert.ok(s.k.bodyText().includes('The evidence could not be loaded.'))
    assert.ok(s.k.bodyText().includes('You do not have access to consent information here.'))
    assert.ok(s.k.bodyText().includes('Role in the company'), 'the panel is intact')
    assert.ok(s.k.bodyText().includes('079 4000 1200'), 'with the person\'s own values')
    s.restore()
  })

  it('shows the written value at once, and in the Edit form, after an accepted fact wrote the email (no reload)', async () => {
    const accepted = fact({ id: 1, status: 'applied', column_written: true, decided_by_name: 'Anil Shah', value: 'asha.menon@hillcrest.example.edu', record_value: 'asha.menon@hillcrest.example.edu' })
    const s = await open({ facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }) } })
    assert.equal(s.value('Email').includes('asha.menon@hillcrest.example.edu'), false, 'the email field is blank before')
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    assert.ok(s.value('Email').includes('asha.menon@hillcrest.example.edu'), 'the Overview shows the written value without a reload')
    assert.equal(s.events.changed, 0, 'and the list was not told to reload')
    assert.ok(s.k.bodyText().includes('Accepted. The email address was written to the record.'))
    await s.press(s.button('Edit'))
    assert.equal((s.k.one('#person-email') as HTMLInputElement).value, 'asha.menon@hillcrest.example.edu', 'Edit starts from the written value')
    s.restore()
  })

  it('leaves the person alone when the accepted fact was kept in the ledger only', async () => {
    const s = await open({ person: person({ phone: '+91 11111 22222', email: null }), facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: phoneFact({ status: 'applied', column_written: false, record_value: '+91 11111 22222', value: '+91 98765 43210' }) } }) } })
    await s.press(Array.from(s.card(2)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    assert.equal(s.value('Phone').includes('+91 98765 43210'), false)
    assert.ok(s.k.bodyText().includes('The record was not changed because it already holds'))
    s.restore()
  })

  it('takes a written title and second email too, and ignores a field the panel does not show', async () => {
    const written = [
      appliedFact({ id: 4, field: 'title', value: 'Principal', column_written: true }),
      appliedFact({ id: 6, field: 'secondary_email', value: 'asha@home.example.org', column_written: true }),
      appliedFact({ id: 7, field: 'linkedin_url', value: 'https://www.linkedin.com/in/asha-menon', column_written: true }),
    ]
    const s = await open({
      facts: {
        entity: async () => entityData({ facts: [fact({ id: 1 }), fact({ id: 2, field: 'title', value: 'Principal' }), fact({ id: 3, field: 'secondary_email', value: 'asha@home.example.org' }), fact({ id: 5, field: 'linkedin_url', value: 'https://www.linkedin.com/in/asha-menon' })], counts: { proposed: 4, applied: 0, dismissed: 0 } }),
        accept: async (id) => ({ status: 1, data: { outcome: 'applied', fact: written.find((f) => String(f.id) === String(id === 2 ? 4 : id === 3 ? 6 : 7))! } }),
      },
    })
    const btn = (id: number) => Array.from(s.card(id)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept')
    await s.press(btn(2))
    await s.press(btn(3))
    await s.press(btn(5))
    assert.ok(s.value('Second email').includes('asha@home.example.org'))
    assert.ok(s.value('Title').includes('Principal'), 'the title shows in Role in the company')
    assert.ok(s.k.one('h2')!.parentElement!.textContent!.includes('Principal'), 'and under the name')
    for (const label of ['Email', 'Phone', 'Second email']) assert.equal(s.value(label).includes('linkedin.com'), false, `the LinkedIn address went into no field (${label})`)
    s.restore()
  })

  it('takes the patch off when a fresh person arrives (a reload wins over what was patched)', async () => {
    const accepted = fact({ id: 1, status: 'applied', column_written: true, value: 'asha.menon@hillcrest.example.edu' })
    const s = await open({ facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }) } })
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    assert.ok(s.value('Email').includes('asha.menon@hillcrest.example.edu'))
    s.world.people[0].email = 'typed.by.a.person@example.org'
    await s.press(s.button('Edit'))
    await s.press(s.k.withText('Cancel'))
    await s.rerender({ personId: 32 })
    await s.rerender({ personId: 31 })
    assert.ok(s.value('Email').includes('typed.by.a.person@example.org'), 'the newer person shows, not the patch')
    assert.equal(s.value('Email').includes('asha.menon@hillcrest.example.edu'), false)
    s.restore()
  })

  it('is the Overview only: the other tabs show none of it', async () => {
    const s = await open()
    await s.press(s.tab('Notes'))
    absent(s.section('Evidence'), 'no Evidence on the Notes tab')
    absent(s.section('Consent'), 'no Consent on the Notes tab')
    s.restore()
  })

  it('offers no buttons to a person who may only read, and says what they need', async () => {
    const s = await open({ facts: { entity: async () => entityData({ can: { decide: false } }) } })
    assert.equal(s.section('Evidence')!.querySelectorAll('button').length, 0)
    assert.ok(s.section('Evidence')!.textContent!.includes('needs the edit right'))
    s.restore()
  })

  it('draws a dismissed fact in words (dismissed, by whom, the reason)', async () => {
    const s = await open({ facts: { entity: async () => entityData({ facts: [dismissedFact()], counts: { proposed: 0, applied: 0, dismissed: 1 } }), consent: async () => consentData() } })
    assert.ok(s.section('Evidence')!.textContent!.includes('Dismissed by Anil Shah'))
    assert.ok(s.section('Evidence')!.textContent!.includes('Reason given: That is the school office, not her.'))
    s.restore()
  })
})

describe('the Person panel: Deals and the other tabs', () => {
  afterEach(async () => { await disposeAll() })

  it('reads the deals once, when the tab opens, and lists the five groups with a link to each record', async () => {
    const deals = {
      opportunities: [{ id: 7, name: 'ERP rollout 2026', number: 'OPP-7', stage: 'Proposal', amount: 1250000, currency: 'INR' }],
      quotes: [{ id: 42, number: 'QT-0042', status: 'Sent', total: 1250000 }],
      invoices: [{ id: 31, number: 'INV-0031', status: 'Part paid' }],
    }
    const s = await open({ person: meera(), world: { deals } })
    assert.equal(s.callsTo(/\/deals$/).length, 0, 'not read until the tab is opened')
    await s.press(s.tab('Deals'))
    assert.equal(s.callsTo(/\/crm\/contacts\/31\/deals$/).length, 1)
    assert.deepEqual(s.headings().filter((h) => /\(\d+\)$/.test(h ?? '')), ['Opportunities (1)', 'Quotes (1)', 'Sales orders (0)', 'Invoices (1)', 'Tickets (0)'])
    assert.ok(s.k.bodyText().includes('No sales orders yet.'))
    await s.press(s.k.one('[data-deals="opportunities"] button'))
    assert.equal(s.router.written.at(-1), '/module/crm/sales/opportunities/7')
    await s.press(s.k.one('[data-deals="invoices"] button'))
    assert.equal(s.router.written.at(-1), '/module/crm/sales/invoices/31')
    s.restore()
  })

  it('says so when the person is on nothing yet', async () => {
    const s = await open()
    await s.press(s.tab('Deals'))
    assert.ok(s.k.bodyText().includes('No deals yet'))
    s.restore()
  })

  it('shows a deals problem in words with a retry, and keeps the rest of the panel', async () => {
    const s = await open()
    s.world.deals = undefined
    const original = globalThis.fetch
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => (String(input).includes('/deals') ? new Response(JSON.stringify({ status: 0, message: 'The deals are busy.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : original(input as string, init))) as typeof fetch
    await s.press(s.tab('Deals'))
    assert.ok(s.k.bodyText().includes('The deals are busy.'))
    assert.ok(s.button('Try again'))
    globalThis.fetch = original
    s.restore()
  })

  it('loads Notes, Files, Emails and History only when each tab is opened, and a note is posted to the person', async () => {
    const s = await open()
    for (const part of ['comments', 'documents', 'emails', 'history']) assert.equal(s.callsTo(new RegExp(`/crm/contacts/31/${part}$`)).length, 0, `${part} is not read yet`)
    await s.press(s.tab('Notes'))
    assert.equal(s.callsTo(/\/crm\/contacts\/31\/comments$/, 'GET').length, 1)
    const box = s.k.one('textarea') as HTMLTextAreaElement
    const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLTextAreaElement.prototype, 'value')!.set!
    await s.k.act(async () => { set.call(box, 'Prefers mornings.'); box.dispatchEvent(new s.k.w.Event('input', { bubbles: true })) })
    await s.press(s.button('Post Comment'))
    const post = s.callsTo(/\/crm\/contacts\/31\/comments$/, 'POST')
    assert.equal(post.length, 1)
    assert.equal((post[0].body as { comment: string }).comment, 'Prefers mornings.')
    await s.press(s.tab('Files'))
    await s.press(s.tab('Emails'))
    await s.press(s.tab('History'))
    for (const part of ['documents', 'emails', 'history']) assert.equal(s.callsTo(new RegExp(`/crm/contacts/31/${part}$`)).length, 1, part)
    s.restore()
  })

  it('opens the Schedule of the person (their own CONTACT events)', async () => {
    const s = await open()
    await s.press(s.tab('Schedule'))
    assert.equal(s.callsTo(/\/task-management\/calendar\/events\/linked\/CONTACT\/31$/).length, 1)
    s.restore()
  })
})

describe('the Person panel: Primary, rights, delete', () => {
  afterEach(async () => { await disposeAll() })

  it('Make primary sends a POST to /primary, Remove primary a DELETE, and the pill and the list follow', async () => {
    const s = await open({ person: rakesh(), personId: 32, world: { people: [meera(), rakesh()] } })
    assert.equal(s.k.one('[data-pill="primary"]'), null)
    await s.press(s.button('Make primary'))
    assert.deepEqual(s.callsTo(/\/crm\/contacts\/32\/primary$/).map((c) => c.method), ['POST'])
    assert.ok(s.k.one('[data-pill="primary"]'), 'the Primary pill shows')
    assert.ok(s.k.bodyText().includes('Rakesh Shah is now the primary contact of Hillcrest Academy.'))
    assert.equal(s.events.changed, 1)
    assert.equal(s.world.people.find((p) => p.id === '31')!.isPrimary, false, 'the server cleared the other person')
    await s.press(s.button('Remove primary'))
    assert.deepEqual(s.callsTo(/\/crm\/contacts\/32\/primary$/).map((c) => c.method), ['POST', 'DELETE'])
    assert.equal(s.k.one('[data-pill="primary"]'), null)
    assert.ok(s.k.bodyText().includes('Rakesh Shah is no longer the primary contact.'))
    assert.equal(s.events.changed, 2)
    s.restore()
  })

  it('cannot make a person without a company primary, and says why', async () => {
    const s = await open({ person: person({ id: '40', organizationId: null, organizationName: null }) })
    const primary = s.k.one('[data-action="primary"]') as HTMLButtonElement
    assert.equal(primary.disabled, true)
    assert.equal(primary.getAttribute('title'), 'A person needs a company before it can be the primary contact.')
    s.restore()
  })

  it('shows the server\'s refusal of Primary in words and changes nothing', async () => {
    const s = await open({ person: person({ id: '41', organizationId: '135' }), world: { people: [person({ id: '41' })] } })
    s.world.people[0].organizationId = null as never
    await s.press(s.k.one('[data-action="primary"]'))
    assert.ok(s.k.bodyText().includes('A person needs a company before it can be the primary contact.'))
    assert.equal(s.k.one('[data-pill="primary"]'), null)
    s.restore()
  })

  it('disables Edit, Make primary and Transfer without the edit right, and Delete without the delete right', async () => {
    const s = await open({ rights: { view: true, add: true, edit: false, delete: false } })
    assert.equal(s.button('Edit')!.disabled, true)
    assert.equal((s.k.one('[data-action="primary"]') as HTMLButtonElement).disabled, true)
    assert.equal(s.button('Edit')!.getAttribute('title'), 'You do not have the edit right on people.')
    await s.openMenu()
    assert.equal(s.menuItem('Transfer ownership')!.getAttribute('data-disabled') !== null, true)
    assert.equal(s.menuItem('Delete')!.getAttribute('data-disabled') !== null, true)
    await s.press(s.button('Edit'))
    assert.equal(s.k.all('[role="dialog"]').length, 0, 'the dialog did not open')
    s.restore()
  })

  it('enables Edit, Make primary, Transfer and Delete with the rights', async () => {
    const s = await open()
    assert.equal(s.button('Edit')!.disabled, false)
    await s.openMenu()
    assert.equal(s.menuItem('Transfer ownership')!.getAttribute('data-disabled'), null)
    assert.equal(s.menuItem('Delete')!.getAttribute('data-disabled'), null)
    s.restore()
  })

  it('asks before deleting, deletes the person, and tells the list and the screen', async () => {
    const s = await open()
    await s.openMenu()
    await s.press(s.menuItem('Delete'))
    assert.ok(s.k.bodyText().includes('Delete Meera Patel?'))
    assert.equal(s.callsTo(/\/crm\/contacts\/31$/, 'DELETE').length, 0, 'nothing is deleted before the answer')
    await s.press(s.k.withText('Delete person'))
    assert.equal(s.callsTo(/\/crm\/contacts\/31$/, 'DELETE').length, 1)
    assert.equal(s.events.changed, 1)
    assert.equal(s.events.closed, 1)
    s.restore()
  })

  it('keeps the person when the delete is cancelled', async () => {
    const s = await open()
    await s.openMenu()
    await s.press(s.menuItem('Delete'))
    await s.press(s.k.withText('Cancel'))
    assert.equal(s.callsTo(/\/crm\/contacts\/31$/, 'DELETE').length, 0)
    assert.equal(s.events.closed, 0)
    s.restore()
  })
})
