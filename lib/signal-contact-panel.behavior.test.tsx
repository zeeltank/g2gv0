import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './scaffolds/dom-test-kit'
import type { Opportunity } from '@/services/signals/opportunities'

const signal = (over: Record<string, unknown> = {}) => ({
  id: 7,
  company_name: 'Sunrise Public School',
  contact: {
    status: 'not_available', name: null, designation: null, company: 'Sunrise Public School', email: null, phone: null, website: null, linkedin: null,
    location: [], email_source: null, phone_source: null, contacts: [], research: { state: 'not_searched', searched_at: null, can_search: true },
    verified: false, message: 'Not available: email address and phone number.',
  },
  ...over,
}) as unknown as Opportunity

/** Clicks the real buttons of the contact panel and checks what is asked of the server and what the card does with the answer. */
describe('the signal contact panel', () => {
  afterEach(disposeAll)

  it('Find contacts asks the server once for this signal, shows its answer, and leaves the signal alone', async () => {
    const k = await kit()
    const { SignalContactPanel } = await import('@/components/domain/signals/signal-contact-panel')
    const asked: number[] = []
    const changed: Opportunity[] = []
    await k.render(k.h(SignalContactPanel, {
      signal: signal(), service: { get: async () => { throw new Error('must not reload') } },
      onChanged: (o: Opportunity) => changed.push(o),
      search: async (id: number) => { asked.push(id); return { status: 1, message: 'Searching public sources for contacts. Reopen this signal in a minute.' } },
    }))
    await k.click(k.one('[data-testid="find-contacts"]')!)
    assert.deepEqual(asked, [7])
    assert.match(k.bodyText(), /Searching public sources for contacts/)
    assert.deepEqual(changed, [], 'asking for a search does not replace or change the signal')
    assert.match(k.bodyText(), /Not Available/, 'the signal and its empty fields stay on screen')
  })

  it('a refused or failed search shows the reason and keeps the signal and its Not Available fields', async () => {
    const k = await kit()
    const { SignalContactPanel } = await import('@/components/domain/signals/signal-contact-panel')
    await k.render(k.h(SignalContactPanel, {
      signal: signal(), service: { get: async () => signal() }, onChanged: () => {},
      search: async () => { throw new Error('Contact search is not set up: no web-search provider key is configured.') },
    }))
    await k.click(k.one('[data-testid="find-contacts"]')!)
    assert.match(k.one('[data-testid="contact-notice"]')?.textContent ?? '', /not set up/)
    assert.ok(k.one('[data-testid="signal-contact"]'), 'the contact section is still there')
    assert.equal(k.one('[data-testid="find-contacts"]')?.hasAttribute('disabled'), false, 'the button is usable again')
  })

  it('Check for results reloads the signal and hands the new version up, so found contacts appear', async () => {
    const k = await kit()
    const { SignalContactPanel } = await import('@/components/domain/signals/signal-contact-panel')
    const found = signal({
      contact: {
        status: 'partial', name: 'Asha Rao', designation: 'Principal', company: 'Sunrise Public School', email: 'asha@sunriseschool.in', phone: null, website: null, linkedin: null,
        location: [], email_source: { status: 'found_public', label: 'Found on the public web', url: 'https://s/1' }, phone_source: null, verified: false, message: 'x',
        contacts: [{ name: 'Asha Rao', designation: 'Principal', email: 'asha@sunriseschool.in', phone: null, linkedin: null, source_url: 'https://s/1', email_source_url: 'https://s/1', phone_source_url: null, verification: 'unverified' }],
        research: { state: 'found', searched_at: null, can_search: true },
      },
    })
    const changed: Opportunity[] = []
    await k.render(k.h(SignalContactPanel, { signal: signal(), service: { get: async () => ({ status: 1, data: found }) as never }, onChanged: (o: Opportunity) => changed.push(o), search: async () => ({ status: 1, message: '' }) }))
    await k.click(k.one('[data-testid="refresh-contacts"]')!)
    assert.equal(changed.length, 1)
    assert.equal(changed[0].contact?.contacts?.[0]?.email, 'asha@sunriseschool.in')
  })

  it('Check for results with nothing new says so and does not drop the signal', async () => {
    const k = await kit()
    const { SignalContactPanel } = await import('@/components/domain/signals/signal-contact-panel')
    await k.render(k.h(SignalContactPanel, { signal: signal(), service: { get: async () => ({ status: 1, data: signal() }) as never }, onChanged: () => {}, search: async () => ({ status: 1, message: '' }) }))
    await k.click(k.one('[data-testid="refresh-contacts"]')!)
    assert.match(k.one('[data-testid="contact-notice"]')?.textContent ?? '', /Nothing found yet/)
    assert.ok(k.one('[data-testid="signal-contact"]'))
  })

  it('no search button is offered when the server says no provider is set up', async () => {
    const k = await kit()
    const { SignalContactPanel } = await import('@/components/domain/signals/signal-contact-panel')
    const s = signal()
    ;(s.contact as { research: unknown }).research = { state: 'not_set_up', searched_at: null, can_search: false }
    await k.render(k.h(SignalContactPanel, { signal: s, service: { get: async () => ({ status: 1, data: s }) as never }, onChanged: () => {}, search: async () => ({ status: 1, message: '' }) }))
    assert.equal(k.one('[data-testid="find-contacts"]'), null)
    assert.ok(k.one('[data-testid="signal-contact"]'), 'the contact section, with Not Available, is still shown')
  })
})
