import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createLocationLoader, filterByQuery, foldText, latestOnly, type LocationService } from './location-api'
import { addSelection, commitPending, draftSelection, emptyDraft, normalise, regionsPayload, type RegionDraft } from './region-scope'

const ctx = { organizationId: 1, subInstituteId: 1, userId: 1 } as never

function stub() {
  const calls = { countries: 0, states: 0, cities: 0 }
  let failNextStates = false
  const service: LocationService = {
    getLocationCountries: async () => { calls.countries += 1; return { data: { default_country_code: 'IN', countries: [{ code: 'IN', name: 'India', emoji: null, has_states: true }], data_version: 'v' } } },
    getLocationStates: async (_c, code) => {
      calls.states += 1
      if (failNextStates) { failNextStates = false; throw new Error('down') }
      return { data: { country: { code, name: 'India', emoji: null, has_states: true }, states: [], has_states: true, label: 'State', has_cities: true, message: null } }
    },
    getLocationCities: async (_c, country, state) => { calls.cities += 1; return { data: { country_code: country, state_code: state, cities: [], total: 0, truncated: false, message: null } } },
  }
  return { service, calls, failNext: () => { failNextStates = true } }
}

describe('location text matching', () => {
  it('ignores case, accents and extra spaces', () => {
    assert.equal(foldText('  São   PAULO '), 'sao paulo')
    assert.equal(foldText("Côte d'Ivoire"), "cote d'ivoire")
  })

  it('finds by any part of the name, names that start with the text first, and a code exactly', () => {
    const list = [{ name: 'Singapore', code: 'SG' }, { name: 'Sint Maarten', code: 'SX' }, { name: 'Russia', code: 'RU' }, { name: 'Austria', code: 'AT' }]
    const find = (q: string) => filterByQuery(list, q, (o) => o.name, (o) => o.code).map((o) => o.name)
    assert.deepEqual(find('SIN'), ['Singapore', 'Sint Maarten'])
    assert.deepEqual(find('sia'), ['Russia'], 'inside a name')
    assert.deepEqual(find('at'), ['Austria'], 'an exact code counts')
    assert.deepEqual(find('zzz'), [])
    assert.equal(find('  ').length, 4, 'an empty query keeps everything, in order')
  })
})

describe('the location loader', () => {
  it('shares one request between callers that ask for the same thing, and caches the answer', async () => {
    const { service, calls } = stub()
    const loader = createLocationLoader(service, ctx)
    await Promise.all([loader.countries(), loader.countries(), loader.countries()])
    await loader.countries()
    await Promise.all([loader.states('IN'), loader.states('IN')])
    await loader.cities('IN', 'GJ', 'Sur')
    await loader.cities('IN', 'GJ', '  sur ')   // the same search once tidied
    assert.deepEqual(calls, { countries: 1, states: 1, cities: 1 })
    assert.equal(loader.requests, 3)
  })

  it('asks again after a failure instead of remembering it', async () => {
    const { service, calls, failNext } = stub()
    const loader = createLocationLoader(service, ctx)
    failNext()
    await assert.rejects(() => loader.states('IN'))
    await loader.states('IN')
    assert.equal(calls.states, 2)
  })

  it('keeps different countries, states and searches apart', async () => {
    const { service, calls } = stub()
    const loader = createLocationLoader(service, ctx)
    await loader.states('IN'); await loader.states('SG')
    await loader.cities('IN', 'GJ', ''); await loader.cities('IN', 'MH', ''); await loader.cities('IN', 'GJ', 'a')
    assert.equal(calls.states, 2)
    assert.equal(calls.cities, 3)
  })
})

describe('the newest-answer guard', () => {
  it('says only the newest ticket is current, and that invalidating makes every earlier one stale', () => {
    const guard = latestOnly()
    const a = guard.next()
    const b = guard.next()
    assert.equal(guard.isLatest(a), false)
    assert.equal(guard.isLatest(b), true)
    guard.invalidate()
    assert.equal(guard.isLatest(b), false)
  })
})

describe('structured places in the selection model', () => {
  const picked: RegionDraft = { country: 'India', state: 'Gujarat', city: 'Surat', countryCode: 'IN', stateCode: 'GJ', cityId: 134096, countryHasStates: true }

  it('carries the codes from the lists into the selection and the request', () => {
    const added = addSelection([], draftSelection(picked))
    assert.deepEqual(added.problems, [])
    assert.deepEqual(added.list, [{ country: 'India', state: 'Gujarat', city: 'Surat', country_code: 'IN', state_code: 'GJ', city_id: 134096 }])
    assert.deepEqual(regionsPayload(added.list), { regions: added.list })
  })

  it('a level that was cleared takes its code with it: no stale state code on a country-only place', () => {
    assert.deepEqual(draftSelection({ ...picked, state: '', city: '' }), { country: 'India', state: '', city: '', country_code: 'IN' })
    assert.deepEqual(normalise({ country: 'India', state_code: 'GJ', city_id: 5 }), { country: 'India' })
    assert.deepEqual(normalise({ country: 'India', state: 'Gujarat', state_code: 'GJ', city_id: 5 }), { country: 'India', state: 'Gujarat', state_code: 'GJ' })
  })

  it('a country-only place is valid and carries only its country code', () => {
    const r = commitPending([], { ...emptyDraft(), country: 'Singapore', countryCode: 'SG' })
    assert.deepEqual(r.problems, [])
    assert.deepEqual(r.list, [{ country: 'Singapore', country_code: 'SG' }])
  })

  it('state and city are optional free text: a city may be given without a state', () => {
    const cityOnly: RegionDraft = { country: 'India', state: '', city: 'Surat', countryCode: 'IN' }
    assert.deepEqual(commitPending([], cityOnly).problems, [])
    assert.deepEqual(commitPending([], cityOnly).list, [{ country: 'India', city: 'Surat', country_code: 'IN' }])
  })

  it('a place without codes (an older saved one) still works and is sent as it is', () => {
    const r = addSelection([], { country: 'Atlantis', state: 'Deep' })
    assert.deepEqual(r.list, [{ country: 'Atlantis', state: 'Deep' }])
    assert.deepEqual(regionsPayload(r.list), { regions: [{ country: 'Atlantis', state: 'Deep' }] })
  })

  it('two places are kept, the same place twice is one, and no more than five', () => {
    let list = addSelection([], draftSelection(picked)).list
    list = addSelection(list, { country: 'Singapore', country_code: 'SG' }).list
    list = addSelection(list, draftSelection(picked)).list
    assert.equal(list.length, 2)
    for (const c of ['Japan', 'Kenya', 'Brazil']) list = addSelection(list, { country: c }).list
    assert.equal(list.length, 5)
    assert.match(addSelection(list, { country: 'Peru' }).problems[0], /at most 5/)
  })
})
