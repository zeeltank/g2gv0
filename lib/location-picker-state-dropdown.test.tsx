import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { JSDOM } from 'jsdom'

// A real render of the Region form with the State dropdown on (Prospecting), the network service replaced by a script.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

import type { LocationService } from './location-api'
import type { RegionDraft } from './region-scope'

const COUNTRIES = [
  { code: 'IN', name: 'India', emoji: '🇮🇳', has_states: true },
  { code: 'SG', name: 'Singapore', emoji: '🇸🇬', has_states: false },
]
const STATES: Record<string, { code: string; name: string; type: string | null }[]> = {
  IN: [
    { code: 'GJ', name: 'Gujarat', type: 'state' },
    { code: 'MH', name: 'Maharashtra', type: 'state' },
    { code: 'KA', name: 'Karnataka', type: 'state' },
  ],
  SG: [],
}
const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never

async function setup(country = 'India', stateDropdown = true) {
  const { createLocationLoader } = await import('./location-api')
  const { LocationPicker } = await import('../components/domain/signals/location-picker')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const service: LocationService = {
    getLocationCountries: async () => ({ data: { default_country_code: 'IN', countries: COUNTRIES, data_version: 't' } }),
    getLocationStates: async (_c, code) => ({ data: { country: COUNTRIES.find((c) => c.code === code)!, states: STATES[code] ?? [], has_states: (STATES[code] ?? []).length > 0, label: 'State', has_cities: false, message: null } }),
    getLocationCities: async () => { throw new Error('city lookups must never be made') },
  }
  const loader = createLocationLoader(service, ctx)
  const latest: { draft: RegionDraft; history: RegionDraft[] } = { draft: { country: '', state: '', city: '' }, history: [] }
  function Harness() {
    const [draft, setDraft] = React.useState<RegionDraft>(latest.draft)
    latest.draft = draft
    return React.createElement(LocationPicker, { context: ctx, draft, effectiveCountry: country, loader, stateDropdown, onDraft: (next: RegionDraft) => { latest.history.push(next); setDraft(next) } })
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const flush = async () => { await React.act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }) }
  await React.act(async () => { root.render(React.createElement(Harness)) })
  await flush()
  const click = (el: Element) => React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const setValue = async (el: HTMLInputElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await React.act(async () => { setter.call(el, text); el.dispatchEvent(new window.Event('input', { bubbles: true })) })
    await flush()
  }
  return { host, latest, flush, click, setValue, unmount: () => React.act(async () => root.unmount()) }
}

describe('Region form: State as a searchable dropdown (Prospecting)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
  afterEach(() => mock.timers.reset())

  it('shows the country\'s states in a searchable dropdown instead of a text box', async () => {
    const t = await setup()
    const trigger = t.host.querySelector('#region-state') as HTMLButtonElement
    assert.ok(trigger, 'a State dropdown is shown')
    assert.equal(trigger.getAttribute('role'), 'combobox')
    assert.equal(t.host.querySelector('input#region-state'), null, 'not a text box')
    await t.click(trigger)
    await t.flush()
    const options = Array.from(t.host.querySelectorAll('[role="option"]')).map((o) => o.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    assert.ok(options.some((o) => o.includes('Gujarat')) && options.some((o) => o.includes('Maharashtra')), 'the states of India are listed')
    await t.unmount()
  })

  it('can be searched, and choosing a state sets the state and its code', async () => {
    const t = await setup()
    await t.click(t.host.querySelector('#region-state') as HTMLButtonElement)
    await t.flush()
    await t.setValue(t.host.querySelector('input[role="searchbox"]') as HTMLInputElement, 'guj')
    const matches = Array.from(t.host.querySelectorAll('[role="option"]'))
    assert.equal(matches.length, 1, 'only Gujarat matches "guj"')
    await t.click(matches[0])
    await t.flush()
    const last = t.latest.history.at(-1)!
    assert.equal(last.state, 'Gujarat')
    assert.equal(last.stateCode, 'GJ')
    await t.unmount()
  })

  it('keeps the plain text box for a country that has no state list', async () => {
    const t = await setup('Singapore')
    await t.flush()
    assert.ok(t.host.querySelector('input#region-state'), 'a text box is used')
    await t.unmount()
  })

  it('without the option (Market Signals) the State field is still a text box and no state list is asked for', async () => {
    const t = await setup('India', false)
    assert.ok(t.host.querySelector('input#region-state'))
    await t.unmount()
  })
})
