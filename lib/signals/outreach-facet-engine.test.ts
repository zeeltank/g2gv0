import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeFacets, filtersOf, hasFilters, narrow, passes, type FacetCatalog, type FacetSets } from './outreach-facet-engine'
import { companySets, FACET_CATALOG, personSets, PRODUCT_CORE, PRODUCT_ERP, SUB_CODE, SUB_EXAMS, SUB_FEES, SUB_TIMETABLE } from './outreach-facet-fixtures'
import { companies, people } from './outreach-fixtures'

/**
 * The stand-in the screen tests filter against, held to the server's contract on its own: a filter passes a row whose set holds the value, `none` passes a row whose set is empty, the
 * filters are ANDed, an unknown value matches nothing, and each filter's options are counted with the OTHER three applied and not itself. If this drifted from the contract, every screen
 * test built on it would pass for the wrong reason.
 */

const sets = (over: Partial<FacetSets> = {}): FacetSets => ({ products: [], subProducts: [], icps: [], regions: [], ...over })

describe('the stand-in server: which rows a filter passes', () => {
  it('passes a row whose set holds the value, and none whose set does not', () => {
    const row = sets({ products: ['11'], icps: ['b2b'] })
    assert.equal(passes(row, { product: '11' }), true)
    assert.equal(passes(row, { product: '12' }), false)
    assert.equal(passes(row, {}), true, 'no filter, every row')
  })

  it('ANDs the filters, so two filters narrow more than one', () => {
    const row = sets({ products: ['11'], icps: ['b2b'], regions: ['gujarat'] })
    assert.equal(passes(row, { product: '11', icp: 'b2c' }), false)
    assert.equal(passes(row, { product: '11', icp: 'b2b' }), true)
    assert.equal(passes(row, { product: '11', icp: 'b2b', region: 'goa' }), false)
  })

  it('lets `none` pass only a row whose set is empty', () => {
    assert.equal(passes(sets(), { product: 'none' }), true)
    assert.equal(passes(sets({ products: ['11'] }), { product: 'none' }), false)
    assert.equal(passes(sets({ icps: ['b2b'] }), { product: 'none', icp: 'b2b' }), true, 'one filter on Not recorded, another on a value')
  })

  it('matches nothing for a value nobody holds, and raises no error', () => {
    assert.deepEqual(narrow([sets({ regions: ['gujarat'] }), sets()], (row) => row, { region: 'atlantis' }), [])
  })

  it('reads the four filters out of a request, and nothing else', () => {
    assert.deepEqual(filtersOf({ product: '11', sub_product: '', icp: undefined, region: 'surat' }), { product: '11', region: 'surat' })
    assert.equal(hasFilters({}), false)
    assert.equal(hasFilters({ icp: 'b2b' }), true)
  })
})

