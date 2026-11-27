import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  COMPANY_TABS, INITIAL_OUTREACH_STATE, MESSAGE_BODY_MIN, OUTREACH_CHIPS, OUTREACH_PAGE_SIZE, OUTREACH_VIEWS, REACH_LABEL, REACH_TONE, chipCount, companyFormErrors, draftSummary,
  fillTokens, isEmail, isPhone, isReachable, messageFormErrors, outreachCompanyHref, outreachHref, outreachQuery, personFormErrors, personInitials, personLabel,
  titleLine, toMessageSection, toOutreachView, whyNotReachable, withChange,
} from './outreach-model'
import { person, summary } from './outreach-fixtures'
import { outreachQueryParams } from '../../services/signals/outreach'

/** The words and rules of the Outreach tab, with no browser. */

describe('the three views and where the retired addresses lead', () => {
  it('has Companies, All people and Messages, in that order, and the company page has exactly Details and People', () => {
    assert.deepEqual(OUTREACH_VIEWS.map((view) => view.label), ['Companies', 'All people', 'Messages'])
    assert.deepEqual(COMPANY_TABS.map((tab) => tab.label), ['Details', 'People'])
  })

  it('reads an unknown word in the address as the first view or section', () => {
    assert.equal(toOutreachView('nonsense'), 'companies')
    assert.equal(toOutreachView(null), 'companies')
    assert.equal(toOutreachView('people'), 'people')
    assert.equal(toMessageSection('nonsense'), 'queue')
    assert.equal(toMessageSection('sms'), 'sms')
  })

  it('writes the plain address for the first view and names the view and section for the others', () => {
    assert.equal(outreachHref(), '/signals/outreach')
    assert.equal(outreachHref('companies'), '/signals/outreach')
    assert.equal(outreachHref('people'), '/signals/outreach?view=people')
    assert.equal(outreachHref('messages'), '/signals/outreach?view=messages')
    assert.equal(outreachHref('messages', 'sms'), '/signals/outreach?view=messages&section=sms')
    assert.equal(outreachHref('people', 'sms'), '/signals/outreach?view=people', 'a section only means something inside Messages')
    assert.equal(outreachCompanyHref(12), '/signals/outreach/12')
    assert.equal(outreachCompanyHref(12, 'people'), '/signals/outreach/12?tab=people')
  })
})

describe('reach: what can be done with a row', () => {
  it('has a plain label and a tone for every reach, and only three of them can be written to', () => {
    for (const reach of ['ready', 'email_only', 'phone_only', 'needs_details', 'blocked'] as const) {
      assert.ok(REACH_LABEL[reach].length > 0, reach)
      assert.ok(REACH_TONE[reach], reach)
    }
    assert.deepEqual((['ready', 'email_only', 'phone_only', 'needs_details', 'blocked'] as const).filter(isReachable), ['ready', 'email_only', 'phone_only'])
    assert.equal(REACH_TONE.blocked, 'danger')
    assert.equal(REACH_TONE.needs_details, 'warning')
  })

  it('says in words why a blocked person cannot be written to, and says nothing for anyone else', () => {
    assert.equal(whyNotReachable(person({ reach: 'ready' })), null)
    assert.equal(whyNotReachable(person({ reach: 'blocked', consent_status: 'opted_out' })), 'They opted out.')
    assert.equal(whyNotReachable(person({ reach: 'blocked', consent_status: 'suppressed', suppressed_reason: 'bounced' })), 'Suppressed: bounced.')
    assert.equal(whyNotReachable(person({ reach: 'blocked', consent_status: 'unknown', email_opt_out: true, do_not_call: true })), 'They asked for no email and no calls.')
    assert.equal(whyNotReachable(person({ reach: 'blocked', email_opt_out: true })), 'They asked for no email.')
    assert.equal(whyNotReachable(person({ reach: 'blocked', do_not_call: true })), 'They asked for no calls.')
  })
})

describe('the chips and the query each one means', () => {
  it('offers All, Ready to contact, Needs details, Found from signals, Added by hand, Mine and Do not contact', () => {
    assert.deepEqual(OUTREACH_CHIPS.map((chip) => chip.label), ['All', 'Ready to contact', 'Needs details', 'Found from signals', 'Added by hand', 'Mine', 'Do not contact'])
  })

  it('asks for exactly the chip\'s own filter, so the chips are exclusive', () => {
    const q = (chip: (typeof OUTREACH_CHIPS)[number]['id']) => outreachQuery({ ...INITIAL_OUTREACH_STATE, chip })
    assert.deepEqual(q('all'), { page: 1, per_page: OUTREACH_PAGE_SIZE, sort: 'name', dir: 'asc' })
    assert.equal(q('reachable').reach, 'reachable')
    assert.equal(q('needs_details').reach, 'needs_details')
    assert.equal(q('blocked').reach, 'blocked')
    assert.equal(q('found').source, 'found')
    assert.equal(q('manual').source, 'manual')
    assert.equal(q('mine').mine, true)
    for (const chip of ['reachable', 'found', 'mine'] as const) {
      const query = q(chip)
      assert.equal([query.reach, query.source, query.mine].filter((value) => value !== undefined).length, 1, chip)
    }
  })

  it('sends a trimmed search, the sort and the direction, and a company id when asked', () => {
    const query = outreachQuery({ ...INITIAL_OUTREACH_STATE, search: '  riverdale ', sortKey: 'signals', sortAsc: false, page: 3 }, { company_id: 7 })
    assert.equal(query.search, 'riverdale')
    assert.equal(query.sort, 'signals')
    assert.equal(query.dir, 'desc')
    assert.equal(query.page, 3)
    assert.equal(query.company_id, 7)
  })

  it('goes back to page one for a new filter, search or sort, but not for a page change alone', () => {
    const third = { ...INITIAL_OUTREACH_STATE, page: 3 }
    assert.equal(withChange(third, { chip: 'mine' }).page, 1)
    assert.equal(withChange(third, { search: 'x' }).page, 1)
    assert.equal(withChange(third, { sortKey: 'people', sortAsc: false }).page, 1)
    assert.equal(withChange(third, { page: 4 }).page, 4)
  })

  it('prints the number from the summary on every chip, and nothing before the summary is here', () => {
    const s = summary({ all: 9, reachable: 5, needs_details: 3, blocked: 1, found: 6, manual: 3, mine: 2 })
    assert.deepEqual(OUTREACH_CHIPS.map((chip) => chipCount(chip.id, s)), [9, 5, 3, 6, 3, 2, 1])
    assert.equal(chipCount('all', null), null)
  })

  it('leaves out of the request everything that means "no filter": empty, false and all', () => {
    assert.deepEqual(outreachQueryParams({ search: '', reach: 'all', source: 'all', mine: false, page: 1 }), { page: '1' })
    assert.deepEqual(outreachQueryParams({ reach: 'reachable', mine: true, company_id: 4 }), { reach: 'reachable', mine: '1', company_id: '4' })
  })
})

