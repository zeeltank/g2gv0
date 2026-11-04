import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent } from '../agent/assertions'
import { ApiError } from '../../services/core'
import type { FactsApi } from '../../services/facts/api-types'
import type { Contact } from '../../types/crm'
import { fakeFactsService } from './fake-service'
import { appliedFact, consentData, dismissedFact, entityData, fact, phoneFact } from './fixtures'
import { screenKit } from './screen-kit'

/** The Contact detail page as a person meets it: the real page, the real sidebar hook and service client, only the network (and the facts API, as a fake) replaced. */

function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: '31', contactNo: 'CON-0031', organizationId: '135', organizationName: 'Hillcrest Academy', salutation: null, firstName: 'Asha', lastName: 'Menon', title: null, department: null,
    email: null, secondaryEmail: null, phone: '+91 11111 22222', mobile: null, fax: null, homePhone: null, assistant: null, assistantPhone: null, reportsToId: null,
    birthday: null, leadSource: null, doNotCall: false, emailOptOut: false, mailingStreet: null, mailingCity: null, mailingState: null, mailingCode: null, mailingCountry: null,
    mailingPoBox: null, otherStreet: null, otherCity: null, otherState: null, otherCode: null, otherCountry: null, otherPoBox: null, description: null, assignedTo: null, createdBy: null,
    createdAt: null, updatedAt: null, ...over,
  }
}

const PICKLISTS = { salutation: [], leadSource: [] }

async function open(options: { contact?: Contact; facts?: Partial<FactsApi> } = {}) {
  const screen = await screenKit({ pathname: '/module/crm/marketing/contacts/31' })
  const { ContactDetailPage } = await import('../../components/domain/crm/contact-detail-page')
  const { service, calls } = fakeFactsService(options.facts)
  let saved = 0
  const props = { contact: options.contact ?? contact(), onSaved: () => { saved += 1 }, onBack: () => undefined, picklists: PICKLISTS, factsService: service }
  await screen.mount(screen.k.h(ContactDetailPage, props), 40)
  const rerender = async (next: Partial<typeof props>) => { await screen.k.render(screen.wrap(screen.k.h(ContactDetailPage, { ...props, ...next }))); await screen.k.tick(40) }
  const section = (title: string) => screen.k.one(`[data-section="${title}"]`)
  const card = (id: number) => screen.k.one(`li[data-fact="${id}"]`)
  const press = async (target: Element | null | undefined) => { assert.ok(target, 'the control exists'); await screen.k.click(target); await screen.k.tick(15) }
  const info = () => screen.k.bodyText()
  return { ...screen, service, factsCalls: calls, saved: () => saved, rerender, section, card, press, info, props }
}