describe('the stand-in server: the options of each filter', () => {
  const rows = [
    sets({ products: ['11'], subProducts: ['21'], icps: ['b2b'], regions: ['gujarat'] }),
    sets({ products: ['11'], subProducts: ['22'], icps: ['b2c'], regions: ['gujarat', 'goa'] }),
    sets({ products: ['12'], subProducts: ['23'], icps: ['b2b'], regions: ['goa'] }),
    sets({ regions: ['gujarat'] }),
  ]
  const catalog: FacetCatalog = {
    products: { 11: 'School ERP', 12: 'Scholar Core' },
    subProducts: { 21: { label: 'Fees', productId: '11' }, 22: { label: 'Timetable', productId: '11' }, 23: { label: 'Exams', productId: '12' } },
    icps: { b2b: 'B2B', b2c: 'B2C' },
    regions: { gujarat: 'Gujarat', goa: 'Goa' },
  }
  const facets = (filters = {}) => computeFacets(rows, (row) => row, filters, catalog)

  it('counts every option over all the rows when no filter is set, and counts the rows with nothing recorded', () => {
    const f = facets()
    assert.deepEqual(f.products.map((o) => [o.label, o.count]), [['Scholar Core', 1], ['School ERP', 2]], 'by name')
    assert.deepEqual(f.icps.map((o) => [o.value, o.count]), [['b2b', 2], ['b2c', 1]])
    assert.deepEqual(f.regions.map((o) => [o.label, o.count]), [['Gujarat', 3], ['Goa', 2]], 'the most common first')
    assert.deepEqual(f.notRecorded, { products: 1, subProducts: 1, icps: 1, regions: 0 })
    assert.deepEqual(f.active, { product: null, subProduct: null, icp: null, region: null })
  })

  it('counts each filter with the OTHER three applied and not itself', () => {
    // Region Goa narrows the products to School ERP (1 row) and Scholar Core (1 row), where the naive count over all rows is 2 and 1.
    const f = facets({ region: 'goa' })
    assert.deepEqual(f.products.map((o) => [o.label, o.count]), [['Scholar Core', 1], ['School ERP', 1]])
    // The region facet itself ignores the region filter: counted with no region applied.
    assert.deepEqual(f.regions.map((o) => [o.label, o.count]), [['Gujarat', 3], ['Goa', 2]])
    assert.equal(f.active.region, 'goa')
    // And two filters together: Goa and B2B leaves one row, so the products have one option.
    assert.deepEqual(facets({ region: 'goa', icp: 'b2b' }).products.map((o) => [o.label, o.count]), [['Scholar Core', 1]])
  })

  it('counts Not recorded with the other filters applied too', () => {
    assert.equal(facets({ region: 'gujarat' }).notRecorded.products, 1)
    assert.equal(facets({ region: 'goa' }).notRecorded.products, 0)
  })

  it('leaves out an option with no rows but keeps the chosen one, even at zero', () => {
    const f = facets({ product: '12', icp: 'b2c' })
    assert.deepEqual(f.products.map((o) => [o.label, o.count]), [['Scholar Core', 0], ['School ERP', 1]], 'with B2C applied only School ERP has a row, and the chosen Scholar Core stays listed at zero')
    const chosen = facets({ region: 'atlantis' })
    assert.deepEqual(chosen.regions.find((o) => o.value === 'atlantis'), { value: 'atlantis', label: 'atlantis', count: 0 })
    assert.equal(facets({ icp: 'b2c' }).products.every((o) => o.count > 0), true)
  })

  it('names a sub-product with the product it belongs to, and gives a code no product holds none', () => {
    const f = computeFacets([sets({ subProducts: ['offer:G2G-09'] })], (row) => row, {}, catalog)
    assert.deepEqual(f.subProducts, [{ value: 'offer:G2G-09', label: 'G2G-09', count: 1, productId: null }])
    assert.deepEqual(facets().subProducts.map((o) => [o.label, o.productId]), [['Exams', 12], ['Fees', 11], ['Timetable', 11]])
  })

  it('lists the 50 most common regions and the chosen one besides', () => {
    const many = Array.from({ length: 60 }, (_, i) => sets({ regions: [`place-${String(i).padStart(2, '0')}`] }))
    const f = computeFacets(many, (row) => row, {}, { ...catalog, regions: {} })
    assert.equal(f.regions.length, 50)
    const chosen = computeFacets(many, (row) => row, { region: 'place-59' }, { ...catalog, regions: {} })
    assert.equal(chosen.regions.length, 51)
    assert.ok(chosen.regions.some((o) => o.value === 'place-59'), 'the chosen region is among them even though it is not among the 50 first')
  })
})

describe('the fixtures the screens are tested against', () => {
  it('give the three companies the product, sub-product, ICP and region data the tests narrow by, and one with nothing recorded', () => {
    assert.deepEqual(companySets(1), { products: [PRODUCT_ERP, PRODUCT_CORE], subProducts: [SUB_FEES, SUB_TIMETABLE, SUB_EXAMS], icps: ['b2b'], regions: ['gujarat', 'ahmedabad'] })
    assert.deepEqual(companySets(2).products, [PRODUCT_CORE])
    assert.ok(companySets(2).subProducts.includes(SUB_EXAMS) && companySets(2).subProducts.includes(SUB_CODE))
    assert.deepEqual(companySets(3), { products: [], subProducts: [], icps: [], regions: ['gujarat', 'surat'] })
  })

  it('give a person their company\'s sets, plus their own place when it is another one', () => {
    const ravi = people().find((p) => p.id === 12)!
    assert.deepEqual(personSets(ravi).regions, ['gujarat', 'surat', 'ahmedabad'])
    assert.deepEqual(personSets(people().find((p) => p.id === 11)!), companySets(1))
  })

  it('narrow the three companies the way the tests say they do', () => {
    const ids = (filters: Parameters<typeof narrow>[2]) => narrow(companies(), (row) => companySets(row.id), filters).map((row) => row.id)
    assert.deepEqual(ids({ product: PRODUCT_ERP }), [1])
    assert.deepEqual(ids({ product: PRODUCT_CORE }), [1, 2], 'a company can carry two products')
    assert.deepEqual(ids({ product: 'none' }), [3])
    assert.deepEqual(ids({ region: 'gujarat' }), [1, 3])
    assert.deepEqual(ids({ region: 'gujarat', product: 'none' }), [3])
    assert.deepEqual(ids({ icp: 'b2b', region: 'surat' }), [])
    assert.deepEqual(FACET_CATALOG.products[PRODUCT_ERP], 'School ERP')
  })
})
