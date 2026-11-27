import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import { listOf, people, person, summary } from './outreach-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The All people view and the person's panel (the drawer of the list), as a person meets them: the real components, the address kept by a stand-in router, the Outreach API as a fake.
 */

async function open(options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit(options)
  const { OutreachPeople } = await import('../../components/domain/signals/outreach/outreach-people')
  await s.mount(s.k.h(OutreachPeople, { service: s.service, messageDeps: s.messageDeps }))
  return s
}


/** A list that remembers what was changed, the way the server does: the next time the list is read it has the new details. */
function livePeople() {
  let rows = people()
  const change = (id: number, patch: Record<string, unknown>) => {
    rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    return { status: 1, data: rows.find((row) => row.id === id)! }
  }
  return {
    people: async () => listOf(rows),
    updatePerson: async (id: number, body: unknown) => change(id, body as Record<string, unknown>),
    setConsent: async (id: number, body: { reason?: string }) => change(id, { ...body, reason: undefined }),
    convertToLead: async (_company: number, body?: { person_id?: number }) => {
      if (body?.person_id) change(body.person_id, { lead_id: 4001 })
      return { status: 1, data: { lead_id: 4001, created: true } }
    },
  }
}

const lastQuery = (s: Awaited<ReturnType<typeof open>>) => s.calls.people[s.calls.people.length - 1]
const panel = (s: Awaited<ReturnType<typeof open>>) => s.k.one('[data-person-panel]')

describe('All people: what a row says', () => {
  afterEach(cleanup)

  it('draws each person with the company, the contact details, the reach, what they agreed to and where they came from', async () => {
    const s = await open()
    const meera = s.rowOf('Meera Patel')!
    for (const text of ['Riverdale Public School', 'Principal', 'principal@riverdale.example', '+919876543210', 'Email and phone', 'No answer yet', 'Found from signals', 'Not assigned', 'Not yet']) says(meera.textContent, text)
    assert.equal(meera.querySelector('[data-source="found"]')!.getAttribute('title'), 'Found on a public page, not verified')

    const ravi = s.rowOf('Ravi Shah')!
    says(ravi.textContent, 'Added by hand')
    says(ravi.textContent, 'Email only')
    assert.equal(s.k.all('tbody tr').length, 5)
  })

  it('marks the main contact with a star and the words, and a company\'s own line as "Company line"', async () => {
    const s = await open()
    assert.ok(s.rowOf('Meera Patel')!.querySelector('svg'), 'a star')
    says(s.rowOf('Meera Patel')!.querySelector('.sr-only')!.textContent, '(Main contact)')
    const line = s.rowOf('info@riverdale.example')!
    says(line.textContent, 'Company line')
    absent(line.querySelector('.sr-only'), 'a line that is not primary has no star')
    assert.equal(line.querySelector('input[type="checkbox"]')!.getAttribute('aria-label'), 'Select Riverdale Public School (company line)')
  })

  it('shows a blocked person as Do not contact with the answer they gave', async () => {
    const s = await open()
    const kiran = s.rowOf('Kiran Desai')!
    says(kiran.textContent, 'Do not contact')
    says(kiran.textContent, 'Opted out')
    assert.equal(kiran.querySelector('[data-reach]')!.getAttribute('data-reach'), 'blocked')
  })

  it('links the company\'s name to the company\'s page without opening the person', async () => {
    const s = await open()
    await s.press(s.rowOf('Ravi Shah')!.querySelector('[data-company-link]'))
    assert.equal(s.router.written[s.router.written.length - 1], '/signals/outreach/3')
    absent(s.k.one('[data-person-panel]'), 'the person was not opened')
  })

  it('has no accessibility violation a fake page can see', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('table')!.parentElement!), [])
  })
})

