import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RegionSelector } from '../components/domain/signals/region-selector'
import {
  DEFAULT_COUNTRY,
  DEFAULT_REGIONS,
  getAvailableCountries,
  getAvailableStates,
  getAvailableCities,
  addCustomLocation,
  loadSavedRegions,
  persistSavedRegions,
} from './location-repository'
import { emptyDraft, type RegionSelection } from './region-scope'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('G2G Region Filter & Location Management Enhancement', () => {
  it('1. Default Country = India: India is preselected by default', () => {
    assert.equal(DEFAULT_COUNTRY, 'India')
    assert.deepEqual(DEFAULT_REGIONS, [{ country: 'India' }])

    // Initial load returns India
    const loaded = loadSavedRegions()
    assert.deepEqual(loaded, [{ country: 'India' }])

    // Company Opportunities initializes with DEFAULT_REGIONS (India)
    const screenSrc = read('components/domain/signals/company-opportunities.tsx')
    assert.match(screenSrc, /useState<RegionSelection\[\]>\(DEFAULT_REGIONS\)/)
    assert.match(screenSrc, /persistSavedRegions\(next\)/)
  })

  it('2. Country Selection: searchable country list with India first', () => {
    const countries = getAvailableCountries()
    assert.ok(countries.length > 150)
    assert.equal(countries[0].name, 'India')

    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /getAvailableCountries\(\)/)
    assert.match(selectorSrc, /placeholder="Search country…"/)
    assert.match(selectorSrc, /India \(Default\)/)
  })

  it('3. State / Province Management: lists states for selected country and supports adding custom states', () => {
    const indiaStates = getAvailableStates('India')
    assert.ok(indiaStates.includes('Gujarat'))
    assert.ok(indiaStates.includes('Maharashtra'))

    // Adding custom state
    const addRes = addCustomLocation({ country: 'India', state: 'New State X' })
    assert.equal(addRes.success, true)

    // Stored and deduplicated (case-insensitive)
    const dupRes = addCustomLocation({ country: 'India', state: 'new state x' })
    assert.equal(dupRes.success, true)

    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /getAvailableStates\(effectiveCountry/)
    assert.match(selectorSrc, /\+ Add new state/)
  })

  it('4. City Management: lists cities for selected state, needs state, and prevents duplicates', () => {
    const cities = getAvailableCities('India', 'Gujarat')
    assert.ok(cities.includes('Ahmedabad'))
    assert.ok(cities.includes('Surat'))

    // Adding custom city
    const addRes = addCustomLocation({ country: 'India', state: 'Gujarat', city: 'Ankleshwar' })
    assert.equal(addRes.success, true)

    // Cannot add city without state
    const invalid = addCustomLocation({ country: 'India', city: 'NoStateCity' })
    assert.equal(invalid.success, false)

    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /getAvailableCities\(effectiveCountry, state\)/)
    assert.match(selectorSrc, /\+ Add new city/)
  })

  it('5. Add Region Behavior: renders trigger with India selected by default and provides Add Location form', () => {
    const html = renderToStaticMarkup(
      createElement(RegionSelector, {
        value: [{ country: 'India' }],
        onChange: () => {},
        draft: emptyDraft(),
      })
    )
    assert.match(html, /<span class="truncate">India<\/span>/)

    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /India Selected by Default/)
    assert.match(selectorSrc, /Active Locations/)
  })

  it('6. Changing country resets incompatible state and city', () => {
    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /const setCountry = \(v: string\) => onDraft\(\{ country: v, state: '', city: '' \}\)/)
    assert.match(selectorSrc, /city: v\.trim\(\) === '' \? '' : draft\.city/)
  })
})
