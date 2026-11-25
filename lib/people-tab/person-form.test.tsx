import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import type { Contact } from '../../types/crm'
import { meera, peopleKit, person, type World } from './kit'

/** The Add person / Edit person dialog (the former Create Contact modal, extended in place): the real dialog and services; only the network is replaced. */

async function open(options: { contact?: Contact | null; locked?: boolean; world?: Partial<World> } = {}) {
  const screen = await peopleKit({ world: { people: [meera()], ...options.world } })
  const { CreateContactModal } = await import('../../components/domain/crm/create-contact-modal')
  const saved: Array<{ message: string; person?: Contact }> = []
  let closed = 0
  await screen.mount(screen.k.h(CreateContactModal, {
    isOpen: true, contact: options.contact ?? null, onClose: () => { closed += 1 }, onSaved: (message: string, p?: Contact) => { saved.push({ message, person: p }) },
    lockedOrganization: options.locked === false ? null : { id: '135', name: 'Hillcrest Academy' },
  }), 80)
  const field = (id: string) => screen.k.one(`#${id}`) as HTMLInputElement
  const type = async (id: string, text: string) => {
    const el = field(id)
    const proto = el.tagName === 'TEXTAREA' ? screen.k.w.HTMLTextAreaElement.prototype : screen.k.w.HTMLInputElement.prototype
    await screen.k.act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text); el.dispatchEvent(new screen.k.w.Event('input', { bubbles: true })) })
  }
  const chooseAssignee = async () => {
    const trigger = screen.k.all('[role="dialog"] button').find((b) => b.textContent?.includes('Choose an employee')) as HTMLElement
    await screen.k.click(trigger)
    await screen.k.tick(10)
    await screen.k.click(screen.k.all('[role="option"]').find((o) => o.textContent?.includes('Milan Baldaniya'))!)
    await screen.k.tick(10)
  }
  const save = async () => { await screen.k.click(screen.k.withText('Save person')!); await screen.k.tick(80) }
  const sent = (method: string, pattern: RegExp) => screen.callsTo(pattern, method)
  const groups = () => screen.k.all('[role="group"] > h3').map((h) => h.textContent)
  return { ...screen, field, type, chooseAssignee, save, sent, groups, saved, closed: () => closed }
}

