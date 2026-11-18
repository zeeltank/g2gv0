import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { CHAT_ENGINE } from './engine'
import { contextKey, recordContextFromPath } from './context'

describe('the record on screen, read from the address', () => {
  it('finds a lead, a contact, an organisation and an opportunity by their pages', () => {
    assert.deepEqual(recordContextFromPath('/module/crm/marketing/leads/201'), { type: 'lead', id: 201 })
    assert.deepEqual(recordContextFromPath('/module/crm/marketing/contacts/45'), { type: 'contact', id: 45 })
    assert.deepEqual(recordContextFromPath('/module/crm/support/contacts/45'), { type: 'contact', id: 45 })
    assert.deepEqual(recordContextFromPath('/module/crm/marketing/organizations/135'), { type: 'organization', id: 135 })
    assert.deepEqual(recordContextFromPath('/module/crm/support/organizations/135'), { type: 'organization', id: 135 })
    assert.deepEqual(recordContextFromPath('/module/crm/sales/opportunities/256'), { type: 'opportunity', id: 256 })
  })

  it('accepts a trailing slash and nothing else after the id', () => {
    assert.deepEqual(recordContextFromPath('/module/crm/marketing/leads/201/'), { type: 'lead', id: 201 })
    assert.equal(recordContextFromPath('/module/crm/marketing/leads/201/edit'), null)
    assert.equal(recordContextFromPath('/module/crm/marketing/leads/201//'), null)
  })

  it('finds nothing on a list, a page that is not a record, or a lookalike', () => {
    for (const path of [
      '/module/crm/marketing/leads', '/module/crm/marketing/leads/', '/module/crm/marketing/leads/new', '/module/crm/sales/quotes/12', '/module/crm/sales/products/12',
      '/module/crm/sales/opportunities', '/module/crm/marketing/campaigns/3', '/module/crm/sales/contacts/4', '/module/crm/marketing/leads2/4', '/x/module/crm/marketing/leads/4',
      '/module/crm/marketing/organizations/135/../../x', '/', '', '/signals',
    ]) assert.equal(recordContextFromPath(path), null, path)
  })

  it('refuses an id that is not a plain positive whole number', () => {
    for (const id of ['0', '00', '01', '-1', '1.5', '1e3', 'abc', '12abc', '%31', '1%20', '9999999999999999', '１２']) {
      assert.equal(recordContextFromPath(`/module/crm/marketing/leads/${id}`), null, id)
    }
    assert.deepEqual(recordContextFromPath('/module/crm/marketing/leads/999999999999999'), { type: 'lead', id: 999999999999999 })
  })

  it('tolerates a missing address', () => {
    assert.equal(recordContextFromPath(null), null)
    assert.equal(recordContextFromPath(undefined), null)
  })

  it('gives one record one key and another record another', () => {
    assert.equal(contextKey({ type: 'lead', id: 3 }), 'lead:3')
    assert.notEqual(contextKey({ type: 'lead', id: 3 }), contextKey({ type: 'contact', id: 3 }))
    assert.equal(contextKey(null), null)
  })
})

describe('the engine switch', () => {
  it('is one constant, and the new engine is the one in use (flip it to \'legacy\' to go back to the old endpoint)', () => {
    assert.ok(CHAT_ENGINE === 'ask' || CHAT_ENGINE === 'legacy')
    assert.equal(CHAT_ENGINE, 'ask')
  })

  it('is what the widget uses when the shell mounts it with no props', () => {
    const widget = readFileSync(path.resolve('components/domain/crm/crm-chat-widget.tsx'), 'utf8')
    assert.match(widget, /export function CrmChatWidget\(\{[^)]*engine = CHAT_ENGINE/)
  })
})
