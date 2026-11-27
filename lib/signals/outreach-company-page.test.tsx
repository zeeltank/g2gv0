import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import type { OutreachCompanyDetail } from '../../services/signals/outreach-types'
import { companyDetail, people, person } from './outreach-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * One company of the Outreach tab as a person meets it: the real page with its two tabs, the real person panel and dialogs inside it, the address kept by a stand-in router, the Outreach API
 * as a fake that records every call. Every test ends on words that are on the screen or on a recorded call.
 */

const manualDetail = (over: Partial<OutreachCompanyDetail> = {}) => companyDetail({
  id: 3, name: 'Greenfield Traders', source: 'manual', industry: 'Retail', location: 'Surat', state: null, signals: [], signals_count: 0, latest_signal: null, reach: 'email_only',
  people: [person({ id: 12, company_id: 3, company_name: 'Greenfield Traders', full_name: 'Ravi Shah', source: 'manual', reach: 'email_only', phone: null })], people_count: 1, ...over,
})

async function open(options: { search?: string; detail?: OutreachCompanyDetail; overrides?: NonNullable<Parameters<typeof outreachKit>[0]>['overrides'] } = {}) {
  const detail = options.detail ?? companyDetail()
  const s = await outreachKit({ search: options.search, pathname: `/signals/outreach/${detail.id}`, overrides: { company: async () => ({ status: 1, data: detail }), ...options.overrides } })
  const { OutreachCompanyPage } = await import('../../components/domain/signals/outreach/outreach-company-page')
  await s.mount(s.k.h(OutreachCompanyPage, { id: detail.id, service: s.service, messageDeps: s.messageDeps }))
  const tabs = () => s.k.all('[role="tablist"][aria-label="Company sections"] [role="tab"]')
  const tab = (label: string) => tabs().find((t) => t.textContent === label)
  const value = (label: string) => Array.from(s.k.all('dt')).find((dt) => dt.textContent === label)?.parentElement?.textContent ?? ''
  const actions = () => s.k.one('[role="group"][aria-label="Actions"]')!
  return { ...s, tabs, tab, value, actions }
}

describe('Company page: the two tabs', () => {
  afterEach(cleanup)

  it('has exactly two tabs, Details and People, and opens on Details', async () => {
    const s = await open()
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Details', 'People'])
    assert.deepEqual(s.tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent), ['Details'])
    assert.equal(s.k.one('[role="tablist"][aria-label="Company sections"]')!.getAttribute('aria-label'), 'Company sections')
  })

  it('writes the chosen tab into the address and builds only the open tab', async () => {
    const s = await open()
    assert.ok(s.k.one('[data-signal]'), 'Details is built')
    absent(s.k.one('[data-person-rail]'), 'People is not built yet')
    await s.press(s.tab('People'), 40)
    assert.match(s.router.lastSearch(), /(^|&)tab=people(&|$)/)
    assert.ok(s.k.one('[data-person-rail]'), 'People is built')
    absent(s.k.one('[data-signal]'), 'Details is no longer on the page')
    await s.press(s.tab('Details'), 40)
    assert.equal(s.router.lastSearch(), '', 'the first tab keeps the plain address')
  })

  it('opens People, and the person, a link names', async () => {
    const s = await open({ search: 'tab=people&person=11' })
    assert.deepEqual(s.tabs().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent), ['People'])
    assert.equal(s.k.one('[data-person-panel]')!.getAttribute('data-person-panel'), '11')
  })

  it('has no accessibility violation a fake page can see', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.one('[role="tablist"]')!.parentElement!), [])
  })
})