describe('the words of a row', () => {
  it('names a person, or the organisation\'s own line when no person is named', () => {
    assert.equal(personLabel(person({ full_name: ' Meera Patel ' })), 'Meera Patel')
    assert.equal(personLabel(person({ full_name: null, company_name: 'Riverdale' })), 'Riverdale (company line)')
    assert.equal(personInitials(person({ full_name: 'Meera Patel' })), 'MP')
    assert.equal(personInitials(person({ full_name: 'Meera' })), 'M')
    assert.equal(personInitials(person({ full_name: null })), '?')
  })

  it('joins the title and department, else falls back to the role', () => {
    assert.equal(titleLine(person({ designation: 'Director', department: 'Finance', contact_role: 'Decision maker' })), 'Director · Finance')
    assert.equal(titleLine(person({ designation: null, department: null, contact_role: 'Decision maker' })), 'Decision maker')
    assert.equal(titleLine(person({ designation: null, department: null, contact_role: null })), null)
  })
})

describe('forms are checked before anything is sent', () => {
  it('asks a company for a name and checks an email and phone only when given', () => {
    assert.deepEqual(companyFormErrors({ name: 'Acme' }), {})
    assert.equal(companyFormErrors({ name: '  ' }).name, 'Name the company.')
    assert.ok(companyFormErrors({ name: 'Acme', email: 'nope' }).email)
    assert.ok(companyFormErrors({ name: 'Acme', phone: '12' }).phone)
    assert.deepEqual(companyFormErrors({ name: 'Acme', email: '', phone: '' }), {})
  })

  it('asks a person for a company and at least one way to find them', () => {
    assert.equal(personFormErrors({ company_id: 0, full_name: 'A' }).company_id, 'Choose the company.')
    assert.ok(personFormErrors({ company_id: 1 }).full_name)
    assert.deepEqual(personFormErrors({ company_id: 1, email: 'a@b.co' }), {})
    assert.deepEqual(personFormErrors({ company_id: 1, linkedin_url: 'https://linkedin.com/in/x' }), {})
    assert.ok(personFormErrors({ company_id: 1, full_name: 'A', email: 'bad' }).email)
    assert.ok(personFormErrors({ company_id: 1, full_name: 'A', mobile: 'abc' }).mobile)
  })

  it('recognises an email and a phone number the way the server\'s own first check does', () => {
    assert.equal(isEmail('principal@riverdale.example'), true)
    assert.equal(isEmail('principal@riverdale'), false)
    assert.equal(isEmail('a b@c.co'), false)
    assert.equal(isPhone('+91 98765 43210'), true)
    assert.equal(isPhone('98765-43210'), true)
    assert.equal(isPhone('12345'), false)
    assert.equal(isPhone('1234567890123456'), false)
  })

  it('asks a message for someone to write to, a subject and a body of at least 20 characters', () => {
    assert.deepEqual(messageFormErrors({ subject: 'Hello', body: 'x'.repeat(MESSAGE_BODY_MIN), recipients: 1 }), {})
    assert.ok(messageFormErrors({ subject: 'Hello', body: 'x'.repeat(MESSAGE_BODY_MIN), recipients: 0 }).recipients)
    assert.ok(messageFormErrors({ subject: ' ', body: 'x'.repeat(MESSAGE_BODY_MIN), recipients: 1 }).subject)
    assert.ok(messageFormErrors({ subject: 'Hello', body: 'too short', recipients: 1 }).body)
    assert.ok(messageFormErrors({ subject: 'x'.repeat(256), body: 'x'.repeat(MESSAGE_BODY_MIN), recipients: 1 }).subject)
  })

  it('fills the first name and company into a message for one person, as the server does', () => {
    const p = person({ full_name: 'Meera Patel', company_name: 'Riverdale' })
    assert.equal(fillTokens('Hello {{first_name}} at {{ company }}.', p), 'Hello Meera at Riverdale.')
    assert.equal(fillTokens('Hello {{first_name}}', person({ full_name: null })), 'Hello there')
  })

  it('sums up a write-to-several-people result in words', () => {
    assert.equal(draftSummary(2, 0), '2 drafts saved.')
    assert.equal(draftSummary(1, 0), '1 draft saved.')
    assert.equal(draftSummary(2, 1), '2 drafts saved, 1 could not be written.')
    assert.equal(draftSummary(0, 2), '2 could not be written.')
    assert.equal(draftSummary(0, 0), 'Nothing was written.')
  })
})
