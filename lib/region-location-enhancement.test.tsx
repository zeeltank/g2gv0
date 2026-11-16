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

  it('2. Country Selection: the selector uses the full searchable country list from the location service, not a short built-in one', () => {
    const selectorSrc = read('components/domain/signals/region-selector.tsx')
    assert.match(selectorSrc, /<LocationPicker /)
    assert.doesNotMatch(selectorSrc, /getAvailableCountries|<select/, 'no short built-in list and no native dropdown in the selector')
    const pickerSrc = read('components/domain/signals/location-picker.tsx')
    assert.match(pickerSrc, /loader\.countries\(\)/)
    assert.match(pickerSrc, /label="Country"\s+required/)
    // behaviour (search, India first, Singapore found) is exercised against the real component in location-picker.test.tsx
    assert.ok(getAvailableCountries().length > 150, 'the older client-side helper is untouched')
  })

  it('3. State / Province is a plain text input: no list is loaded, no dropdown, no suggestions', () => {
    const pickerSrc = read('components/domain/signals/location-picker.tsx')
    assert.match(pickerSrc, /State \/ Province \/ Region/)
    assert.match(pickerSrc, /placeholder="Enter state \/ province"/)
    assert.doesNotMatch(pickerSrc, /loader\.states|getLocationStates|<datalist/)
    assert.ok(getAvailableStates('India').includes('Gujarat'), 'the older client-side helper is untouched')
  })

  it('4. City is a plain text input: no list is loaded, no dropdown, no suggestions', () => {
    const pickerSrc = read('components/domain/signals/location-picker.tsx')
    assert.match(pickerSrc, /placeholder="Enter city"/)
    assert.doesNotMatch(pickerSrc, /loader\.cities|getLocationCities|<datalist/)
    assert.ok(getAvailableCities('India', 'Gujarat').includes('Surat'), 'the older client-side helper is untouched')
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

  it('6. Changing the country keeps the typed state and city', () => {
    const pickerSrc = read('components/domain/signals/location-picker.tsx')
    assert.match(pickerSrc, /state: draft\.state, city: draft\.city, countryCode: chosen\.code/)
    // the behaviour itself is exercised in location-picker.test.tsx
  })
})
