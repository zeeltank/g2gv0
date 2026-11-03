import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { isDeletedNameConflict, OrgAccountsApiError } from '../../services/org-accounts/errors'
import { listQuery, orgAccountsService } from '../../services/org-accounts/org-accounts-service'

interface Call { url: string; init?: RequestInit }

/** Replaces fetch for one test and records what was asked of it. No request leaves the process. */
function fakeFetch(reply: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => { calls.push({ url: String(url), init }); return reply() }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return calls
}
const restore: Array<() => void> = []
afterEach(() => { for (const fn of restore.splice(0)) fn() })

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('the list query', () => {
  it('sends only what was chosen, as strings, and a 0 is a real answer', () => {
    assert.deepEqual(listQuery({ q: 'kv', lifecycle: 'target', has_crm: 0, has_gtm: 1, page: 2, per_page: 20 }), { q: 'kv', lifecycle: 'target', has_crm: '0', has_gtm: '1', page: '2', per_page: '20' })
    assert.deepEqual(listQuery({ q: '', lifecycle: undefined }), {})
  })
})

describe('reading', () => {
  it('asks for the list, meta, suggestions and one organisation at the paths the contract names', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await orgAccountsService.list({ page: 1, has_signals: 1 })
    await orgAccountsService.meta()
    await orgAccountsService.suggestions()
    await orgAccountsService.get(7)
    assert.match(calls[0].url, /\/org-accounts\?page=1&has_signals=1$/)
    assert.match(calls[1].url, /\/org-accounts\/meta$/)
    assert.match(calls[2].url, /\/org-accounts\/suggestions$/)
    assert.match(calls[3].url, /\/org-accounts\/7$/)
  })

  it('narrows the possible duplicates to one organisation only when asked to', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: [] }))
    await orgAccountsService.suggestions(12)
    await orgAccountsService.suggestions()
    assert.match(calls[0].url, /\/org-accounts\/suggestions\?identity_id=12$/)
    assert.match(calls[1].url, /\/org-accounts\/suggestions$/, 'no identity, no parameter: every pair')
  })

  it('asks for the 360 of a CRM organisation with a POST to /for-crm/{id} and an empty body, and keeps whether it was just made', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, created: true, data: { identity: { id: 3 } } }))
    const answer = await orgAccountsService.forCrm(41)
    assert.match(calls[0].url, /\/org-accounts\/for-crm\/41$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
    assert.equal(answer.created, true)
  })

  it('keeps the status of a refused for-crm (403, 404, 409 and the 503 of a server that is not set up)', async () => {
    for (const status of [403, 404, 409, 503]) {
      fakeFetch(() => json(status, { status: 0, message: `refused ${status}` }))
      await assert.rejects(orgAccountsService.forCrm(41), (error: unknown) => error instanceof ApiError && error.status === status && error.message === `refused ${status}`)
    }
  })

  it('answers a 403 with an ApiError that carries the status', async () => {
    fakeFetch(() => json(403, { status: 0, message: 'This action is unauthorized.' }))
    await assert.rejects(orgAccountsService.list({}), (error: unknown) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 403)
      return true
    })
  })
})

describe('writing', () => {
  it('posts a link decision as JSON to /links', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: null }))
    const body = { left_type: 'crm_organization', left_id: 4, right_type: 'g2g_company', right_id: 9, action: 'confirm' } as const
    await orgAccountsService.link(body)
    assert.match(calls[0].url, /\/org-accounts\/links$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), body)
    assert.equal((calls[0].init?.headers as Record<string, string>)['Content-Type'], 'application/json')
  })

  it('patches an organisation with PATCH and only the given fields', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: {} }))
    await orgAccountsService.patch(7, { lifecycle: 'customer', owner_user_id: null })
    assert.match(calls[0].url, /\/org-accounts\/7$/)
    assert.equal(calls[0].init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { lifecycle: 'customer', owner_user_id: null })
  })

  it('sends an empty body for a plain create, and restore_deleted when asked', async () => {
    const calls = fakeFetch(() => json(200, { status: 1, data: { created: true, crm_organization_id: 3, restored: false } }))
    await orgAccountsService.createCrmOrganisation(7)
    await orgAccountsService.createCrmOrganisation(7, { restore_deleted: true })
    assert.match(calls[0].url, /\/org-accounts\/7\/create-crm-organisation$/)
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { restore_deleted: true })
  })

  it('keeps the code and the deleted id of a 409 "deleted_name_exists"', async () => {
    fakeFetch(() => json(409, { status: 0, code: 'deleted_name_exists', message: 'A deleted organisation has this name.', deleted_organization_id: 41 }))
    await assert.rejects(orgAccountsService.createCrmOrganisation(7), (error: unknown) => {
      assert.ok(isDeletedNameConflict(error))
      assert.equal(error.code, 'deleted_name_exists')
      assert.equal(error.deletedOrganizationId, 41)
      assert.equal(error.status, 409)
      assert.equal(error.message, 'A deleted organisation has this name.')
      return true
    })
  })

  it('does not treat another 409 as the deleted-name question', async () => {
    fakeFetch(() => json(409, { status: 0, code: 'something_else', message: 'Clash.' }))
    await assert.rejects(orgAccountsService.createCrmOrganisation(7), (error: unknown) => error instanceof OrgAccountsApiError && !isDeletedNameConflict(error))
  })

  it('keeps the field-keyed errors of a 422', async () => {
    fakeFetch(() => json(422, { status: 0, message: 'Invalid.', errors: { owner_user_id: ['Choose a person of this organisation.'] } }))
    await assert.rejects(orgAccountsService.patch(7, { owner_user_id: 99 }), (error: unknown) => {
      assert.ok(error instanceof OrgAccountsApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.errors, { owner_user_id: ['Choose a person of this organisation.'] })
      assert.equal(error.code, null)
      return true
    })
  })

  it('names the status when the refusal is not JSON', async () => {
    fakeFetch(() => new Response('<html>nope</html>', { status: 403, statusText: 'Forbidden' }))
    await assert.rejects(orgAccountsService.createCrmOrganisation(7), (error: unknown) => error instanceof ApiError && error.status === 403 && /403/.test(error.message))
  })
})
