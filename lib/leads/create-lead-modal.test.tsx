import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent } from '../agent/assertions'
import type { Lead } from '../../types/crm'
import { lead } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/**
 * The Add / Edit Lead dialog as a person meets it (FIX-e2e A3): the real dialog and service client, only the network replaced. The dialog used to say
 * "Leave blank to auto-assign" while the server, with no rotation configured, refused a blank owner with a 422.
 */

const picklists = { leadStatus: [], leadSource: [], industry: [], rating: [] }

async function open(existing: Lead | null = null) {
  const screen = await screenKit({
    pathname: '/module/crm/marketing/leads',
    respond: (call: Call) => {
      if (call.path.endsWith('/table_data')) return [{ id: 2, first_name: 'Anil', last_name: 'Shah' }, { id: 9, first_name: 'Ravi', last_name: 'Iyer' }]
      if (call.method === 'POST' && call.path.endsWith('/crm/leads')) return { status: 1, message: 'Lead created.', data: lead({ id: '60' }) }
      if (call.method === 'PUT' && call.path.includes('/crm/leads/')) return { status: 1, message: 'Lead updated.', data: lead() }
      return undefined
    },
  })
  const { CreateLeadModal } = await import('../../components/domain/crm/create-lead-modal')
  const saved: string[] = []
  await screen.mount(screen.k.h(CreateLeadModal, { isOpen: true, onClose: () => undefined, onSaved: (m: string) => { saved.push(m) }, lead: existing, picklists }), 60)
  const { k } = screen
  const type = async (id: string, value: string) => {
    const input = k.one(`#${id}`) as HTMLInputElement | null
    assert.ok(input, `${id} is drawn`)
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new k.w.Event('input', { bubbles: true }))
    })
  }
  const press = async (label: string) => {
    const button = k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === label)
    assert.ok(button, `${label} is drawn`)
    await k.click(button)
    await k.tick(60)
  }
  const sent = (method: string) => screen.calls.filter((c) => c.method === method && c.path.includes('/crm/leads'))
  return { ...screen, type, press, sent, saved }
}

describe('the Add Lead dialog: who the lead is assigned to (A3)', () => {
  afterEach(async () => { await disposeAll() })

  it('starts the owner as the signed-in person, so a plain Create Lead is not refused', async () => {
    const s = await open()
    await s.type('lead-last-name', 'Menon')
    await s.press('Create Lead')
    const posts = s.sent('POST')
    assert.equal(posts.length, 1, 'one request')
    assert.equal((posts[0].body as { assignedTo?: string }).assignedTo, '2', 'the signed-in user (id 2) is the owner')
    assert.deepEqual(s.saved, ['Lead created.'])
    s.restore()
  })

  it('no longer promises auto-assignment the server may refuse, and says what really happens', async () => {
    const s = await open()
    assert.equal(s.k.bodyText().includes('Leave blank to auto-assign'), false, 'the old promise is gone')
    // The placeholder is only visible while the field is empty, which it no longer is: scan the source so the old words cannot return unseen.
    assert.equal(readFileSync(path.resolve('components/domain/crm/create-lead-modal.tsx'), 'utf8').includes('Leave blank to auto-assign'), false, 'and is not in the dialog\'s source either')
    const hint = s.k.one('[data-assign-hint]')
    assert.ok(hint, 'a hint is drawn under the field')
    assert.ok(hint.textContent!.includes('Starts as you'), 'it says the owner starts as you')
    assert.ok(hint.textContent!.includes('refused'), 'and that a blank owner can be refused')
    s.restore()
  })

  it('editing a lead keeps ITS owner, not the signed-in person, and draws no hint', async () => {
    const s = await open(lead({ assignedTo: '9' }))
    absent(s.k.one('[data-assign-hint]'), 'the hint is for a new lead only')
    await s.press('Save Changes')
    const puts = s.sent('PUT')
    assert.equal(puts.length, 1)
    assert.equal((puts[0].body as { assignedTo?: string }).assignedTo, '9', 'the lead\'s own owner is sent')
    s.restore()
  })
})
