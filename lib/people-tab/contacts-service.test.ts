import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { LaravelContext } from '../../lib/laravel-context'
import { companyActivityService, contactWriteBody, contactsService, withContactExtras } from '../../services/crm/contacts'
import { person } from './kit'

/** The people calls at the network layer: what is asked, where, and how it is read back. fetch is replaced; nothing leaves the process. */

interface Call { url: URL; method: string; body: Record<string, unknown> | undefined }

const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

function fakeFetch(reply: unknown = { status: 1, message: 'ok', data: [] }) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: { method?: string; body?: string }) => {
    calls.push({ url: new URL(String(input), 'http://test.local'), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined })
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}

const ctx: LaravelContext = { token: 't0k', subInstituteId: '1', syear: '2026', userId: '2', organizationId: '1', orgType: '', profileId: '16' }

describe('the people list', () => {
  it('sends the filters under the contract names, and only the ones that are on', async () => {
    const calls = fakeFetch({ status: 1, message: 'ok', data: { items: [], pagination: { total: 0 } } })
    await contactsService.list(ctx, { organizationId: '135', perPage: 100, search: 'meera', primary: true, owner: '2', consent: 'opted_in', doNotCall: true, noCompany: true, sortBy: 'is_primary', sortDir: 'desc' })
    await contactsService.list(ctx, { organizationId: '135' })
    const first = calls[0].url
    assert.equal(first.pathname.endsWith('/crm/contacts'), true)
    for (const [key, value] of [['organization_id', '135'], ['per_page', '100'], ['search', 'meera'], ['primary', '1'], ['owner', '2'], ['consent', 'opted_in'], ['do_not_call', '1'], ['no_company', '1'], ['sort_by', 'is_primary'], ['sort_dir', 'desc']]) {
      assert.equal(first.searchParams.get(key), value, key)
    }
    const plain = calls[1].url.searchParams
    for (const key of ['primary', 'owner', 'consent', 'do_not_call', 'no_company', 'search']) assert.equal(plain.has(key), false, `${key} is not sent when it is off`)
  })

  it('reads the postal code under either of its names, and writes it under both', () => {
    assert.equal(withContactExtras({ ...person(), mailingCode: null, mailingPostalCode: '380009' }).mailingCode, '380009')
    assert.equal(withContactExtras({ ...person(), mailingCode: '380001', mailingPostalCode: '380009' }).mailingCode, '380001', 'the older name wins when both are there')
    const body = contactWriteBody({ mailingCode: '380009', otherCode: '395007', lastName: 'Patel' })
    assert.equal(body.mailingPostalCode, '380009')
    assert.equal(body.otherPostalCode, '395007')
    assert.equal(contactWriteBody({ lastName: 'Patel' }).mailingPostalCode, undefined, 'a field that was not given is not invented')
  })
})

describe('Primary', () => {
  it('sets it with a POST and clears it with a DELETE, both on /crm/contacts/{id}/primary', async () => {
    const calls = fakeFetch({ status: 1, message: 'ok', data: person({ isPrimary: true }) })
    await contactsService.setPrimary(ctx, '31')
    await contactsService.clearPrimary(ctx, '31')
    assert.deepEqual(calls.map((c) => [c.method, c.url.pathname.replace(/^.*\/crm/, '/crm')]), [['POST', '/crm/contacts/31/primary'], ['DELETE', '/crm/contacts/31/primary']])
    assert.equal(calls[0].body?.token, 't0k')
    assert.equal(calls[1].url.searchParams.get('sub_institute_id'), '1')
  })

  it('never sends isPrimary with the person: it has its own call', async () => {
    const calls = fakeFetch({ status: 1, message: 'ok', data: person() })
    await contactsService.update(ctx, '31', { lastName: 'Patel', mailingCode: '380009' })
    assert.equal(calls[0].method, 'PUT')
    assert.equal('isPrimary' in (calls[0].body ?? {}), false)
    assert.equal(calls[0].body?.mailingPostalCode, '380009')
  })
})

describe('the person\'s own calls', () => {
  it('asks for the deals at /crm/contacts/{id}/deals and the Notes, Files, Emails and History under the person', async () => {
    const calls = fakeFetch()
    await contactsService.deals(ctx, '31')
    await contactsService.comments(ctx, '31')
    await contactsService.documents(ctx, '31')
    await contactsService.emails(ctx, '31')
    await contactsService.history(ctx, '31')
    await contactsService.schedule(ctx, '31')
    assert.deepEqual(calls.map((c) => c.url.pathname.replace(/^.*?\/(?=crm\/|task-management\/)/, '/')), [
      '/crm/contacts/31/deals', '/crm/contacts/31/comments', '/crm/contacts/31/documents', '/crm/contacts/31/emails', '/crm/contacts/31/history',
      '/task-management/calendar/events/linked/CONTACT/31',
    ])
  })

  it('limits the export, the import and the duplicates to one company when it is named', async () => {
    const calls = fakeFetch({ status: 1, message: 'ok', data: [
      { key: 'a', reason: 'email', rows: [{ id: '1', organizationId: '135' }, { id: '2', organizationId: '135' }] },
      { key: 'b', reason: 'email', rows: [{ id: '3', organizationId: '135' }, { id: '4', organizationId: '200' }] },
      { key: 'c', reason: 'email', rows: [{ id: '5', organizationId: null }, { id: '6', organizationId: null }] },
    ] })
    assert.equal(new URL(contactsService.exportUrl(ctx, { organizationId: '135', search: 'x' }), 'http://test.local').searchParams.get('organization_id'), '135')
    assert.equal(new URL(contactsService.exportUrl(ctx), 'http://test.local').searchParams.has('organization_id'), false)
    const mine = await contactsService.duplicates(ctx, '135')
    assert.deepEqual(mine.data.map((g) => g.key), ['a'], 'only the group whose people are all in this company')
    assert.equal((await contactsService.duplicates(ctx)).data.length, 3)
    await contactsService.importRows(ctx, [{ lastName: 'A', organizationId: '999' }, { lastName: 'B' }], '135')
    const sent = calls.at(-1)!.body as { rows: Array<{ organizationId: string }> }
    assert.deepEqual(sent.rows.map((r) => r.organizationId), ['135', '135'], 'a file cannot name another company')
  })
})

describe('the company-wide lists', () => {
  it('send include=people for Everyone and include=company for Company only, on every list', async () => {
    const calls = fakeFetch({ status: 1, message: 'ok', data: { items: [], pagination: {}, entries: [] } })
    for (const scope of ['people', 'company'] as const) {
      await companyActivityService.comments(ctx, '135', scope)
      await companyActivityService.documents(ctx, '135', scope)
      await companyActivityService.emails(ctx, '135', scope)
      await companyActivityService.history(ctx, '135', scope)
      await companyActivityService.schedule(ctx, '135', scope)
      await companyActivityService.quotes(ctx, '135', scope)
    }
    assert.equal(calls.length, 12)
    calls.forEach((call, index) => assert.equal(call.url.searchParams.get('include'), index < 6 ? 'people' : 'company', call.url.pathname))
    assert.deepEqual(calls.slice(0, 6).map((c) => c.url.pathname.replace(/^.*?\/(?=crm\/|task-management\/)/, '/')), [
      '/crm/organizations/135/comments', '/crm/organizations/135/documents', '/crm/organizations/135/emails', '/crm/organizations/135/history',
      '/task-management/calendar/events/linked/ORGANIZATION/135', '/crm/quotes',
    ])
    assert.equal(calls[5].url.searchParams.get('organization_id'), '135')
  })
})