describe('Company page: Details', () => {
  afterEach(cleanup)

  it('names the company with where it came from and what can be done with it', async () => {
    const s = await open()
    const heading = s.k.one('h2')!
    says(heading.textContent, 'Riverdale Public School')
    says(heading.textContent, 'Found from signals')
    says(heading.textContent, 'Email and phone')
    says(heading.parentElement!.textContent, 'Education · Ahmedabad, Gujarat')
    for (const label of ['Write message', 'Find contacts', 'Convert to lead']) assert.ok(s.button(label, s.actions()), label)
    absent(s.button('Edit', s.actions()), 'a company the signals found cannot be edited')
  })

  it('shows the company\'s facts, and says a found company cannot be edited here', async () => {
    const s = await open()
    assert.equal(s.value('Industry'), 'IndustryEducation')
    assert.equal(s.value('Type'), 'TypeSchool')
    assert.equal(s.value('Location'), 'LocationAhmedabad, Gujarat')
    assert.equal(s.value('Owner'), 'OwnerNot assigned')
    const link = s.k.one('dd a[href="https://riverdale.example"]')!
    assert.equal(link.getAttribute('target'), '_blank')
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer')
    says(s.k.one('[data-readonly-note]')!.textContent, 'cannot be edited here')
  })

  it('lists the signals that found the company with their product, status, date and a link to Market Signals', async () => {
    const s = await open()
    const signals = s.k.all('[data-signal]')
    assert.equal(signals.length, 2)
    says(signals[0].textContent, 'School announces new campus')
    says(signals[0].textContent, 'School ERP · New · 20 Nov 2026')
    says(signals[1].textContent, 'Board hires a new administrator')
    says(signals[1].textContent, 'Reviewed')
    assert.equal(signals[0].querySelector('a')!.getAttribute('href'), '/signals')
  })

  it('says in plain words where the company stands: the search, who can be reached, when it was last written to, and that it is not a lead yet', async () => {
    const s = await open()
    assert.equal(s.k.one('[data-research]')!.getAttribute('data-research'), 'found')
    says(s.k.one('[data-research]')!.textContent, 'Contacts were found on public web pages. They are not verified')
    says(s.k.one('[data-research]')!.textContent, 'Last searched 21 Nov 2026.')
    assert.equal(s.value('People'), 'People1 person, 1 can be reached now')
    assert.equal(s.value('Last contacted'), 'Last contactedNot yet')
    assert.equal(s.value('Lead'), 'LeadNot a lead yet')
  })

  it('says each state of the contact search in words, never as a code', async () => {
    const wanted: Array<[OutreachCompanyDetail['research']['state'], string]> = [
      ['none_found', 'A public search found no contact details for this company.'],
      ['not_searched', 'No public search has been run for this company yet. Use Find contacts.'],
      ['not_set_up', 'Contact search is not switched on for this organisation yet.'],
    ]
    for (const [state, words] of wanted) {
      const s = await open({ detail: companyDetail({ research: { state, searched_at: null, can_search: state !== 'not_set_up' } }) })
      says(s.k.one('[data-research]')!.textContent, words)
      assert.ok(!/none_found|not_searched|not_set_up/.test(s.k.bodyText()), `${state} is not shown as a code`)
      await cleanup()
    }
  })

  it('links the lead a company became, and offers Open lead in place of Convert to lead', async () => {
    const s = await open({ detail: companyDetail({ lead_id: 4007 }) })
    assert.equal(s.k.one('dd a[href="/module/crm/marketing/leads/4007"]')!.textContent, 'This company became a lead. Open it.')
    assert.equal(s.actions().querySelector('a[href="/module/crm/marketing/leads/4007"]')!.textContent, 'Open lead')
    absent(s.button('Convert to lead', s.actions()), 'a company that is a lead is not converted again')
  })

  it('says a company added by hand was added by hand, offers Edit, and sends only what was changed', async () => {
    const s = await open({ detail: manualDetail() })
    says(s.k.one('h2')!.textContent, 'Added by hand')
    says(s.k.bodyText(), 'You added this company by hand, so no signal brought it here.')
    absent(s.k.one('[data-readonly-note]'), 'a company added by hand can be edited')
    await s.press(s.button('Edit', s.actions()))
    const dialog = s.dialog()!
    says(dialog.textContent, 'Edit company')
    assert.equal(s.button('Save changes', dialog)!.disabled, true, 'nothing changed yet')
    await s.type(s.field('Industry', dialog), 'Wholesale')
    await s.press(s.button('Save changes', dialog), 40)
    assert.deepEqual(s.calls.updateCompany, [{ id: 3, body: { industry: 'Wholesale' } }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'The details were saved.')
    assert.equal(s.calls.company.length, 2, 'the company was read again')
  })
})

describe('Company page: the actions', () => {
  afterEach(cleanup)

  it('starts the contact search and says what the server said, then offers Check for results, which reads the company again', async () => {
    const s = await open()
    absent(s.button('Check for results'), 'it is not there')
    await s.press(s.button('Find contacts', s.actions()), 40)
    assert.deepEqual(s.calls.findContacts, [1])
    says(s.k.one('[data-notice="success"]')!.textContent, 'Looking for contacts. Check back in a minute.')
    await s.press(s.button('Check for results'), 40)
    assert.equal(s.calls.company.length, 2)
  })

  it('turns Find contacts off, and says why, when the search is not switched on', async () => {
    const s = await open({ detail: companyDetail({ research: { state: 'not_set_up', searched_at: null, can_search: false } }) })
    const find = s.button('Find contacts', s.actions())!
    assert.equal(find.disabled, true)
    assert.equal(find.getAttribute('title'), 'Contact search is not switched on for this organisation.')
    assert.deepEqual(s.calls.findContacts, [])
  })

  it('asks before making a lead, then makes it for the best contact and links to it', async () => {
    let converted = false
    const s = await open({
      overrides: {
        company: async () => ({ status: 1, data: companyDetail({ lead_id: converted ? 4001 : null }) }),
        convertToLead: async () => { converted = true; return { status: 1, data: { lead_id: 4001, created: true } } },
      },
    })
    await s.press(s.button('Convert to lead', s.actions()))
    says(s.confirmDialog()!.textContent, 'Make a lead from Riverdale Public School?')
    says(s.confirmDialog()!.textContent, 'for Meera Patel')
    assert.deepEqual(s.calls.convertToLead, [])
    await s.press(s.button('Convert to lead', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.convertToLead, [{ id: 1, body: { person_id: 11 } }])
    says(s.k.one('[data-notice="success"]')!.textContent, 'A lead was created from Riverdale Public School.')
    assert.equal(s.k.one('[data-notice="success"] a')!.getAttribute('href'), '/module/crm/marketing/leads/4001')
    assert.ok(s.actions().querySelector('a[href="/module/crm/marketing/leads/4001"]'), 'Open lead replaced Convert to lead')
  })

  it('opens the message dialog with the company\'s people, and saves nothing until Save draft', async () => {
    const s = await open({ detail: companyDetail({ people: people().filter((p) => p.company_id === 1) }) })
    await s.press(s.button('Write message', s.actions()), 40)
    const written = s.dialog()!.querySelector('[aria-label="Will be written to"]')!
    says(written.textContent, 'Meera Patel')
    says(written.textContent, 'Riverdale Public School (company line)')
    assert.deepEqual(s.calls.writeMessages, [])
  })

  it('changes the owner of the company from the menu', async () => {
    const s = await open()
    await s.openMenu()
    await s.press(s.menuItem('Change owner'), 40)
    await s.choose('New owner', 'Vikram Nair')
    await s.press(s.button('Change owner', s.dialog()!), 40)
    assert.deepEqual(s.calls.assign, [{ company_ids: [1], assigned_to: 6 }])
  })

  it('offers Delete only for a company added by hand, asks first, and goes back to the list', async () => {
    const found = await open()
    await found.openMenu()
    absent(found.menuItem('Delete company'), 'a found company stays')
    await cleanup()
    const s = await open({ detail: manualDetail() })
    await s.openMenu()
    await s.press(s.menuItem('Delete company'), 40)
    says(s.confirmDialog()!.textContent, 'Delete Greenfield Traders?')
    assert.deepEqual(s.calls.deleteCompany, [])
    await s.press(s.button('Delete company', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.deleteCompany, [3])
    assert.equal(s.router.written[s.router.written.length - 1], '/signals/outreach')
  })

  it('goes back to the Outreach list from the Back button', async () => {
    const s = await open()
    await s.press(s.k.one('button[aria-label="Back to Outreach"]'))
    assert.equal(s.router.written[s.router.written.length - 1], '/signals/outreach')
  })
})

describe('Company page: People', () => {
  afterEach(cleanup)

  const twoPeople = () => companyDetail({ people: people().filter((p) => p.company_id === 1), people_count: 2 })

  it('lists the people with their reach, opens the first, and opens another when it is pressed', async () => {
    const s = await open({ detail: twoPeople() })
    await s.press(s.tab('People'), 40)
    const rail = s.k.one('[data-person-rail]')!
    const buttons = Array.from(rail.querySelectorAll('button'))
    assert.equal(buttons.length, 2)
    says(buttons[0].textContent, 'Meera Patel')
    says(buttons[0].textContent, 'Email and phone')
    says(buttons[0].textContent, 'Not verified')
    assert.equal(s.k.one('[data-person-panel]')!.getAttribute('data-person-panel'), '11')
    await s.press(buttons[1])
    assert.equal(s.k.one('[data-person-panel]')!.getAttribute('data-person-panel'), '13')
    assert.equal(buttons[1].getAttribute('aria-current'), 'true')
  })

  it('searches the people the page holds and narrows them with the chips, with their counts', async () => {
    const s = await open({ detail: twoPeople() })
    await s.press(s.tab('People'), 40)
    assert.equal(s.chip('All')!.getAttribute('aria-label'), 'All 2')
    assert.equal(s.chip('Ready to contact')!.getAttribute('aria-label'), 'Ready to contact 2')
    assert.equal(s.k.all('[role="group"][aria-label="Show"] button').length, 4, 'only the chips that count something here')
    await s.type(s.k.one('input[aria-label="Search people"]'), 'info@')
    assert.equal(s.k.all('[data-person-rail] button').length, 1)
    says(s.k.one('[data-person-rail]')!.textContent, 'Riverdale Public School (company line)')
    await s.type(s.k.one('input[aria-label="Search people"]'), 'nobody')
    says(s.k.bodyText(), 'No person matches.')
  })

  it('says what to do next for a company with no people, and Find contacts there asks the server', async () => {
    const s = await open({ detail: companyDetail({ people: [], people_count: 0, reachable_people_count: 0, best_contact: null, reach: 'needs_details' }) })
    await s.press(s.tab('People'), 40)
    says(s.k.bodyText(), 'No contact found for this company. Find contacts, or add one by hand.')
    const panelButtons = s.k.one('[role="tabpanel"]:not([hidden])')!
    assert.ok(s.button('Add person', panelButtons))
    await s.press(s.button('Find contacts', panelButtons), 40)
    assert.deepEqual(s.calls.findContacts, [1])
  })

  it('adds a person to this company without asking which company, sends the form values with the company, and opens the new person', async () => {
    const s = await open({ detail: companyDetail({ people: [], people_count: 0 }) })
    await s.press(s.tab('People'), 40)
    await s.press(s.button('Add person', s.k.one('[role="tabpanel"]:not([hidden])')!))
    const dialog = s.dialog()!
    assert.equal(dialog.querySelector('[data-person-company]')!.textContent, 'Riverdale Public School')
    absent(dialog.querySelector('[role="listbox"]'), 'no company to choose')
    await s.type(s.field('Name', dialog), 'Hetal Mehta')
    await s.type(s.field('Job title', dialog), 'Trustee')
    await s.type(s.field('Email', dialog), 'hetal@riverdale.example')
    await s.type(s.field('Phone', dialog), '98250 11122')
    await s.press(Array.from(dialog.querySelectorAll('label')).find((l) => l.textContent?.includes('The main person'))!.querySelector('input'))
    await s.press(dialog.querySelector('button[type="submit"]'), 40)
    assert.deepEqual(s.calls.addPerson, [{ company_id: 1, full_name: 'Hetal Mehta', designation: 'Trustee', email: 'hetal@riverdale.example', phone: '98250 11122', is_primary: true }])
    assert.equal(s.calls.company.length, 2, 'the company was read again')
  })

  it('refuses a person with no way to reach them, in words under the box, and saves nothing', async () => {
    const s = await open()
    await s.press(s.tab('People'), 40)
    await s.press(s.button('Add person', s.k.one('[role="tabpanel"]:not([hidden])')!))
    const dialog = s.dialog()!
    await s.press(dialog.querySelector('button[type="submit"]'))
    says(dialog.textContent, 'Give a name, an email or a phone number.')
    await s.type(s.field('Email', dialog), 'nope')
    says(dialog.textContent, 'This does not look like an email address.')
    await s.press(dialog.querySelector('button[type="submit"]'))
    assert.equal(s.field('Email', dialog)!.getAttribute('aria-invalid'), 'true')
    assert.deepEqual(s.calls.addPerson, [])
  })

  it('shows a company\'s own person in the panel without repeating the company, and with the person\'s own actions', async () => {
    const s = await open({ detail: manualDetail(), search: 'tab=people' })
    const panel = s.k.one('[data-person-panel]')!
    says(panel.querySelector('h2')!.textContent, 'Ravi Shah')
    absent(panel.querySelector('[data-person-company]'), 'the company is the page')
    for (const label of ['Write message', 'Edit', 'What they agreed to', 'Convert to lead']) assert.ok(s.button(label, panel), label)
  })
})

describe('Company page: when it cannot be read', () => {
  afterEach(cleanup)

  it('says a missing company was not found, with a way back and no retry', async () => {
    const s = await open({ overrides: { company: async () => { throw new ApiError('Not found', 404) } } })
    says(s.k.one('[role="alert"]')!.textContent, 'This company was not found. It may have been removed.')
    assert.ok(s.button('Back to Outreach'))
    absent(s.button('Try again'), 'a missing company is not retried')
    absent(s.k.one('[role="tablist"][aria-label="Company sections"]'), 'no tabs for a company that is not there')
  })

  it('says why in words when the server refuses, and reads the company again on Try again', async () => {
    let refuse = true
    const s = await open({ overrides: { company: async () => { if (refuse) throw new ApiError('Forbidden', 403); return { status: 1, data: companyDetail() } } } })
    says(s.k.one('[role="alert"]')!.textContent, 'You are not allowed to do this.')
    refuse = false
    await s.press(s.button('Try again'), 40)
    assert.deepEqual(s.tabs().map((t) => t.textContent), ['Details', 'People'])
  })
})