describe('All people: chips, search and sort', () => {
  afterEach(cleanup)

  it('prints the server\'s counts and asks for exactly the chip\'s own filter', async () => {
    const s = await open({ overrides: { people: async () => listOf(people(), { summary: summary({ all: 30, reachable: 18, needs_details: 8, blocked: 4, found: 22, manual: 8, mine: 6 }) }) } })
    assert.equal(s.chip('Ready to contact')!.getAttribute('aria-label'), 'Ready to contact 18')
    assert.equal(s.chip('Do not contact')!.getAttribute('aria-label'), 'Do not contact 4')
    assert.equal(s.chip('Mine')!.getAttribute('aria-label'), 'Mine 6')

    await s.press(s.chip('Do not contact'))
    assert.equal(lastQuery(s).reach, 'blocked')
    assert.equal(lastQuery(s).source, undefined)
    await s.press(s.chip('Added by hand'))
    assert.equal(lastQuery(s).source, 'manual')
    assert.equal(lastQuery(s).reach, undefined)
    await s.press(s.chip('Mine'))
    assert.equal(lastQuery(s).mine, true)
    assert.equal(s.chip('Mine')!.getAttribute('aria-pressed'), 'true')
  })

  it('asks for what was typed after a pause and sorts by Name, then Company', async () => {
    const s = await open()
    await s.type(s.k.one('input[aria-label="Search all people"]'), 'meera')
    await s.settle(320)
    assert.equal(lastQuery(s).search, 'meera')
    const head = (label: string) => s.k.all('thead th button').find((b) => b.textContent === label)
    await s.press(head('Name'))
    assert.equal(lastQuery(s).sort, 'name')
    assert.equal(lastQuery(s).dir, 'desc')
    await s.press(head('Company'))
    assert.equal(lastQuery(s).sort, 'company')
    assert.equal(lastQuery(s).dir, 'asc')
    assert.equal(lastQuery(s).search, 'meera', 'sorting keeps the search')
  })

  it('tells an empty list what to do next, and a list a chip emptied how to get back', async () => {
    const empty = await open({ overrides: { people: async () => listOf([]) } })
    says(empty.k.bodyText(), 'No people yet. Open a company and use Find contacts, or add a person by hand.')
    await cleanup()
    const s = await open({ overrides: { people: async (query) => (query.reach === 'blocked' ? listOf([]) : listOf(people())) } })
    await s.press(s.chip('Do not contact'))
    says(s.k.bodyText(), 'No person matches. Clear the search, or pick All.')
  })

  it('says why in words when the list is refused', async () => {
    const s = await open({ overrides: { people: async () => { throw new ApiError('Forbidden', 403) } } })
    says(s.k.one('[role="alert"]')!.textContent, 'You are not allowed to do this.')
  })
})