describe('the Add person dialog', () => {
  afterEach(async () => { await disposeAll() })

  it('has the sections of the mock-up, the company fixed when opened from a company, and Other address collapsed', async () => {
    const s = await open()
    assert.ok(s.k.bodyText().includes('Add person'))
    assert.deepEqual(s.groups(), ['Name', 'Company', 'Reach', 'Role in the company', 'Address', 'Personal', 'Description', 'Custom fields', 'Ownership and preferences'])
    assert.equal(s.k.one('[data-locked-company]')!.textContent, 'Hillcrest Academy')
    assert.equal(s.k.all('[role="combobox"]').some((c) => c.textContent?.includes('Choose a company')), false, 'no company picker')
    const other = s.k.all('details').find((d) => d.textContent?.includes('Other address'))!
    assert.equal(other.hasAttribute('open'), false)
    const customWrapper = s.k.all('[role="group"]').find((g) => g.querySelector('h3')?.textContent === 'Custom fields')!.parentElement!
    assert.ok(customWrapper.className.includes('hidden'), 'mounted (it has to ask for the definitions) but not shown when the organisation defines none')
    assert.ok(s.k.bodyText().includes('Birthday') && s.k.bodyText().includes('Assistant phone') && s.k.bodyText().includes('LinkedIn') && s.k.bodyText().includes('Second email'))
    s.restore()
  })

  it('reads the Role picklist when it opens, and has no axe violations', async () => {
    const s = await open({ world: { roles: [{ value: 'Decision maker', label: 'Decision maker' }] } })
    assert.equal(s.callsTo(/\/crm\/picklist-values$/).length, 1)
    assert.equal(s.callsTo(/\/crm\/picklist-values$/)[0].query.get('module'), 'contacts')
    assert.deepEqual(await axeViolations(s.k.one('[role="dialog"]')!), [])
    s.restore()
  })

  it('creates the person on the fixed company, then makes them primary when asked, and reports the saved person', async () => {
    const s = await open()
    await s.type('person-last-name', 'Desai')
    await s.type('person-first-name', 'Kunal')
    await s.type('person-title', 'Trustee')
    await s.chooseAssignee()
    await s.k.click(s.field('person-primary'))
    await s.save()
    const create = s.sent('POST', /\/crm\/contacts$/)
    assert.equal(create.length, 1)
    const body = create[0].body as Record<string, unknown>
    assert.equal(body.lastName, 'Desai')
    assert.equal(body.firstName, 'Kunal')
    assert.equal(body.organizationId, '135', 'the fixed company')
    assert.equal(body.assignedTo, '2')
    assert.equal(body.birthday, null, 'an empty birthday is null, not an empty string')
    assert.equal(body.contactRole, null)
    assert.equal('isPrimary' in body, false, 'Primary has its own call')
    assert.equal(s.sent('POST', /\/crm\/contacts\/99\/primary$/).length, 1, 'then Primary is set on the new person')
    assert.equal(s.saved.length, 1)
    assert.equal(s.saved[0].person!.id, '99')
    assert.equal(s.closed(), 1)
    s.restore()
  })

  it('does not call Primary when it was not asked for', async () => {
    const s = await open()
    await s.type('person-last-name', 'Desai')
    await s.chooseAssignee()
    await s.save()
    assert.equal(s.sent('POST', /\/primary$/).length, 0)
    assert.equal(s.saved.length, 1)
    s.restore()
  })

  it('needs a last name and an owner, and sends nothing without them', async () => {
    const s = await open()
    assert.equal((s.k.withText('Save person') as HTMLButtonElement).disabled, true, 'no last name yet')
    await s.type('person-last-name', 'Desai')
    await s.save()
    assert.ok(s.k.bodyText().includes('Last name and Assigned to are required.'))
    assert.equal(s.sent('POST', /\/crm\/contacts$/).length, 0)
    s.restore()
  })

  it('shows the server\'s refusal in the dialog and stays open', async () => {
    const s = await open({ world: { refuse: [422, 'Choose a company from the list.'] } })
    await s.type('person-last-name', 'Desai')
    await s.chooseAssignee()
    await s.save()
    assert.ok(s.k.one('[role="alert"]')!.textContent!.includes('Choose a company from the list.'))
    assert.equal(s.closed(), 0)
    assert.equal(s.saved.length, 0)
    s.restore()
  })
})

describe('the Add person dialog from All people (no company fixed)', () => {
  afterEach(async () => { await disposeAll() })

  it('asks for the company, which is required', async () => {
    const s = await open({ locked: false })
    assert.equal(s.k.one('[data-locked-company]'), null)
    assert.ok(s.k.all('button').some((b) => b.textContent?.includes('Choose a company')), 'the picker')
    assert.ok(s.k.bodyText().includes('Company *'))
    await s.type('person-last-name', 'Desai')
    await s.chooseAssignee()
    await s.save()
    assert.ok(s.k.bodyText().includes('Choose a company from the list.'))
    assert.equal(s.sent('POST', /\/crm\/contacts$/).length, 0)
    s.restore()
  })

  it('disables the Primary switch until a company is chosen, and says why', async () => {
    const s = await open({ locked: false })
    assert.equal(s.field('person-primary').disabled, true)
    assert.ok(s.k.bodyText().includes('A person needs a company before it can be the primary contact.'))
    s.restore()
  })
})

