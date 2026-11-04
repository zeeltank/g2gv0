import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  DEFAULT_COUNTRY,
  DEFAULT_REGIONS,
  getAvailableCountries,
  getAvailableStates,
  getAvailableCities,
  addCustomLocation,
  loadSavedRegions,
  persistSavedRegions,
  loadCustomLocations,
} from './location-repository'

describe('Location Repository: India default & location management', () => {
  it('defaults to India for country and initial regions', () => {
    assert.equal(DEFAULT_COUNTRY, 'India')
    assert.deepEqual(DEFAULT_REGIONS, [{ country: 'India' }])
  })

  it('lists countries with India first and all major countries available', () => {
    const countries = getAvailableCountries()
    assert.ok(countries.length > 150)
    assert.equal(countries[0].name, 'India', 'India must be the first country')
    for (const name of ['United States', 'United Kingdom', 'Germany', 'Australia', 'Canada']) {
      assert.ok(countries.some((c) => c.name === name), name)
    }
  })

  it('provides pre-seeded states for India and other countries', () => {
    const indiaStates = getAvailableStates('India')
    assert.ok(indiaStates.length >= 28)
    for (const state of ['Gujarat', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu']) {
      assert.ok(indiaStates.includes(state), state)
    }

    const usStates = getAvailableStates('United States')
    assert.ok(usStates.includes('California'))
    assert.ok(usStates.includes('New York'))
  })

  it('provides pre-seeded cities for given states', () => {
    const gujaratCities = getAvailableCities('India', 'Gujarat')
    assert.ok(gujaratCities.includes('Ahmedabad'))
    assert.ok(gujaratCities.includes('Surat'))
    assert.ok(gujaratCities.includes('Vadodara'))

    const maharashtraCities = getAvailableCities('India', 'Maharashtra')
    assert.ok(maharashtraCities.includes('Mumbai'))
    assert.ok(maharashtraCities.includes('Pune'))
  })

  it('allows adding a custom state and city, preventing duplicates', () => {
    const res = addCustomLocation({ country: 'India', state: 'Custom Pradesh', city: 'Custom City' })
    assert.equal(res.success, true)
    assert.equal(res.problems.length, 0)

    // Adding duplicate does not fail and does not create duplicate entries
    const dupRes = addCustomLocation({ country: 'India', state: 'Custom Pradesh', city: 'Custom City' })
    assert.equal(dupRes.success, true)

    // Refuses city without state
    const invalid = addCustomLocation({ country: 'India', city: 'Orphan City' })
    assert.equal(invalid.success, false)
    assert.ok(invalid.problems.some((p) => /needs its state/.test(p)))
  })

  it('changing country returns empty state list for unknown country until added', () => {
    assert.deepEqual(getAvailableStates(''), [])
    assert.deepEqual(getAvailableCities('India', ''), [])
  })
})