describe('All people: the person\'s drawer', () => {
  afterEach(cleanup)

  it('opens the person in a drawer and writes ?person= into the address when a row is pressed', async () => {
    const s = await open()
    await s.press(s.rowOf('Meera Patel')!.querySelectorAll('td')[3])
    assert.equal(s.router.lastSearch(), 'person=11')
    const drawer = panel(s)!
    assert.equal(drawer.getAttribute('data-person-panel'), '11')
    says(drawer.querySelector('h2')!.textContent, 'Meera Patel')
    for (const text of ['Write message', 'Edit', 'What they agreed to', 'Convert to lead']) assert.ok(s.button(text, drawer), text)
    assert.deepEqual(s.k.all('[role="tab"]').map((t) => t.textContent), ['Overview', 'Messages'])
  })

  it('opens the person a pasted link names', async () => {
    const s = await open({ search: 'person=12' })
    assert.equal(panel(s)!.getAttribute('data-person-panel'), '12')
    says(panel(s)!.textContent, 'Ravi Shah')
  })

  it('asks for a person by id when the link names someone who is not on the loaded page, and shows them', async () => {
    const s = await open({ search: 'person=14', overrides: { people: async () => listOf([people()[0]]) } })
    assert.deepEqual(s.calls.person, [14], 'the server was asked for exactly that person')
    assert.equal(panel(s)!.getAttribute('data-person-panel'), '14')
    says(panel(s)!.textContent, 'Anita Rao')
  })

  it('says a person could not be found, with a way out, when the link names someone the server does not have', async () => {
    const s = await open({ search: 'person=999', overrides: { person: async () => { throw new Error('not found') } } })
    absent(panel(s), 'it is not there')
    says(s.dialog()!.textContent, 'This person could not be found.')
    await s.press(s.button('Close', s.dialog()!.querySelector('[role="alert"]')!))
    assert.equal(s.router.lastSearch(), '', 'the address no longer names the person')
  })

  it('says on a person found on the web that nobody has checked the details, and links the page it came from', async () => {
    const s = await open({ search: 'person=11' })
    const note = panel(s)!.querySelector('[data-unverified]')!
    assert.equal(note.textContent, 'Found on a public page, not verified.')
    const links = Array.from(panel(s)!.querySelectorAll('a[target="_blank"]')).map((a) => a.getAttribute('href'))
    assert.deepEqual(links, ['https://riverdale.example/team', 'https://riverdale.example/contact'])
    for (const a of panel(s)!.querySelectorAll('a[target="_blank"]')) assert.equal(a.getAttribute('rel'), 'noopener noreferrer')
  })

  it('says a person added by hand was added by hand, and offers Delete for them only', async () => {
    const manual = await open({ search: 'person=12' })
    says(manual.k.one('[data-person-panel]')!.textContent, 'Added by hand on 21 Nov 2026.')
    await manual.openMenu()
    assert.ok(manual.menuItem('Delete person'), 'a person added by hand can be deleted')
    await cleanup()
    const found = await open({ search: 'person=11' })
    await found.openMenu()
    assert.ok(found.menuItem('Mark do not contact'), 'a found person is marked do not contact instead')
    absent(found.menuItem('Delete person'), 'it is not there')
  })

  it('does not turn a stored link that is not a web address into a link', async () => {
    const hostile = person({ id: 21, full_name: 'Test Person', source_url: 'javascript:alert(1)', email_source_url: 'ftp://x.example/y', phone_source_url: null })
    const s = await open({ search: 'person=21', overrides: { people: async () => listOf([hostile]) } })
    assert.equal(panel(s)!.querySelectorAll('a[target="_blank"]').length, 0)
  })

  it('says in words why a person cannot be written to', async () => {
    const s = await open({ search: 'person=15' })
    assert.equal(panel(s)!.querySelector('[data-blocked-reason]')!.textContent, 'They opted out.')
    says(panel(s)!.textContent, 'No message can be written.')
  })

  it('shows the messages written to the person, with their status in words', async () => {
    const s = await open({
      search: 'person=11',
      overrides: { personMessages: async () => ({ status: 1, data: [
        { id: 31, subject: 'Hello Meera', status: 'pending_approval', created_at: '2026-11-25T09:00:00+00:00', sent_at: null },
        { id: 32, subject: 'Earlier note', status: 'sent', created_at: '2026-11-10T09:00:00+00:00', sent_at: '2026-11-11T09:00:00+00:00' },
      ] }) },
    })
    await s.press(s.k.all('[role="tab"]').find((t) => t.textContent === 'Messages'), 40)
    assert.deepEqual(s.calls.personMessages, [11])
    const rows = s.k.all('[data-message]')
    assert.equal(rows.length, 2)
    says(rows[0].textContent, 'Hello Meera')
    says(rows[0].textContent, 'Waiting for approval')
    says(rows[1].textContent, 'Sent 11 Nov 2026')
    assert.ok(!/pending_approval/.test(s.k.bodyText()), 'no raw status code on screen')
  })

  it('says what to do when nothing has been written to the person yet', async () => {
    const s = await open({ search: 'person=11' })
    await s.press(s.k.all('[role="tab"]').find((t) => t.textContent === 'Messages'), 40)
    says(s.k.bodyText(), 'No message has been written to this person yet. Use Write message.')
  })
})

