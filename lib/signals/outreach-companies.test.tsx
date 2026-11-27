import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import { companies, listOf, people, summary } from './outreach-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The Companies view of the Outreach tab as a person meets it: the real component, a router that keeps the address, the Outreach API as a fake that records each call. Every test
 * ends on something that is on the screen or in a recorded call, not on the absence of an error.
 */

async function open(options: Parameters<typeof outreachKit>[0] = {}) {
  const s = await outreachKit(options)
  const { OutreachCompanies } = await import('../../components/domain/signals/outreach/outreach-companies')
  await s.mount(s.k.h(OutreachCompanies, { service: s.service, messageDeps: s.messageDeps }))
  return s
}

const lastQuery = (s: Awaited<ReturnType<typeof open>>) => s.calls.companies[s.calls.companies.length - 1]

describe('Companies: what a row says', () => {
  afterEach(cleanup)

  it('draws one row per company with its reach word, people count and best contact, and a pill for the one added by hand', async () => {
    const s = await open()
    const riverdale = s.rowOf('Riverdale Public School')!
    says(riverdale.textContent, 'Email and phone')
    says(riverdale.textContent, 'Meera Patel')
    says(riverdale.textContent, 'principal@riverdale.example')
    assert.equal(riverdale.querySelector('[data-people-count]')!.textContent, '1')
    assert.equal(riverdale.querySelector('[data-reach]')!.getAttribute('data-reach'), 'ready')

    const sunrise = s.rowOf('Sunrise Academy')!
    says(sunrise.textContent, 'Needs details')
    says(sunrise.textContent, 'No contact yet')
    absent(sunrise.querySelector('[data-source="manual"]'), 'a found company has no Added by hand pill')

    const greenfield = s.rowOf('Greenfield Traders')!
    says(greenfield.textContent, 'Added by hand')
    says(greenfield.textContent, 'Email only')
    says(greenfield.textContent, 'ravi@greenfield.example')
    assert.equal(s.k.all('tbody tr').length, 3)
  })

  it('shows the phone of the best contact when there is no email, and "Not yet" for a company nobody has written to', async () => {
    const rows = companies()
    rows[0] = { ...rows[0], best_contact: { id: 11, name: 'Meera Patel', designation: 'Principal', email: null, phone: '+919876543210' }, last_contacted_at: '2026-11-18T10:00:00+00:00' }
    const s = await open({ overrides: { companies: async () => listOf(rows) } })
    says(s.rowOf('Riverdale')!.textContent, '+919876543210')
    says(s.rowOf('Riverdale')!.textContent, '18 Nov 2026')
    says(s.rowOf('Sunrise')!.textContent, 'Not yet')
  })

  it('gives the Signals count as a link to Market Signals and says how many signals in its name', async () => {
    const s = await open()
    const link = s.rowOf('Riverdale')!.querySelector('a[href="/signals"]')!
    assert.equal(link.textContent, '2')
    says(link.getAttribute('aria-label'), '2 signals for Riverdale Public School')
    absent(s.rowOf('Greenfield')!.querySelector('a[href="/signals"]'), 'no signals, no link')
  })

  it('lets the least important columns step aside on a narrow list and keeps Company and Reach', async () => {
    const s = await open()
    const heads = Object.fromEntries(s.k.all('thead th').map((th) => [th.textContent?.trim(), th.className]))
    for (const name of ['Industry', 'Location', 'Owner']) assert.match(heads[name], /(^| )hidden( |$)/, `${name} hides on a narrow list`)
    assert.doesNotMatch(heads.Company, /hidden/)
    assert.doesNotMatch(heads.Reach, /hidden/)
    says(s.rowOf('Riverdale')!.textContent, 'Meera Patel')
  })

  it('has no accessibility violation a fake page can see', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('table')!.parentElement!), [])
  })
})