describe('the Contact detail page: Evidence and consent', () => {
  afterEach(async () => { await disposeAll() })

  it('shows the consent line and the Evidence section on the Details tab, after the contact\'s own sections, and no new tab or menu entry', async () => {
    const s = await open()
    const headings = s.k.all('h2, h3').map((h) => h.textContent)
    const at = (text: string) => headings.findIndex((h) => h === text)
    assert.ok(at('Contact Information') >= 0 && at('Mailing Address') > at('Contact Information') && at('Description') > at('Mailing Address'), 'the page\'s own sections are as they were')
    assert.ok(at('Consent') > at('Description'), 'consent comes after the description')
    assert.ok(at('Evidence') > at('Consent'), 'then the evidence')
    assert.deepEqual(s.k.all('button').filter((b) => ['Evidence', 'Consent', 'Suggestions'].includes(b.textContent?.trim() ?? '')).length, 0, 'no new tab')
    s.restore()
  })

  it('reads the facts and the consent of THIS contact, once each', async () => {
    const s = await open()
    assert.deepEqual(s.factsCalls.entity, [{ type: 'contact', id: '31' }])
    assert.deepEqual(s.factsCalls.consent, [{ type: 'contact', id: '31' }])
    s.restore()
  })

  it('shows the contact\'s facts with their evidence, and the consent per channel in words', async () => {
    const s = await open()
    assert.ok(s.section('Evidence')!.textContent!.includes('asha.menon@hillcrest.example.edu'))
    assert.ok(s.section('Evidence')!.textContent!.includes('2 waiting, 1 accepted, 1 dismissed'))
    assert.equal(s.section('Evidence')!.querySelectorAll('li[data-evidence]').length, 2 + 1 + 1 + 1, 'every fact\'s evidence is in the page')
    assert.equal(s.k.one('[data-consent-summary]')!.textContent, 'Email allowed · SMS not allowed · WhatsApp not allowed')
    s.restore()
  })

  it('a failing evidence or consent read never breaks the rest of the page', async () => {
    const s = await open({ facts: { entity: async () => { throw new ApiError('busy', 500) }, consent: async () => { throw new ApiError('no', 403) } } })
    assert.ok(s.info().includes('The evidence could not be loaded.'))
    assert.ok(s.info().includes('You do not have access to consent information here.'))
    assert.ok(s.info().includes('Contact Information'), 'the page is intact')
    assert.ok(s.info().includes('+91 11111 22222'), 'with the contact\'s own values')
    s.restore()
  })

  it('shows the new value on the page, and in the page\'s own contact, after an accepted fact wrote the email (so Edit would start from it)', async () => {
    const accepted = fact({ id: 1, status: 'applied', column_written: true, decided_by_name: 'Anil Shah', value: 'asha.menon@hillcrest.example.edu', record_value: 'asha.menon@hillcrest.example.edu' })
    const s = await open({ facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }) } })
    const emailCell = () => Array.from(s.k.all('dt')).find((dt) => dt.textContent === 'Email')?.parentElement?.textContent ?? ''
    assert.equal(emailCell().includes('asha.menon@hillcrest.example.edu'), false, 'the email field is blank before')
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    assert.ok(emailCell().includes('asha.menon@hillcrest.example.edu'), 'the Contact Information shows the written value without a reload')
    assert.equal(s.saved(), 0, 'and the page did not have to reload the contact')
    assert.ok(s.k.bodyText().includes('Accepted. The email address was written to the record.'))
    s.restore()
  })

  it('leaves the page\'s contact alone when the accepted fact was kept in the ledger only', async () => {
    const s = await open({ facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: phoneFact({ status: 'applied', column_written: false, record_value: '+91 11111 22222', value: '+91 98765 43210' }) } }) } })
    await s.press(Array.from(s.card(2)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    assert.equal(s.info().includes('+91 98765 43210') && Array.from(s.k.all('dt')).find((dt) => dt.textContent === 'Phone')?.parentElement?.textContent?.includes('+91 98765 43210'), false)
    assert.ok(s.info().includes('The record was not changed because it already holds'))
    s.restore()
  })

  it('takes a written title and secondary email too, and ignores a field the page does not show', async () => {
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
    const dd = (label: string) => Array.from(s.k.all('dt')).find((dt) => dt.textContent === label)?.parentElement?.textContent ?? ''
    assert.ok(dd('Secondary Email').includes('asha@home.example.org'))
    assert.ok(s.k.one('h1')!.parentElement!.textContent!.includes('Principal · Hillcrest Academy'), 'the title shows under the name')
    for (const label of ['Email', 'Phone', 'Secondary Email']) assert.equal(dd(label).includes('linkedin.com'), false, `the LinkedIn address went into no field (${label}): the page has none for it`)
    s.restore()
  })

  it('takes the patch off when a fresh contact arrives (a reload wins over what was patched)', async () => {
    const accepted = fact({ id: 1, status: 'applied', column_written: true, value: 'asha.menon@hillcrest.example.edu' })
    const s = await open({ facts: { accept: async () => ({ status: 1, data: { outcome: 'applied', fact: accepted } }) } })
    await s.press(Array.from(s.card(1)!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Accept'))
    const emailCell = () => Array.from(s.k.all('dt')).find((dt) => dt.textContent === 'Email')?.parentElement?.textContent ?? ''
    assert.ok(emailCell().includes('asha.menon@hillcrest.example.edu'))
    await s.rerender({ contact: contact({ email: 'typed.by.a.person@example.org' }) })
    assert.ok(emailCell().includes('typed.by.a.person@example.org'), 'the newer contact shows, not the patch')
    assert.equal(emailCell().includes('asha.menon@hillcrest.example.edu'), false)
    s.restore()
  })

  it('is the Details tab only: the other tabs show none of it', async () => {
    const s = await open()
    await s.k.click(s.k.withText('Comments')!)
    await s.k.tick(20)
    absent(s.section('Evidence'), 'no Evidence on the Comments tab')
    absent(s.section('Consent'), 'no Consent on the Comments tab')
    s.restore()
  })

  it('offers no buttons to a person who may only read, and says what they need', async () => {
    const s = await open({ facts: { entity: async () => entityData({ can: { decide: false } }) } })
    assert.equal(s.section('Evidence')!.querySelectorAll('button').length, 0)
    assert.ok(s.section('Evidence')!.textContent!.includes('needs the edit right'))
    s.restore()
  })

  it('draws the consent and evidence of a dismissed fact in words (dismissed, by whom, the reason)', async () => {
    const s = await open({ facts: { entity: async () => entityData({ facts: [dismissedFact()], counts: { proposed: 0, applied: 0, dismissed: 1 } }), consent: async () => consentData() } })
    assert.ok(s.section('Evidence')!.textContent!.includes('Dismissed by Anil Shah'))
    assert.ok(s.section('Evidence')!.textContent!.includes('Reason given: That is the school office, not her.'))
    s.restore()
  })
})