describe('All people: what they agreed to', () => {
  afterEach(cleanup)

  it('saves the answer and the two switches, shows it at once and reads the list again', async () => {
    const s = await open({ search: 'person=11', overrides: livePeople() })
    const before = s.calls.people.length
    await s.press(s.button('What they agreed to', panel(s)!))
    const dialog = s.dialog()!
    await s.press(Array.from(dialog.querySelectorAll('input[type="radio"]')).find((r) => (r as HTMLInputElement).value === 'opted_out'))
    await s.press(Array.from(dialog.querySelectorAll('label')).find((l) => l.textContent?.includes('Do not call them'))!.querySelector('input'))
    await s.type(s.field('Why (optional)', dialog), 'Asked by phone')
    await s.press(s.button('Save', dialog), 40)
    assert.deepEqual(s.calls.setConsent, [{ id: 11, body: { consent_status: 'opted_out', email_opt_out: false, do_not_call: true, reason: 'Asked by phone' } }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'What they agreed to was saved.')
    says(panel(s)!.textContent, 'Opted out')
    assert.equal(s.calls.people.length, before + 1, 'the list was read again')
  })

  it('opens already set to do not contact from the menu, and saves both switches with the answer', async () => {
    const s = await open({ search: 'person=11' })
    await s.openMenu()
    await s.press(s.menuItem('Mark do not contact'), 40)
    const dialog = s.dialog()!
    says(dialog.textContent, 'Mark as do not contact')
    await s.press(s.button('Save', dialog), 40)
    assert.deepEqual(s.calls.setConsent, [{ id: 11, body: { consent_status: 'opted_out', email_opt_out: true, do_not_call: true } }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'is marked do not contact.')
  })

  it('cannot lift a suppression from here, and says so', async () => {
    const s = await open({ search: 'person=16', overrides: { people: async () => listOf([person({ id: 16, full_name: 'Neha Jain', consent_status: 'suppressed', suppressed_reason: 'Bounced', reach: 'blocked' })]) } })
    await s.press(s.button('What they agreed to', panel(s)!))
    const dialog = s.dialog()!
    says(dialog.textContent, 'They are on the do not contact list because of a bounce, a complaint or an earlier request.')
    assert.equal(s.button('Save', dialog)!.disabled, true)
    assert.equal(dialog.querySelectorAll('input[type="radio"]').length, 0)
  })
})

describe('All people: editing, deleting and converting one person', () => {
  afterEach(cleanup)

  it('sends only what was changed when a person is edited, and shows the saved details', async () => {
    const s = await open({ search: 'person=11', overrides: livePeople() })
    await s.press(s.button('Edit', panel(s)!))
    const dialog = s.dialog()!
    says(dialog.textContent, 'Edit person')
    assert.equal(s.button('Save changes', dialog)!.disabled, true, 'nothing changed yet')
    await s.type(s.field('Job title', dialog), 'Head of school')
    await s.press(s.button('Save changes', dialog), 40)
    assert.deepEqual(s.calls.updatePerson, [{ id: 11, body: { designation: 'Head of school' } }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'The details were saved.')
    says(panel(s)!.textContent, 'Head of school')
  })

  it('asks before deleting a person added by hand, then deletes them and closes the drawer', async () => {
    const s = await open({ search: 'person=12' })
    await s.openMenu()
    await s.press(s.menuItem('Delete person'), 40)
    says(s.confirmDialog()!.textContent, 'Delete Ravi Shah?')
    assert.deepEqual(s.calls.deletePerson, [])
    await s.press(s.button('Delete person', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.deletePerson, [12])
    assert.equal(s.router.lastSearch(), '', 'the drawer closed')
  })

  it('makes a lead for this person after asking, and then offers Open lead instead', async () => {
    const s = await open({ search: 'person=11', overrides: livePeople() })
    await s.press(s.button('Convert to lead', panel(s)!))
    says(s.confirmDialog()!.textContent, 'Make a lead from Meera Patel?')
    await s.press(s.button('Convert to lead', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.convertToLead, [{ id: 1, body: { person_id: 11 } }])
    assert.equal(s.k.one('[data-notice="success"] a')!.getAttribute('href'), '/module/crm/marketing/leads/4001')
    absent(s.button('Convert to lead', panel(s)!), 'it is not there')
    assert.equal(panel(s)!.querySelector('a[href="/module/crm/marketing/leads/4001"]')!.textContent?.includes('Open lead'), true)
  })

  it('changes the owner of one person from the menu', async () => {
    const s = await open({ search: 'person=11' })
    await s.openMenu()
    await s.press(s.menuItem('Change owner'), 40)
    await s.choose('New owner', 'Asha Rao')
    await s.press(s.button('Change owner', s.dialog()!), 40)
    assert.deepEqual(s.calls.assign, [{ person_ids: [11], assigned_to: 5 }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'The owner was changed.')
  })
})

describe('All people: the ticked rows and Add person', () => {
  afterEach(cleanup)

  it('offers Write message and Assign owner for ticked people, and no Convert to lead', async () => {
    const s = await open()
    await s.press(s.k.one('input[aria-label="Select Meera Patel"]'))
    const bar = s.k.one('[aria-label="Actions for the selected rows"]')!
    says(bar.textContent, '1 person selected')
    assert.ok(s.button('Write message', bar))
    assert.ok(s.button('Assign owner', bar))
    absent(s.button('Convert to lead', bar), 'it is not there')
  })

  it('opens the message dialog with the ticked people and no further reading of the server', async () => {
    const s = await open()
    await s.press(s.k.one('input[aria-label="Select Meera Patel"]'))
    await s.press(s.k.one('input[aria-label="Select Ravi Shah"]'))
    await s.press(s.button('Write message', s.k.one('[aria-label="Actions for the selected rows"]')!), 40)
    const written = s.dialog()!.querySelector('[aria-label="Will be written to"]')!
    says(written.textContent, 'Meera Patel')
    says(written.textContent, 'Ravi Shah')
  })

  it('assigns the chosen owner to the ticked people', async () => {
    const s = await open()
    await s.press(s.k.one('input[aria-label="Select Meera Patel"]'))
    await s.settle(20)
    await s.choose('Owner to assign', 'Asha Rao')
    await s.press(s.button('Assign owner'), 40)
    assert.deepEqual(s.calls.assign, [{ person_ids: [11], assigned_to: 5 }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'The owner was changed for 1 person.')
  })

  it('asks for the company when a person is added from the list, and saves the person against the one chosen', async () => {
    const s = await open()
    await s.press(s.button('Add person'))
    const dialog = s.dialog()!
    says(dialog.textContent, 'Add a person')
    await s.press(s.button('Add person', dialog))
    says(dialog.textContent, 'Choose the company.')
    says(dialog.textContent, 'Give a name, an email or a phone number.')
    assert.deepEqual(s.calls.addPerson, [])

    await s.settle(40)
    await s.press(Array.from(dialog.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Greenfield Traders')), 40)
    assert.equal(dialog.querySelector('[data-picked-company]')!.textContent, 'Greenfield Traders')
    await s.type(s.field('Name', dialog), 'Hetal Mehta')
    await s.type(s.field('Email', dialog), 'hetal@greenfield.example')
    await s.press(s.button('Add person', dialog), 40)
    assert.deepEqual(s.calls.addPerson, [{ company_id: 3, full_name: 'Hetal Mehta', email: 'hetal@greenfield.example' }])
    const notice = s.k.one('[data-notice="success"]')!
    says(notice.textContent, 'Hetal Mehta was added.')
    assert.equal(notice.querySelector('a')!.getAttribute('href'), '/signals/outreach/3?tab=people')
  })
})
