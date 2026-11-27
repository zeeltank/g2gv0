import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { AiProviderKey, AiSignalSlot, AiSignalsApi, AiSignalsOverview, AiSlotState } from '@/services/signals/ai-signals'

const LABELS: Record<AiProviderKey, string> = { claude: 'Claude', gpt: 'ChatGPT / GPT', deepseek: 'DeepSeek', gemini: 'Gemini' }

const slot = (provider: AiProviderKey, over: Partial<AiSignalSlot> = {}): AiSignalSlot => ({
  provider, label: LABELS[provider], connector_id: null, configured: false, enabled: false, state: 'not_configured', state_label: 'Not set up',
  delivery_url: 'https://hp.example/api/signals/ai-delivery', token_hint: null, last_received_at: null, last_sync_at: null, last_sync_status: null, last_sync_message: null,
  totals: { deliveries: 0, imported: 0, updated: 0, duplicate: 0, failed: 0, failed_deliveries: 0, waiting: 0 }, recent: [], ...over,
})

const live = (provider: AiProviderKey, over: Partial<AiSignalSlot> = {}) => slot(provider, { connector_id: 5, configured: true, enabled: true, state: 'ok', state_label: 'Receiving', token_hint: '…ab12', ...over })

const overview = (data: AiSignalSlot[]): AiSignalsOverview => ({ status: 1, tables_migrated: true, delivery_url: 'https://hp.example/api/signals/ai-delivery', data })

/** A fake server that remembers what it was asked. */
function fake(initial: AiSignalSlot[]) {
  const state = { slots: initial, calls: [] as string[] }
  const api: AiSignalsApi = {
    list: async () => overview(state.slots),
    enable: async (p, product) => {
      state.calls.push(`enable:${p}:${product ?? ''}`)
      state.slots = state.slots.map((s) => (s.provider === p ? live(p, { state: 'waiting', state_label: 'Waiting for the first delivery' }) : s))
      return { status: 1, secret: 'g2gai_5_' + 'a'.repeat(48), data: state.slots.find((s) => s.provider === p)! }
    },
    rotate: async (p) => { state.calls.push(`rotate:${p}`); return { status: 1, secret: 'g2gai_5_' + 'b'.repeat(48), data: state.slots.find((s) => s.provider === p)! } },
    toggle: async (p, enabled) => { state.calls.push(`toggle:${p}:${enabled}`); state.slots = state.slots.map((s) => (s.provider === p ? { ...s, enabled } : s)); return { status: 1, data: state.slots.find((s) => s.provider === p)! } },
    sync: async (p) => { state.calls.push(`sync:${p}`); return { status: 1, message: 'Import started.' } },
    syncAll: async () => { state.calls.push('sync-all'); return { status: 1, message: 'Import started for 2 AI source(s).' } },
    submit: async (p, payload) => { state.calls.push(`submit:${p}:${payload}`); return { status: 1, message: 'Received. The import has started.' } },
  }

  return { state, api }
}

const four = (over: Partial<Record<AiProviderKey, AiSignalSlot>> = {}) => (['claude', 'gpt', 'deepseek', 'gemini'] as const).map((p) => over[p] ?? slot(p))

async function mount(api: AiSignalsApi, props: Record<string, unknown> = {}) {
  const k = await kit()
  const { AiSignalConnectors } = await import('@/components/domain/signals/ai-signal-connectors')
  await k.render(k.h(AiSignalConnectors, { service: api, pollMs: 10, ...props }))
  await k.tick(5)

  return k
}

