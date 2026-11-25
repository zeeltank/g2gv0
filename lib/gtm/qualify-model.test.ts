import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { gtmService, type GtmContact } from '../../services/gtm/gtm'
import { accountFromSearch } from './prospecting-link'
import { chooseable, contactBlock, contactLabel, NEEDS_A_PERSON, qualifyBody, qualifyNotice, qualifyProblem, QUALIFY_SENTENCE } from './qualify-model'

const person = (id: number, over: Partial<GtmContact> = {}): GtmContact => ({
  id, account_id: 5, full_name: `Person ${id}`, title: null, email: null, phone: null, linkedin_url: null, role_in_deal: null, status: 'active', ...over,
})

describe('Qualify as lead: who can be chosen', () => {
  it('a person who asked not to be contacted, unsubscribed or bounced cannot be chosen, and the reason is a few plain words', () => {
    assert.equal(contactBlock(person(1)), null)
    assert.equal(contactBlock(person(2, { status: 'do_not_contact' })), 'asked not to be contacted')
    assert.equal(contactBlock(person(3, { status: 'unsubscribed' })), 'unsubscribed')
    assert.equal(contactBlock(person(4, { status: 'bounced' })), 'their email bounced')
  })

  it('lists the people who can be chosen first, so the list never opens on a disabled one', () => {
    const list = [person(1, { status: 'do_not_contact' }), person(2), person(3, { status: 'bounced' }), person(4)]
    assert.deepEqual(chooseable(list).map((c) => c.id), [2, 4, 1, 3])
  })

  it('labels a person with their title, and says what the dialog does', () => {
    assert.equal(contactLabel(person(1, { full_name: 'Rahul Verma', title: 'Principal' })), 'Rahul Verma · Principal')
    assert.equal(contactLabel(person(1, { full_name: 'Rahul Verma' })), 'Rahul Verma')
    assert.equal(QUALIFY_SENTENCE, 'This creates a lead for this person and marks the account Engaged.')
    assert.equal(NEEDS_A_PERSON, 'Add a person to this account first.')
  })

  it('needs a person, and refuses one who cannot be contacted before anything is sent', () => {
    const list = [person(1), person(2, { status: 'do_not_contact', full_name: 'Dee Enn' })]
    assert.equal(qualifyProblem({ contactId: '', assignedTo: '' }, list), 'Choose the person this lead is for.')
    assert.equal(qualifyProblem({ contactId: '99', assignedTo: '' }, list), 'Choose the person this lead is for.')
    assert.equal(qualifyProblem({ contactId: '2', assignedTo: '' }, list), 'Dee Enn asked not to be contacted, so a lead cannot be made for them.')
    assert.equal(qualifyProblem({ contactId: '1', assignedTo: '' }, list), null)
  })
})

describe('Qualify as lead: what is sent and what is said', () => {
  it('sends the person, and the owner only when somebody other than the caller was chosen', () => {
    assert.deepEqual(qualifyBody({ contactId: '3', assignedTo: '' }, '9'), { contactId: 3 })
    assert.deepEqual(qualifyBody({ contactId: '3', assignedTo: '9' }, '9'), { contactId: 3 }, 'the caller is the default')
    assert.deepEqual(qualifyBody({ contactId: '3', assignedTo: '12' }, '9'), { contactId: 3, assignedTo: 12 })
  })

  it('says a lead was made, or that the person already had one', () => {
    assert.equal(qualifyNotice(true, 'Rahul Verma'), 'Lead created for Rahul Verma. The account is now Engaged.')
    assert.equal(qualifyNotice(false, 'Rahul Verma'), 'Rahul Verma already has a lead, so no second one was made.')
  })

  const restore: Array<() => void> = []
  afterEach(() => { for (const fn of restore.splice(0)) fn() })

  it('posts to the qualify-as-lead path of that account with the person in the body', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const original = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify({ status: 1, data: { lead_id: '501', lead_no: 'LD-00501', created: true, stage: 'engaged' } }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    restore.push(() => { globalThis.fetch = original })

    const result = await gtmService.qualifyAsLead(41, { contactId: 3, assignedTo: 12 })

    assert.equal(result.data.lead_id, '501')
    assert.match(calls[0].url, /\/gtm\/accounts\/41\/qualify-as-lead$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { contactId: 3, assignedTo: 12 })
  })
})

describe('the link from a signal', () => {
  it('opens the account named in ?account= and nothing else', () => {
    assert.equal(accountFromSearch('?account=41'), 41)
    assert.equal(accountFromSearch('?tab=research&account=7'), 7)
    for (const bad of ['', '?account=', '?account=0', '?account=-3', '?account=4.5', '?account=abc', '?account=41;drop', '?account=00041', '?account=99999999999', '?other=41']) {
      assert.equal(accountFromSearch(bad), null, bad)
    }
  })
})
