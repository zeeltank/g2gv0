import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { JSDOM } from 'jsdom'

// A real render of the real Region form in jsdom, with the network service replaced by a script. No backend is involved.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })

import type { LocationService } from './location-api'
import { commitPending, type RegionDraft } from './region-scope'

const COUNTRIES = [
  { code: 'IN', name: 'India', emoji: '🇮🇳', has_states: true },
  { code: 'SG', name: 'Singapore', emoji: '🇸🇬', has_states: true },
  { code: 'US', name: 'United States', emoji: '🇺🇸', has_states: true },
]
const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never

function makeService() {
  const calls = { countries: 0, states: 0, cities: 0 }
  const service: LocationService = {
    getLocationCountries: async () => { calls.countries += 1; return { data: { default_country_code: 'IN', countries: COUNTRIES, data_version: 't' } } },
    getLocationStates: async () => { calls.states += 1; throw new Error('state lookups must never be made') },
    getLocationCities: async () => { calls.cities += 1; throw new Error('city lookups must never be made') },
  }
  return { service, calls }
}

async function setup(initial: Partial<RegionDraft> = {}, effectiveCountry = 'India', wrapInForm = false) {
  const { createLocationLoader } = await import('./location-api')
  const { LocationPicker } = await import('../components/domain/signals/location-picker')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { service, calls } = makeService()
  const loader = createLocationLoader(service, ctx)

  const latest: { draft: RegionDraft; history: RegionDraft[] } = { draft: { country: '', state: '', city: '', ...initial }, history: [] }
  const submitted = { count: 0 }
  function Harness() {
    const [draft, setDraft] = React.useState<RegionDraft>(latest.draft)
    latest.draft = draft
    const picker = React.createElement(LocationPicker, { context: ctx, draft, effectiveCountry, loader, onDraft: (next: RegionDraft) => { latest.history.push(next); setDraft(next) } })
    return wrapInForm ? React.createElement('form', { onSubmit: (e: Event) => { e.preventDefault(); submitted.count += 1 } }, picker) : picker
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const flush = async () => { await React.act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }) }
  await React.act(async () => { root.render(React.createElement(Harness)) })
  await flush()

  const trigger = (id: string) => host.querySelector(`#${id}`) as HTMLButtonElement
  const input = (id: string) => host.querySelector(`input#${id}`) as HTMLInputElement
  const click = (el: Element) => React.act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  const openCountry = async () => { await click(trigger('region-country')); await flush() }
  const searchBox = () => host.querySelector('input[role="searchbox"]') as HTMLInputElement
  const setValue = async (el: HTMLInputElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await React.act(async () => { setter.call(el, text); el.dispatchEvent(new window.Event('input', { bubbles: true })) })
    await flush()
  }
  const key = async (el: Element, name: string) => { await React.act(async () => { el.dispatchEvent(new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })) }); await flush() }
  const options = () => Array.from(host.querySelectorAll('[role="option"]')).map((o) => o.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  const chooseCountry = async (label: string) => {
    await openCountry()
    const el = Array.from(host.querySelectorAll('[role="option"]')).find((o) => (o.textContent ?? '').includes(label))
    assert.ok(el, `an option "${label}" is listed`)
    await click(el)
    await flush()
  }
  const text = (id: string) => trigger(id).textContent?.replace(/\s+/g, ' ').trim() ?? ''

  return { host, latest, calls, submitted, trigger, input, openCountry, searchBox, setValue, key, options, chooseCountry, text, flush, click, unmount: () => React.act(async () => root.unmount()) }
}