describe('the AI signal sources in the Connectors tab', () => {
  afterEach(disposeAll)

  it('shows the four sources, in order, with their state', async () => {
    const { api } = fake(four({ claude: live('claude', { state: 'ok', state_label: 'Receiving', last_received_at: '2026-11-27T04:30:00Z' }), gpt: live('gpt', { state: 'waiting', state_label: 'Waiting for the first delivery' }) }))
    const k = await mount(api)
    assert.deepEqual(k.all('[data-testid^="ai-card-"]').map((c) => c.getAttribute('data-testid')), ['ai-card-claude', 'ai-card-gpt', 'ai-card-deepseek', 'ai-card-gemini'])
    assert.match(k.bodyText(), /Claude/)
    assert.match(k.bodyText(), /ChatGPT \/ GPT/)
    assert.match(k.bodyText(), /DeepSeek/)
    assert.match(k.bodyText(), /Gemini/)
    assert.equal(k.one('[data-testid="ai-state-claude"]')?.textContent, 'Receiving')
    assert.equal(k.one('[data-testid="ai-state-deepseek"]')?.textContent, 'Not set up')
    assert.ok(k.one('[data-testid="ai-setup-deepseek"]'), 'an unset source offers Set up')
    assert.equal(k.one('[data-testid="ai-sync-deepseek"]'), null, 'and no Sync yet')
    assert.ok(k.one('[data-testid="ai-sync-claude"]'))
    assert.notEqual(k.one('[data-testid="ai-received-claude"]')?.textContent, 'Never')
  })

  it('shows imported, duplicate, failed and waiting counts and the last message honestly', async () => {
    const { api } = fake(four({ claude: live('claude', {
      totals: { deliveries: 3, imported: 7, updated: 2, duplicate: 4, failed: 1, failed_deliveries: 1, waiting: 2 },
      last_sync_status: 'partial', last_sync_message: 'Imported 7 new, 2 updated, 4 already known; 1 signal(s) did not pass the quality checks.',
    }) }))
    const k = await mount(api)
    const text = (k.one('[data-testid="ai-card-claude"]')?.textContent ?? '')
    assert.match(text, /Imported\s*9/)       // new + updated
    assert.match(text, /Duplicates\s*4/)
    assert.match(text, /Failed\s*2/)         // a rejected signal and an unreadable delivery
    assert.match(text, /Waiting\s*2/)
    assert.match(k.one('[data-testid="ai-message-claude"]')?.textContent ?? '', /did not pass the quality checks/)
    assert.match(k.one('[data-testid="ai-synced-claude"]')?.textContent ?? '', /partial/)
  })

  it('Set up asks for this source only, shows the secret once, and forgets it when dismissed', async () => {
    const { api, state } = fake(four())
    const k = await mount(api, { productKey: 'scholarclone' })
    await k.click(k.one('[data-testid="ai-setup-claude"]')!)
    await k.tick(5)
    assert.deepEqual(state.calls, ['enable:claude:scholarclone'])
    const box = k.one('[data-testid="ai-secret"]')
    assert.ok(box, 'the secret is shown')
    assert.match(box!.textContent ?? '', /g2gai_5_a{48}/)
    assert.match(box!.textContent ?? '', /only once/)
    assert.equal(k.one('[data-testid="ai-state-claude"]')?.textContent, 'Waiting for the first delivery')

    await k.click(k.withText('I have saved it')!)
    assert.equal(k.one('[data-testid="ai-secret"]'), null)
    assert.doesNotMatch(k.bodyText(), /g2gai_5_a{48}/, 'once dismissed, the secret is nowhere on the page')
  })

  it('Sync starts one source and says what the server said; the import is watched until it ends', async () => {
    const { api, state } = fake(four({ claude: live('claude', { state: 'syncing', state_label: 'Importing' }) }))
    let completed = 0
    const k = await mount(api, { onSyncCompleted: () => { completed += 1 } })
    assert.equal(completed, 0, 'still importing')
    state.slots = state.slots.map((s) => (s.provider === 'claude' ? live('claude', { state: 'ok', state_label: 'Receiving' }) : s))
    await k.tick(60)
    assert.equal(completed, 1, 'the signals list is told once the import has ended')
    assert.equal(k.one('[data-testid="ai-state-claude"]')?.textContent, 'Receiving')

    await k.click(k.one('[data-testid="ai-sync-claude"]')!)
    await k.tick(5)
    assert.ok(state.calls.includes('sync:claude'))
    assert.match(k.one('[data-testid="ai-notice"]')?.textContent ?? '', /Import started/)
  })

  it('Sync All AI Signals is unavailable until a source is on, then calls the server once', async () => {
    const none = fake(four())
    const k1 = await mount(none.api)
    assert.equal(k1.one('[data-testid="sync-all-ai"]')?.hasAttribute('disabled'), true)
    await disposeAll()

    const some = fake(four({ claude: live('claude'), gpt: live('gpt') }))
    const k2 = await mount(some.api)
    const btn = k2.one('[data-testid="sync-all-ai"]')!
    assert.equal(btn.hasAttribute('disabled'), false)
    await k2.click(btn)
    await k2.tick(5)
    assert.deepEqual(some.state.calls, ['sync-all'])
    assert.match(k2.one('[data-testid="ai-notice"]')?.textContent ?? '', /2 AI source/)
  })

  it('Delivery details shows the address, the secret hint, and the recent deliveries with their outcomes', async () => {
    const { api } = fake(four({ claude: live('claude', { recent: [
      { id: 2, status: 'partial', via: 'webhook', delivery_ref: 'd2', records: 4, imported: 2, updated: 0, duplicate: 1, failed: 1, pending: 0, message: null, rejections: [], rejections_more: 0, look_alikes: [], received_at: '2026-11-27T04:31:00Z', imported_at: '2026-11-27T04:32:00Z' },
      { id: 1, status: 'failed', via: 'manual', delivery_ref: null, records: 0, imported: 0, updated: 0, duplicate: 0, failed: 0, pending: 0, message: 'The delivery is not valid JSON.', rejections: [], rejections_more: 0, look_alikes: [], received_at: '2026-11-26T04:31:00Z', imported_at: null },
    ] }) }))
    const k = await mount(api)
    assert.equal(k.one('[data-testid="ai-panel-claude"]'), null, 'closed until asked for')
    await k.click(k.one('[data-testid="ai-details-claude"]')!)
    assert.match(k.one('[data-testid="ai-url-claude"]')?.textContent ?? '', /POST https:\/\/hp\.example\/api\/signals\/ai-delivery/)
    const panel = k.one('[data-testid="ai-panel-claude"]')!.textContent ?? ''
    assert.match(panel, /…ab12/)
    assert.match(panel, /4 signal\(s\): 2 new, 0 updated, 1 duplicate, 1 rejected, 0 pending/)
    assert.match(panel, /The delivery is not valid JSON\./)
    assert.match(panel, /pasted/)
  })

  it('Recent deliveries show new, updated, duplicate, rejected and pending, and each rejected signal with its reason and how to fix it', async () => {
    const rejection = (index: number, label: string, code: string, reason: string, hint: string) => ({ index, label, reason_code: code, reason, hint })
    const { api } = fake(four({ claude: live('claude', { recent: [
      { id: 9, status: 'partial', via: 'webhook', delivery_ref: 'd9', records: 8, imported: 3, updated: 1, duplicate: 1, failed: 3, pending: 0, message: null, received_at: '2026-11-27T04:31:00Z', imported_at: '2026-11-27T04:32:00Z',
        rejections: [
          rejection(2, 'No Date School', 'missing_date', 'No date: provide event_date or observed_at.', 'Give event_date as YYYY-MM-DD (or observed_at). Do not leave the date out.'),
          rejection(5, 'Relative Date School', 'invalid_date', 'event_date "last Tuesday" is not a date G2G can accept.', 'Write dates as YYYY-MM-DD, for example 2026-11-24.'),
          rejection(6, 'Odd Type School', 'invalid_buyer_type', 'buyer.type must be one of: government, school.', 'buyer.type must be one of the listed values. Or leave it out.'),
        ],
        rejections_more: 4, look_alikes: [{ index: 3, label: 'Sunrise Public School, Pune', id: 7, name: 'Sunrise Public School', similarity: 91 }] },
      { id: 8, status: 'received', via: 'webhook', delivery_ref: null, records: 6, imported: 0, updated: 0, duplicate: 0, failed: 0, pending: 6, message: null, rejections: [], rejections_more: 0, look_alikes: [], received_at: '2026-11-27T05:00:00Z', imported_at: null },
    ] }) }))
    const k = await mount(api)
    await k.click(k.one('[data-testid="ai-details-claude"]')!)
    assert.match(k.one('[data-testid="ai-delivery-counts-9"]')?.textContent ?? '', /8 signal\(s\): 3 new, 1 updated, 1 duplicate, 3 rejected, 0 pending/)
    assert.match(k.one('[data-testid="ai-delivery-counts-8"]')?.textContent ?? '', /6 signal\(s\): 0 new, 0 updated, 0 duplicate, 0 rejected, 6 pending/)
    const list = k.one('[data-testid="ai-rejections-9"]')!.textContent ?? ''
    assert.match(list, /No Date School: No date: provide event_date or observed_at\./)
    assert.match(list, /How to fix: Give event_date as YYYY-MM-DD/)
    assert.match(list, /Relative Date School: event_date "last Tuesday" is not a date G2G can accept\./)
    assert.match(list, /Odd Type School/)
    assert.match(list, /and 4 more rejected/)
    assert.equal(k.one('[data-testid="ai-rejections-8"]'), null, 'a delivery with nothing rejected lists nothing')
    const look = k.one('[data-testid="ai-lookalikes-9"]')!.textContent ?? ''
    assert.match(look, /Possible same organisation, not merged/)
    assert.match(look, /Sunrise Public School, Pune.*looks like.*Sunrise Public School.*91% similar/)
  })

  it('an import that no worker has picked up says so on the card instead of showing "Importing" for ever', async () => {
    const { api } = fake(four({
      claude: live('claude', { state: 'syncing', state_label: 'Importing', worker_hint: 'This import has been waiting 3 minute(s) and no Signals queue worker has picked it up. A worker must be running on the server (php artisan queue:work --queue=signals,default). Ask an administrator to check it.' }),
      gpt: live('gpt'),
    }))
    const k = await mount(api)
    const hint = k.one('[data-testid="ai-worker-hint-claude"]')?.textContent ?? ''
    assert.match(hint, /no Signals queue worker has picked it up/)
    assert.match(hint, /queue:work --queue=signals,default/)
    assert.equal(k.one('[data-testid="ai-worker-hint-gpt"]'), null, 'a source with nothing waiting shows no hint')
  })

  it('a pasted output is sent for that source and the box is cleared', async () => {
    const { api, state } = fake(four({ claude: live('claude') }))
    const k = await mount(api)
    await k.click(k.one('[data-testid="ai-details-claude"]')!)
    const send = k.one('[data-testid="ai-paste-send-claude"]')!
    assert.equal(send.hasAttribute('disabled'), true, 'nothing to send yet')
    const box = k.one('[data-testid="ai-paste-claude"]') as HTMLTextAreaElement
    await k.act(async () => {
      const set = Object.getOwnPropertyDescriptor(k.w.HTMLTextAreaElement.prototype, 'value')!.set!
      set.call(box, '{"signals": []}')
      box.dispatchEvent(new k.w.Event('input', { bubbles: true }))
    })
    await k.click(k.one('[data-testid="ai-paste-send-claude"]')!)
    await k.tick(5)
    assert.deepEqual(state.calls, ['submit:claude:{"signals": []}'])
    assert.equal((k.one('[data-testid="ai-paste-claude"]') as HTMLTextAreaElement).value, '')
  })

  it('switching a source off or on goes to the server for that source only', async () => {
    const { api, state } = fake(four({ claude: live('claude') }))
    const k = await mount(api)
    await k.click(k.one('[data-testid="ai-toggle-claude"]')!)
    await k.tick(5)
    assert.deepEqual(state.calls, ['toggle:claude:false'])
    assert.equal(k.one('[data-testid="ai-sync-claude"]')?.hasAttribute('disabled'), true, 'an off source cannot be synced')
  })

  it('a failed call shows its reason and leaves every card on screen', async () => {
    const { api } = fake(four({ claude: live('claude') }))
    api.sync = async () => { throw new Error('An import is already running for this source.') }
    const k = await mount(api)
    await k.click(k.one('[data-testid="ai-sync-claude"]')!)
    await k.tick(5)
    assert.match(k.one('[data-testid="ai-error"]')?.textContent ?? '', /already running/)
    assert.equal(k.all('[data-testid^="ai-card-"]').length, 4)
  })

  it('one source waiting on the server never locks the other sources: only the card that was clicked is busy', async () => {
    const { api, state } = fake(four())
    api.enable = async (p) => { state.calls.push(`enable:${p}`); return new Promise(() => {}) }   // the server never answers
    const k = await mount(api, { timeoutMs: 100000 })
    await k.click(k.one('[data-testid="ai-setup-claude"]')!)
    assert.equal(k.one('[data-testid="ai-setup-claude"]')?.hasAttribute('disabled'), true, 'the clicked card waits')
    for (const other of ['gpt', 'deepseek', 'gemini']) {
      assert.equal(k.one(`[data-testid="ai-setup-${other}"]`)?.hasAttribute('disabled'), false, `${other} stays usable`)
    }
    assert.equal(k.one('[data-testid="sync-all-ai"]')?.hasAttribute('disabled'), true, 'Sync All waits while anything is in flight')
    await k.click(k.one('[data-testid="ai-setup-gemini"]')!)   // another source can be set up at the same time
    assert.deepEqual(state.calls, ['enable:claude', 'enable:gemini'])
  })

  it('a request the server never answers is stopped on screen with a clear message, and the buttons come back', async () => {
    const { api } = fake(four())
    api.enable = async () => new Promise(() => {})
    const k = await mount(api, { timeoutMs: 30 })
    await k.click(k.one('[data-testid="ai-setup-claude"]')!)
    assert.equal(k.one('[data-testid="ai-setup-claude"]')?.hasAttribute('disabled'), true)
    await k.tick(80)
    assert.match(k.one('[data-testid="ai-error"]')?.textContent ?? '', /did not answer within/)
    assert.equal(k.one('[data-testid="ai-setup-claude"]')?.hasAttribute('disabled'), false, 'not locked for good')
    assert.equal(k.all('[data-testid^="ai-card-"]').length, 4)
  })

  it('a refused Set up (for example the server is not migrated) shows the reason and leaves all four buttons usable', async () => {
    const { api } = fake(four())
    api.enable = async () => { throw new Error('AI signal delivery is not set up on this server yet. Run the pending migration first.') }
    const k = await mount(api)
    await k.click(k.one('[data-testid="ai-setup-claude"]')!)
    await k.tick(5)
    assert.match(k.one('[data-testid="ai-error"]')?.textContent ?? '', /pending migration/)
    for (const p of ['claude', 'gpt', 'deepseek', 'gemini']) {
      assert.equal(k.one(`[data-testid="ai-setup-${p}"]`)?.hasAttribute('disabled'), false, `${p} Set up is usable`)
    }
  })

  it('says so when the server has not been migrated, and still lists the four sources', async () => {
    const { api } = fake(four())
    api.list = async () => ({ ...overview(four()), tables_migrated: false, notice: 'AI signal delivery is not set up on this server yet. Run the pending migration first.' })
    const k = await mount(api)
    assert.match(k.bodyText(), /not set up on this server yet/)
    assert.equal(k.all('[data-testid^="ai-card-"]').length, 4)
  })

  it('if the list cannot be loaded it says why instead of showing nothing', async () => {
    const { api } = fake(four())
    api.list = async () => { throw new Error('Network down') }
    const k = await mount(api)
    assert.match(k.one('[data-testid="ai-error"]')?.textContent ?? '', /Network down/)
  })
})

// keep the state type referenced so a rename in the service breaks this file loudly
const _states: AiSlotState[] = ['not_configured', 'no_secret', 'off', 'syncing', 'error', 'waiting', 'pending', 'ok']
void _states