describe('Companies: the chips and their numbers', () => {
  afterEach(cleanup)

  it('prints the server\'s own counts on the chips and names each one with its number', async () => {
    const s = await open({ overrides: { companies: async () => listOf(companies(), { summary: summary({ all: 14, reachable: 9, needs_details: 3, blocked: 2, found: 10, manual: 4, mine: 5 }) }) } })
    const wanted: Record<string, string> = { All: 'All 14', 'Ready to contact': 'Ready to contact 9', 'Needs details': 'Needs details 3', 'Found from signals': 'Found from signals 10', 'Added by hand': 'Added by hand 4', Mine: 'Mine 5', 'Do not contact': 'Do not contact 2' }
    for (const [label, name] of Object.entries(wanted)) assert.equal(s.chip(label)!.getAttribute('aria-label'), name, label)
    assert.equal(s.k.all('[role="group"][aria-label="Show"] button').length, 7)
  })

  it('asks the server for exactly the chip\'s own filter, one chip at a time, and goes back to page one', async () => {
    const s = await open()
    assert.equal(s.calls.companies.length, 1)
    assert.equal(lastQuery(s).per_page, 20)
    assert.equal(lastQuery(s).reach, undefined)

    const expected: Array<[string, Record<string, unknown>]> = [
      ['Ready to contact', { reach: 'reachable' }],
      ['Needs details', { reach: 'needs_details' }],
      ['Found from signals', { source: 'found' }],
      ['Added by hand', { source: 'manual' }],
      ['Mine', { mine: true }],
      ['Do not contact', { reach: 'blocked' }],
    ]
    for (const [label, filter] of expected) {
      await s.press(s.chip(label))
      const query = lastQuery(s)
      const sent = ['reach', 'source', 'mine'].filter((key) => (query as Record<string, unknown>)[key] !== undefined).map((key) => [key, (query as Record<string, unknown>)[key]])
      assert.deepEqual(Object.fromEntries(sent), filter, label)
      assert.equal(query.page, 1, label)
      assert.equal(s.chip(label)!.getAttribute('aria-pressed'), 'true', label)
      assert.equal(s.chip('All')!.getAttribute('aria-pressed'), 'false', label)
    }
    await s.press(s.chip('All'))
    assert.deepEqual(['reach', 'source', 'mine'].filter((key) => (lastQuery(s) as Record<string, unknown>)[key] !== undefined), [], 'All sends no filter')
  })

  it('says nothing matches, and how to get back, when a chip leaves no company', async () => {
    const s = await open({ overrides: { companies: async (query) => (query.reach === 'blocked' ? listOf([]) : listOf(companies())) } })
    await s.press(s.chip('Do not contact'))
    says(s.k.bodyText(), 'No company matches. Clear the search, or pick All.')
    assert.equal(s.k.all('tbody tr').length, 1, 'the one row is the message')
  })
})

describe('Companies: search, sort and paging', () => {
  afterEach(cleanup)

  it('asks for what was typed once typing pauses, not for every letter', async () => {
    const s = await open()
    const box = s.k.one('input[aria-label="Search companies"]') as HTMLInputElement
    const before = s.calls.companies.length
    await s.type(box, 'sun')
    await s.settle(100)
    await s.type(box, 'sunrise')
    assert.equal(s.calls.companies.length, before, 'still waiting for a pause')
    await s.settle(320)
    assert.equal(s.calls.companies.length, before + 1, 'one question for the whole word')
    assert.equal(lastQuery(s).search, 'sunrise')
    assert.equal(lastQuery(s).page, 1)
  })

  it('sorts by a column, flips the direction on a second press, and says which column is sorted', async () => {
    const s = await open()
    assert.equal(lastQuery(s).sort, 'name')
    assert.equal(lastQuery(s).dir, 'asc')
    const head = (label: string) => s.k.all('thead th button').find((b) => b.textContent === label)
    await s.press(head('Company'))
    assert.equal(lastQuery(s).dir, 'desc')
    assert.equal(head('Company')!.closest('th')!.getAttribute('aria-sort'), 'descending')
    await s.press(head('Signals'))
    assert.equal(lastQuery(s).sort, 'signals')
    assert.equal(lastQuery(s).dir, 'asc')
    assert.equal(head('Signals')!.closest('th')!.getAttribute('aria-sort'), 'ascending')
    await s.press(head('Last contacted'))
    assert.equal(lastQuery(s).sort, 'last_contacted')
  })

  it('pages through the list 20 at a time and reads the page the server named', async () => {
    const s = await open({ overrides: { companies: async (query) => listOf(companies(), { meta: { page: query.page ?? 1, per_page: 20, total: 45, last_page: 3 } }) } })
    says(s.k.bodyText(), '45 companies')
    says(s.k.bodyText(), 'Page 1 of 3')
    assert.equal(s.button('Previous')!.disabled, true)
    await s.press(s.button('Next'))
    assert.equal(lastQuery(s).page, 2)
    says(s.k.bodyText(), 'Page 2 of 3')
    await s.press(s.button('Next'))
    assert.equal(s.button('Next')!.disabled, true)
  })
})

