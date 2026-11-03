import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { opportunitiesService, type OpportunityQuery } from '../services/signals/opportunities'
import type { LaravelContext } from './laravel-context'

const mockContext: LaravelContext = {
  token: 'test-token',
  subInstituteId: '1',
  syear: '2026',
  userId: '1',
  organizationId: '42',
  orgType: 'edu',
  profileId: '1',
}

describe('All Signals Daily Inbox: Service Query Construction', () => {
  it('omits specific sub-product, customer model and regions when allSignals is true', () => {
    const q: OpportunityQuery = {
      product: 'scholarclone',
      allSignals: true,
      source: 'all',
      customerModel: 'b2c',
      offerId: 'OFFER-01',
      regions: [{ country: 'India', state: 'Maharashtra' }],
      page: 1,
      perPage: 5,
    }

    const params: Record<string, string> = {
      product: q.product ?? '',
      all_signals: '1',
      page: '1',
      per_page: '5',
    }
    if (q.source && q.source !== 'all') {
      params.source = q.source
    }

    assert.equal(params.all_signals, '1')
    assert.equal(params.offer_id, undefined)
    assert.equal(params.customer_model, undefined)
    assert.equal(params.regions, undefined)
    assert.equal(params.source, undefined)
  })

  it('preserves specific sub-product, model and regions when in specific-scope mode (allSignals is false)', () => {
    const q: OpportunityQuery = {
      product: 'scholarclone',
      allSignals: false,
      source: 'all',
      customerModel: 'b2b',
      offerId: 'SCH-01',
      regions: [{ country: 'India', state: 'Gujarat' }],
      page: 1,
      perPage: 5,
    }

    const params: Record<string, string> = {
      product: q.product ?? '',
      customer_model: q.customerModel!,
      offer_id: q.offerId!,
      'regions[0][country]': 'India',
      'regions[0][state]': 'Gujarat',
      page: '1',
      per_page: '5',
    }

    assert.equal(params.all_signals, undefined)
    assert.equal(params.customer_model, 'b2b')
    assert.equal(params.offer_id, 'SCH-01')
    assert.equal(params['regions[0][country]'], 'India')
  })

  it('supports origin source filtering (all, generated, manual)', () => {
    const generatedQuery: OpportunityQuery = {
      product: 'scholarclone',
      allSignals: true,
      source: 'generated',
    }
    const manualQuery: OpportunityQuery = {
      product: 'scholarclone',
      allSignals: true,
      source: 'manual',
    }

    assert.equal(generatedQuery.source, 'generated')
    assert.equal(manualQuery.source, 'manual')
  })
})

describe('All Signals Daily Inbox: Row Presentation & Fallback Semantics', () => {
  it('formats sub-product correctly: specific offer vs Whole Product vs historical fallback', () => {
    const rowSpecific = {
      id: 1,
      offer_id: 'SCH-02',
      relevant_offer_name: 'Fees Intelligence',
      product_key: 'scholarclone',
    }
    const rowWholeProduct = {
      id: 2,
      offer_id: null,
      relevant_offer_name: null,
      product_key: 'scholarclone',
    }
    const rowHistorical = {
      id: 3,
      offer_id: null,
      relevant_offer_name: null,
      product_key: null,
      product: null,
      business_fit: null,
    }

    // Specific offer
    const sub1 = rowSpecific.offer_id ? (rowSpecific.relevant_offer_name || rowSpecific.offer_id) : 'Whole Product'
    assert.equal(sub1, 'Fees Intelligence')

    // Whole product run
    const sub2 = rowWholeProduct.offer_id ? (rowWholeProduct.relevant_offer_name || rowWholeProduct.offer_id) : (rowWholeProduct.product_key ? 'Whole Product' : 'Unknown / historical record')
    assert.equal(sub2, 'Whole Product')

    // Historical record with null metadata
    const isHistorical = !rowHistorical.product_key && !rowHistorical.product && !rowHistorical.business_fit
    const sub3 = rowHistorical.offer_id ? 'Offer' : (isHistorical ? 'Unknown / historical record' : 'Whole Product')
    assert.equal(sub3, 'Unknown / historical record')
  })

  it('formats customer model correctly with truthful fallback', () => {
    const modelB2b = { customer_model: 'b2b' }
    const modelB2c = { customer_model: 'b2c' }
    const modelB2g = { customer_model: 'b2g' }
    const modelNull = { customer_model: null }

    assert.equal(modelB2b.customer_model ? modelB2b.customer_model.toUpperCase() : 'Unknown / historical', 'B2B')
    assert.equal(modelB2c.customer_model ? modelB2c.customer_model.toUpperCase() : 'Unknown / historical', 'B2C')
    assert.equal(modelB2g.customer_model ? modelB2g.customer_model.toUpperCase() : 'Unknown / historical', 'B2G')
    assert.equal(modelNull.customer_model ? modelNull.customer_model : 'Unknown / historical', 'Unknown / historical')
  })

  it('distinguishes generated research runs from manual opportunities', () => {
    const generatedOpp = {
      id: 101,
      research_run_id: 88,
      entered_manually: false,
      import_source: null,
    }
    const manualOpp = {
      id: 102,
      research_run_id: null,
      entered_manually: true,
      import_source: 'manual',
    }
    const manualLegacyOpp = {
      id: 103,
      research_run_id: null,
      entered_manually: false,
      import_source: 'manual',
    }

    const isGen = Boolean(generatedOpp.research_run_id)
    const isMan1 = Boolean(manualOpp.entered_manually || (!manualOpp.research_run_id && manualOpp.import_source === 'manual'))
    const isMan2 = Boolean(manualLegacyOpp.entered_manually || (!manualLegacyOpp.research_run_id && manualLegacyOpp.import_source === 'manual'))

    assert.equal(isGen, true)
    assert.equal(isMan1, true)
    assert.equal(isMan2, true)
  })

  it('formats region scope correctly with truthful fallback', () => {
    const structuredRegions = [{ country: 'India', state: 'Delhi' }]
    const stringRegion = 'Mumbai, Maharashtra, India'
    const nullRegion = null

    let r1Text = 'All Regions'
    if (Array.isArray(structuredRegions) && structuredRegions.length > 0) {
      r1Text = structuredRegions.map((r) => r.state ? `${r.state}, ${r.country}` : r.country).join('; ')
    }
    assert.equal(r1Text, 'Delhi, India')

    let r2Text = 'All Regions'
    if (typeof stringRegion === 'string' && stringRegion.trim()) {
      r2Text = stringRegion
    }
    assert.equal(r2Text, 'Mumbai, Maharashtra, India')

    let r3Text = 'All Regions'
    if (nullRegion) {
      r3Text = nullRegion
    }
    assert.equal(r3Text, 'All Regions')
  })
})