describe('the Edit person dialog', () => {
  afterEach(async () => { await disposeAll() })

  it('starts from the person, keeps the company fixed, and saves with the postal code under both names and an empty birthday as null', async () => {
    const contact = person({ id: '31', isPrimary: true, mailingCode: '380009', title: 'Principal', contactRole: 'Billing', birthday: null })
    const s = await open({ contact, world: { people: [contact] } })
    assert.ok(s.k.bodyText().includes('Edit person'))
    assert.equal(s.field('person-last-name').value, 'Patel')
    assert.equal(s.field('person-title').value, 'Principal')
    assert.equal(s.field('person-mailing-Code').value, '380009')
    assert.equal(s.field('person-primary').checked, true)
    await s.type('person-title', 'Head')
    await s.save()
    const put = s.sent('PUT', /\/crm\/contacts\/31$/)
    assert.equal(put.length, 1)
    const body = put[0].body as Record<string, unknown>
    assert.equal(body.title, 'Head')
    assert.equal(body.mailingCode, '380009')
    assert.equal(body.mailingPostalCode, '380009')
    assert.equal(body.birthday, null)
    assert.equal(body.contactRole, 'Billing')
    assert.equal(s.sent('POST', /\/primary$/).length + s.sent('DELETE', /\/primary$/).length, 0, 'Primary did not change, so it was not called')
    s.restore()
  })

  it('clears Primary when it was switched off', async () => {
    const contact = person({ id: '31', isPrimary: true })
    const s = await open({ contact, world: { people: [contact] } })
    await s.k.click(s.field('person-primary'))
    await s.save()
    assert.equal(s.sent('DELETE', /\/crm\/contacts\/31\/primary$/).length, 1)
    s.restore()
  })

  it('shows the custom fields only when the organisation defines some, and saves their values with the person', async () => {
    const contact = person({ id: '31' })
    const none = await open({ contact, world: { people: [contact] } })
    const wrapper = (kit: typeof none) => kit.k.all('[role="group"]').find((g) => g.querySelector('h3')?.textContent === 'Custom fields')!.parentElement!
    assert.ok(wrapper(none).className.includes('hidden'), 'mounted (it has to ask) but not shown')
    none.restore()
    await disposeAll()
    const s = await open({ contact, world: { people: [contact], customFields: [{ id: 5, field_label: 'School board', field_type: 'text', value: 'CBSE' }] } })
    assert.equal(wrapper(s).className.includes('hidden'), false, 'shown once the organisation defines fields')
    assert.ok(s.k.bodyText().includes('School board'))
    await s.save()
    const saves = s.callsTo(/\/platform\/fields\/values\/crm_contacts\/31$/, 'POST')
    assert.equal(saves.length, 1, 'the custom field values are saved with the person')
    assert.deepEqual((saves[0].body as { values: Record<string, string> }).values, { 5: 'CBSE' })
    s.restore()
  })

  it('shows the custom fields on Add too: it asks for the definitions of a person that is not saved yet (record 0) and saves the values with the NEW person', async () => {
    const s = await open({ world: { people: [meera()], customFields: [{ id: 5, field_label: 'School board', field_type: 'text', value: null }] } })
    assert.equal(s.callsTo(/\/platform\/fields\/values\/crm_contacts\/0$/, 'GET').length, 1, 'the definitions are read for record 0')
    assert.ok(s.k.bodyText().includes('School board'))
    await s.type('person-last-name', 'Desai')
    await s.chooseAssignee()
    await s.save()
    const saves = s.callsTo(/\/platform\/fields\/values\/crm_contacts\/99$/, 'POST')
    assert.equal(saves.length, 1, 'the custom field values are saved under the id of the person just created')
    s.restore()
  })

  it('offers the other people of the company under Reports to, never the person themselves', async () => {
    const contact = person({ id: '31' })
    const other = person({ id: '32', firstName: 'Rakesh', lastName: 'Shah' })
    const s = await open({ contact, world: { people: [contact, other] } })
    assert.deepEqual(s.callsTo(/\/crm\/contacts$/).map((c) => c.query.get('organization_id')), ['135'])
    s.restore()
  })
})