describe('Region form: searchable Country, typed State and City (real component, stubbed service)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
  afterEach(() => mock.timers.reset())

  it('a new selection starts on India, with a Country dropdown and two plain text inputs with the requested placeholders', async () => {
    const t = await setup()
    assert.match(t.text('region-country'), /India/)
    assert.equal(t.trigger('region-country').getAttribute('role'), 'combobox')
    assert.equal(t.input('region-state').type, 'text')
    assert.equal(t.input('region-state').placeholder, 'Enter state / province')
    assert.equal(t.input('region-city').type, 'text')
    assert.equal(t.input('region-city').placeholder, 'Enter city')
    assert.equal(t.host.querySelectorAll('[role="combobox"]').length, 1, 'only the country is a dropdown')
    await t.unmount()
  })

  it('never loads or looks up states or cities, and shows no suggestions or menus for them', async () => {
    const t = await setup({ country: 'India', countryCode: 'IN' })
    await t.setValue(t.input('region-state'), 'Gu')
    await t.setValue(t.input('region-city'), 'Sur')
    assert.deepEqual(t.calls, { countries: 1, states: 0, cities: 0 })
    assert.equal(t.host.querySelectorAll('[role="listbox"]').length, 0)
    assert.equal(t.input('region-state').getAttribute('list'), null, 'no datalist either')
    await t.unmount()
  })

  it('a saved country is shown as it is and is never replaced by India', async () => {
    const t = await setup({ country: 'Singapore' }, 'Singapore')
    assert.match(t.text('region-country'), /Singapore/)
    assert.doesNotMatch(t.text('region-country'), /India/)
    assert.equal(t.latest.history.length, 0, 'nothing is written until the person changes something')
    await t.unmount()
  })

  it('country search still works: case-insensitive, finds Singapore and others, says so when nothing matches', async () => {
    const t = await setup()
    await t.openCountry()
    assert.equal(t.options().length, COUNTRIES.length)
    await t.setValue(t.searchBox(), 'SINGA')
    assert.equal(t.options().length, 1)
    assert.match(t.options()[0], /Singapore/)
    await t.setValue(t.searchBox(), 'unit')
    assert.match(t.options()[0], /United States/)
    await t.setValue(t.searchBox(), 'zzz')
    assert.match(t.host.textContent ?? '', /No country matches your search/)
    await t.unmount()
  })

  it('India + Gujarat + Surat typed by hand is what the draft holds, and becomes a place with no catalogue ids', async () => {
    const t = await setup()
    await t.setValue(t.input('region-state'), 'Gujarat')
    await t.setValue(t.input('region-city'), 'Surat')
    const d = t.latest.draft
    assert.deepEqual([d.country, d.state, d.city, d.stateCode, d.cityId], ['India', 'Gujarat', 'Surat', undefined, undefined])
    assert.deepEqual(commitPending([], d).list, [{ country: 'India', state: 'Gujarat', city: 'Surat', country_code: 'IN' }])
    await t.unmount()
  })

  it('India + a typed Maharashtra + Mumbai, and Singapore + a typed region and city, are both accepted', async () => {
    const t = await setup()
    await t.setValue(t.input('region-state'), 'Maharashtra')
    await t.setValue(t.input('region-city'), 'Mumbai')
    assert.deepEqual(commitPending([], t.latest.draft).list, [{ country: 'India', state: 'Maharashtra', city: 'Mumbai', country_code: 'IN' }])
    await t.chooseCountry('Singapore')
    await t.setValue(t.input('region-state'), 'My Region')
    await t.setValue(t.input('region-city'), 'Anywhere')
    assert.deepEqual(commitPending([], t.latest.draft).list, [{ country: 'Singapore', state: 'My Region', city: 'Anywhere', country_code: 'SG' }])
    await t.unmount()
  })

  it('changing the country keeps the typed state and city', async () => {
    const t = await setup({ country: 'India', countryCode: 'IN', state: 'Gujarat', city: 'Surat' })
    assert.equal(t.input('region-state').value, 'Gujarat')
    await t.chooseCountry('Singapore')
    assert.deepEqual([t.latest.draft.country, t.latest.draft.state, t.latest.draft.city, t.latest.draft.countryCode], ['Singapore', 'Gujarat', 'Surat', 'SG'])
    assert.equal(t.input('region-state').value, 'Gujarat')
    assert.equal(t.input('region-city').value, 'Surat')
    await t.unmount()
  })

  it('state and city are optional, and a city may be given without a state', async () => {
    const t = await setup()
    assert.deepEqual(commitPending([], { country: 'India', state: '', city: '' }).problems, [])
    await t.setValue(t.input('region-city'), 'Pune')
    const r = commitPending([], t.latest.draft)
    assert.deepEqual(r.problems, [])
    assert.deepEqual(r.list, [{ country: 'India', city: 'Pune', country_code: 'IN' }])
    await t.unmount()
  })

  it('values already on the form (an edited place) are shown as they are, even for a country the list does not know', async () => {
    const t = await setup({ country: 'Atlantis', state: 'Deep', city: 'Poseidonis' }, 'Atlantis')
    assert.match(t.text('region-country'), /Atlantis/)
    assert.equal(t.input('region-state').value, 'Deep')
    assert.equal(t.input('region-city').value, 'Poseidonis')
    assert.doesNotMatch(t.host.textContent ?? '', /India/)
    await t.unmount()
  })

  it('Enter in State or City never submits a surrounding form, and the country keyboard flow still works', async () => {
    const t = await setup({ country: 'India', countryCode: 'IN' }, 'India', true)
    await t.key(t.input('region-state'), 'Enter')
    await t.key(t.input('region-city'), 'Enter')
    assert.equal(t.submitted.count, 0)
    await t.openCountry()
    await t.key(t.searchBox(), 'ArrowDown')
    await t.key(t.searchBox(), 'Enter')
    assert.equal(t.latest.draft.country, 'Singapore')
    assert.equal(t.submitted.count, 0)
    await t.unmount()
  })
})
