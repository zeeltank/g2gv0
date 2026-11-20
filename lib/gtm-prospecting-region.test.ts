import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { regionFields } from '@/services/gtm/gtm'
import { ALL_SCOPE, accountRegionLabel, regionKey, scopeIsComplete, scopeSentence } from '@/components/domain/gtm/prospecting-scope'

const products = [{ key: 'g2g', label: 'G2G' }] as never

describe('Prospecting region', () => {
  it('sends no region fields for All Regions', () => {
    assert.deepEqual(regionFields(null), {})
    assert.deepEqual(regionFields(undefined), {})
  })

  it('sends the place as flat fields, with the location codes when the place was picked from the lists', () => {
    assert.deepEqual(regionFields({ country: 'India', state: 'Gujarat' }), { region_country: 'India', region_state: 'Gujarat' })
    assert.deepEqual(
      regionFields({ country: 'India', state: 'Gujarat', city: 'Ahmedabad', country_code: 'IN', state_code: 'GJ', city_id: 123 }),
      { region_country: 'India', region_state: 'Gujarat', region_city: 'Ahmedabad', region_country_code: 'IN', region_state_code: 'GJ', region_city_id: '123' },
    )
  })

  it('needs a product, a customer type AND a region before anything can be added', () => {
    assert.equal(scopeIsComplete(ALL_SCOPE), false)
    assert.equal(scopeIsComplete({ product: 'g2g', customerModel: 'b2c', region: null }), false)
    assert.equal(scopeIsComplete({ product: 'g2g', customerModel: 'all', region: { country: 'India' } }), false)
    assert.equal(scopeIsComplete({ product: 'g2g', customerModel: 'b2c', region: { country: 'India' } }), true)
  })

  it('names the list it adds to, region included', () => {
    assert.equal(scopeSentence(products, { product: 'g2g', customerModel: 'b2c', region: { country: 'India', state: 'Gujarat' } }), 'G2G · Partner acquisition · Gujarat, India')
    assert.equal(scopeSentence(products, { product: 'g2g', customerModel: 'b2c', region: null }), '')
  })

  it('tells two regions apart', () => {
    assert.notEqual(regionKey({ country: 'India', state: 'Gujarat' }), regionKey({ country: 'India', state: 'Maharashtra' }))
    assert.equal(regionKey(null), 'all')
  })

  it('shows an account\'s place, and nothing for an older account that has none', () => {
    assert.equal(accountRegionLabel({ region_country: 'India', region_state: 'Maharashtra', region_city: 'Pune' }), 'Pune, Maharashtra, India')
    assert.equal(accountRegionLabel({ region_country: null }), '')
  })
})