describe('Companies: empty and failing lists', () => {
  afterEach(cleanup)

  it('tells a person with no companies what to do next, with a link to Market Signals', async () => {
    const s = await open({ overrides: { companies: async () => listOf([], { summary: summary({ all: 0, reachable: 0, needs_details: 0, found: 0, manual: 0 }) }) } })
    says(s.k.bodyText(), 'No companies yet. Generate signals in Market Signals, or add one by hand.')
    assert.equal(s.k.one('tbody a[href="/signals"]')!.textContent, 'Market Signals')
  })

  it('says why in words when the server refuses, and reads the list again on Try again', async () => {
    let refuse = true
    const s = await open({ overrides: { companies: async () => { if (refuse) throw new ApiError('Forbidden', 403); return listOf(companies()) } } })
    const alert = s.k.one('[role="alert"]')!
    says(alert.textContent, 'You are not allowed to do this. Ask an administrator if you need access.')
    assert.ok(!/403/.test(alert.textContent ?? ''), 'no status code on screen')
    refuse = false
    await s.press(s.button('Try again'))
    assert.ok(s.rowOf('Riverdale Public School'), 'the rows are back')
    absent(s.k.one('[role="alert"]'), 'it is not there')
  })
})

describe('Companies: opening a row', () => {
  afterEach(cleanup)

  it('opens the company\'s page when its row, or its name, is pressed', async () => {
    const s = await open()
    await s.press(s.rowOf('Sunrise Academy')!.querySelectorAll('td')[2])
    assert.equal(s.router.written[s.router.written.length - 1], '/signals/outreach/2')
    await s.press(s.rowOf('Greenfield Traders')!.querySelector('td button'))
    assert.equal(s.router.written[s.router.written.length - 1], '/signals/outreach/3')
  })

  it('does not open the company when its checkbox is ticked', async () => {
    const s = await open()
    await s.press(s.k.one('input[aria-label="Select Riverdale Public School"]'))
    assert.equal(s.router.written.length, 0)
  })
})

describe('Companies: adding one by hand', () => {
  afterEach(cleanup)

  it('saves what was typed, sends only the filled boxes, and offers to add people to the new company', async () => {
    const s = await open()
    await s.press(s.button('Add company'))
    const dialog = s.dialog()!
    says(dialog.textContent, 'Add a company')
    await s.type(s.field('Company name', dialog), '  Lotus International School ')
    await s.type(s.field('Website', dialog), 'lotus.example')
    await s.type(s.field('Industry', dialog), 'Education')
    await s.type(s.field('Location', dialog), 'Surat')
    await s.choose('Owner', 'Asha Rao')
    await s.press(dialog.querySelector('button[type="submit"]'), 40)

    assert.deepEqual(s.calls.addCompany, [{ name: 'Lotus International School', website: 'lotus.example', industry: 'Education', location: 'Surat', assigned_to: 5 }])
    absent(s.dialog(), 'the dialog closed')
    const notice = s.k.one('[data-notice="success"]')!
    says(notice.textContent, 'Lotus International School was added.')
    assert.equal(notice.querySelector('a')!.getAttribute('href'), '/signals/outreach/99?tab=people')
    assert.equal(s.calls.companies.length, 2, 'the list was read again')
  })

  it('refuses a company with no name or a bad email in words under the box, and saves nothing', async () => {
    const s = await open()
    await s.press(s.button('Add company'))
    const dialog = s.dialog()!
    await s.type(s.field('Email', dialog), 'not-an-email')
    await s.press(dialog.querySelector('button[type="submit"]'))
    says(dialog.textContent, 'Name the company.')
    says(dialog.textContent, 'This does not look like an email address.')
    assert.equal(s.field('Company name', dialog)!.getAttribute('aria-invalid'), 'true')
    assert.deepEqual(s.calls.addCompany, [])
  })

  it('shows the server\'s refusal under the box it names', async () => {
    const s = await open({ overrides: { addCompany: async () => { throw new ApiError('The given data was invalid.', 422, { name: ['A company with this name already exists.'] }) } } })
    await s.press(s.button('Add company'))
    const dialog = s.dialog()!
    await s.type(s.field('Company name', dialog), 'Riverdale Public School')
    await s.press(dialog.querySelector('button[type="submit"]'), 40)
    says(dialog.textContent, 'A company with this name already exists.')
    assert.ok(s.dialog(), 'the dialog stays open so the name can be changed')
  })
})

describe('Companies: the ticked rows', () => {
  afterEach(cleanup)

  const tick = (s: Awaited<ReturnType<typeof open>>, name: string) => s.press(s.k.one(`input[aria-label="Select ${name}"]`))

  it('shows the bar with Write message, Convert to lead and Assign owner, and counts the ticked companies', async () => {
    const s = await open()
    absent(s.k.one('[aria-label="Actions for the selected rows"]'), 'it is not there')
    await tick(s, 'Riverdale Public School')
    const bar = s.k.one('[aria-label="Actions for the selected rows"]')!
    says(bar.textContent, '1 company selected')
    for (const label of ['Write message', 'Convert to lead', 'Assign owner']) assert.ok(s.button(label, bar), label)
    await tick(s, 'Sunrise Academy')
    says(bar.textContent, '2 companies selected')
    await s.press(s.k.one('button[aria-label="Clear selection"]'))
    absent(s.k.one('[aria-label="Actions for the selected rows"]'), 'it is not there')
  })

  it('turns Convert to lead off, with the reason beside it, when more than one company is ticked', async () => {
    const s = await open()
    await tick(s, 'Riverdale Public School')
    assert.equal(s.button('Convert to lead')!.disabled, false)
    await tick(s, 'Sunrise Academy')
    assert.equal(s.button('Convert to lead')!.disabled, true)
    says(s.k.one('[role="note"]')!.textContent, 'Convert to lead works on one company at a time.')
  })

  it('reads each ticked company\'s people and opens the message dialog with all of them, naming who will be skipped and why', async () => {
    const s = await open({ overrides: { people: async (query) => listOf(people().filter((person) => person.company_id === query.company_id)) } })
    await tick(s, 'Riverdale Public School')
    await tick(s, 'Sunrise Academy')
    await s.press(s.button('Write message', s.k.one('[aria-label="Actions for the selected rows"]')!), 40)
    assert.deepEqual(s.calls.people.map((query) => query.company_id), [1, 2])
    const dialog = s.dialog()!
    says(dialog.querySelector('[aria-label="Will be written to"]')!.textContent, 'Meera Patel')
    says(dialog.querySelector('[aria-label="Will be skipped"]')!.textContent, 'Anita Rao: Will be skipped: no email address.')
    says(dialog.querySelector('[aria-label="Will be skipped"]')!.textContent, 'Kiran Desai: Will be skipped: They opted out.')
    assert.equal(s.calls.writeMessages.length, 0, 'opening the dialog saved nothing')
  })

  it('says so, and opens nothing, when the ticked companies have no people', async () => {
    const s = await open({ overrides: { people: async () => listOf([]) } })
    await tick(s, 'Sunrise Academy')
    await s.press(s.button('Write message', s.k.one('[aria-label="Actions for the selected rows"]')!), 40)
    absent(s.dialog(), 'it is not there')
    says(s.k.one('[role="alert"]')!.textContent, 'This company has no people yet.')
  })

  it('asks before converting, then makes the lead for the best contact and links to it', async () => {
    const s = await open()
    await tick(s, 'Riverdale Public School')
    await s.press(s.button('Convert to lead', s.k.one('[aria-label="Actions for the selected rows"]')!))
    says(s.confirmDialog()!.textContent, 'Make a lead from Riverdale Public School?')
    assert.equal(s.calls.convertToLead.length, 0, 'nothing is made before the answer')
    await s.press(s.button('Convert to lead', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.convertToLead, [{ id: 1, body: { person_id: 11 } }])
    const notice = s.k.one('[data-notice="success"]')!
    says(notice.textContent, 'A lead was created from Riverdale Public School.')
    assert.equal(notice.querySelector('a')!.getAttribute('href'), '/module/crm/marketing/leads/4001')
  })

  it('makes no lead when the question is answered No', async () => {
    const s = await open()
    await tick(s, 'Riverdale Public School')
    await s.press(s.button('Convert to lead', s.k.one('[aria-label="Actions for the selected rows"]')!))
    await s.press(s.button('Cancel', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.convertToLead, [])
    assert.ok(s.k.one('[aria-label="Actions for the selected rows"]'), 'the rows stay ticked')
  })

  it('says it was already a lead when the server returns the lead it had', async () => {
    const s = await open({ overrides: { convertToLead: async () => ({ status: 1, data: { lead_id: 4001, created: false } }) } })
    await tick(s, 'Riverdale Public School')
    await s.press(s.button('Convert to lead', s.k.one('[aria-label="Actions for the selected rows"]')!))
    await s.press(s.button('Convert to lead', s.confirmDialog()!), 40)
    says(s.k.one('[data-notice="success"]')!.textContent, 'Riverdale Public School already has a lead, so no second one was made.')
  })

  it('assigns the chosen owner to every ticked company and reads the list again', async () => {
    const s = await open()
    await tick(s, 'Riverdale Public School')
    await tick(s, 'Greenfield Traders')
    await s.settle(20)
    await s.choose('Owner to assign', 'Vikram Nair')
    await s.press(s.button('Assign owner'), 40)
    assert.deepEqual(s.calls.assign, [{ company_ids: [1, 3], assigned_to: 6 }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'The owner was changed for 2 companies.')
    assert.equal(s.calls.companies.length, 2)
    absent(s.k.one('[aria-label="Actions for the selected rows"]'), 'the selection was cleared')
  })
})
