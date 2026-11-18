import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readListQuery } from '../../components/shared/scaffolds/list-query'
import {
  catalogueColumnCount, catalogueItemHref, detailTabs, emptyCatalogueHint, EXTRA_TAB_LABELS, extraTabs, icpLabel, icpTitle, icpTone, lineIcpSummary, lineRecordHref, linesScopeHref,
  linesSummary, PRODUCT_LIST_QUERY, readScope, SCOPE_LABELS, showLineColumns, showScopeSwitch, signalsHref,
} from '../../components/domain/crm/product-lines-model'
import type { CrmProductLines } from '../../types/crm'
import type { PmIcpState } from '../../services/product-master/types'

const lines = (over: Partial<CrmProductLines> = {}): CrmProductLines => ({ available: true, linked: 0, productLines: 5, subProducts: 25, ...over })

describe('which scope the Products screen is in', () => {
  it('reads the scope from the address, and any other value is the catalogue', () => {
    assert.equal(readScope('lines'), 'lines')
    assert.equal(readScope('catalogue'), 'catalogue')
    assert.equal(readScope(null), 'catalogue')
    assert.equal(readScope(undefined), 'catalogue')
    assert.equal(readScope(''), 'catalogue')
    assert.equal(readScope('Lines'), 'catalogue', 'exact match only')
    assert.equal(readScope('items'), 'catalogue')
  })

  it('keeps the scope and the status filter in the address, with the catalogue and "active" as the clean default', () => {
    const read = (qs: string) => readListQuery(new URLSearchParams(qs), PRODUCT_LIST_QUERY).filters
    assert.deepEqual(read(''), { scope: 'catalogue', status: 'active' })
    assert.deepEqual(read('scope=lines'), { scope: 'lines', status: 'active' })
    assert.deepEqual(read('scope=lines&status=archived'), { scope: 'lines', status: 'archived' })
    assert.deepEqual(read('scope=junk&status=junk'), { scope: 'catalogue', status: 'active' }, 'a value that is not allowed falls back to the default')
  })

  it('names the two scopes', () => {
    assert.deepEqual(SCOPE_LABELS, { catalogue: 'Catalogue', lines: 'Product lines' })
  })
})

describe('the scope switch', () => {
  it('is shown on the Products screen where the product lines exist', () => {
    assert.equal(showScopeSwitch('product', lines(), 'catalogue'), true)
  })

  it('is never shown on the Services screen: a service is not in a product line', () => {
    assert.equal(showScopeSwitch('service', lines(), 'catalogue'), false)
    assert.equal(showScopeSwitch('service', lines(), 'lines'), false)
  })

  it('is hidden where the product lines do not exist yet, or are not known, so the screen is exactly what it was', () => {
    assert.equal(showScopeSwitch('product', lines({ available: false }), 'catalogue'), false)
    assert.equal(showScopeSwitch('product', null, 'catalogue'), false)
    assert.equal(showScopeSwitch('product', undefined, 'catalogue'), false, 'an older server sends no `lines`')
  })

  it('stays while the product lines are open, even when nothing says they are available, so there is always a way back', () => {
    assert.equal(showScopeSwitch('product', null, 'lines'), true)
    assert.equal(showScopeSwitch('product', lines({ available: false }), 'lines'), true)
  })

  it('is shown when the catalogue is empty but the product lines are not', () => {
    assert.equal(showScopeSwitch('product', lines({ linked: 0 }), 'catalogue'), true)
  })
})

describe('the extra columns of the catalogue list', () => {
  it('are shown only when at least one item is tied to a sub-product', () => {
    assert.equal(showLineColumns(lines({ linked: 1 })), true)
    assert.equal(showLineColumns(lines({ linked: 40 })), true)
    assert.equal(showLineColumns(lines({ linked: 0 })), false)
    assert.equal(showLineColumns(null), false)
    assert.equal(showLineColumns(undefined), false)
  })

  it('make the rows that span the table as wide as the table', () => {
    assert.equal(catalogueColumnCount('product', false), 6, 'tick box, name, category, price, stock, active')
    assert.equal(catalogueColumnCount('service', false), 5, 'a service has no stock column')
    assert.equal(catalogueColumnCount('product', true), 9)
    assert.equal(catalogueColumnCount('service', true), 8)
  })

  it('say what the other view holds when the catalogue is empty', () => {
    assert.equal(emptyCatalogueHint(lines({ productLines: 5, subProducts: 25 })), 'Your product lines are in the other view: 5 product lines with 25 sub-products.')
    assert.equal(emptyCatalogueHint(lines({ productLines: 1, subProducts: 1 })), 'Your product lines are in the other view: 1 product line with 1 sub-product.')
    assert.equal(emptyCatalogueHint(lines({ productLines: 3, subProducts: 0 })), 'Your product lines are in the other view: 3 product lines with 0 sub-products.')
    assert.equal(emptyCatalogueHint(lines({ productLines: 5, subProducts: 25 }), true), 'Your product lines are in the other view: 5 product lines with 25 sub-products. Product Lines contain sellable Catalogue SKUs.')
  })

  it('say nothing when there is nothing to point to', () => {
    assert.equal(emptyCatalogueHint(lines({ available: false })), null)
    assert.equal(emptyCatalogueHint(lines({ productLines: 0, subProducts: 0 })), null)
    assert.equal(emptyCatalogueHint(null), null)
    assert.equal(emptyCatalogueHint(undefined), null)
  })
})

describe('the state of an ideal-customer profile', () => {
  const states: PmIcpState[] = ['active', 'draft', 'archived', 'template', 'none']

  it('has a word for every state and none when no ICP applies', () => {
    assert.deepEqual(states.map(icpLabel), ['Active', 'Draft', 'Archived', 'Built-in', 'Not set up'])
    assert.equal(icpLabel(null), null)
    assert.equal(icpLabel(undefined), null)
    assert.equal(icpLabel('something new' as PmIcpState), null, 'a state this screen does not know is a dash, not a crash')
  })

  it('has a sentence for every state', () => {
    for (const state of states) assert.ok((icpTitle(state) ?? '').length > 20, state)
    assert.equal(icpTitle(null), undefined)
    assert.ok(icpTitle('template')!.includes('built-in'))
  })

  it('has its own colour: in use is good, a draft pending, archived quiet, built-in informational', () => {
    assert.deepEqual(states.map(icpTone), ['success', 'pending', 'inactive', 'primary', 'default'])
    assert.equal(icpTone(null), 'default')
    assert.equal(icpTone(undefined), 'default')
  })
})

describe('the ICP column of a product line', () => {
  // Since the main branch's sub-product ICP rule a profile belongs to a sub-product, so a line says how many of its sub-products have an active one.
  const subs = (...states: Array<PmIcpState | null>) => states.map((icp) => ({ icp }))

  it('counts the sub-products that have an ACTIVE profile out of all of them', () => {
    const summary = lineIcpSummary(subs('active', 'active', 'draft'))
    assert.deepEqual([summary.configured, summary.total, summary.text], [2, 3, '2 of 3'])
    assert.ok(summary.title.includes('2 of 3 sub-products have an active ideal-customer profile'), summary.title)
  })

  it('counts nothing else as set up: a draft is not in use, an archived one is not, a built-in template is not a profile a person saved', () => {
    const summary = lineIcpSummary(subs('draft', 'archived', 'template', 'none', null))
    assert.deepEqual([summary.configured, summary.total, summary.text], [0, 5, '0 of 5'])
  })

  it('speaks in the singular for one sub-product', () => {
    assert.ok(lineIcpSummary(subs('active')).title.startsWith('1 of 1 sub-product has an active'))
    assert.ok(lineIcpSummary(subs('none')).title.startsWith('0 of 1 sub-product has an active'))
  })

  it('is a dash with its reason for a line that has no sub-products yet', () => {
    const summary = lineIcpSummary([])
    assert.deepEqual([summary.configured, summary.total, summary.text], [0, 0, '—'])
    assert.ok(summary.title.includes('no sub-products yet'))
  })
})

describe('the extra tabs of a catalogue item', () => {
  it('gives an item tied to a sub-product both tabs, in this order', () => {
    assert.deepEqual(extraTabs('sub_product'), ['signals', 'usage'])
  })

  it('gives an item that is only in the catalogue the Usage tab alone: it has no signals or ICP', () => {
    assert.deepEqual(extraTabs('item'), ['usage'])
  })

  it('gives an item with no record behind it, or a product line, nothing', () => {
    assert.deepEqual(extraTabs(null), [])
    assert.deepEqual(extraTabs(undefined), [])
    assert.deepEqual(extraTabs('product'), [])
  })

  it('names the tabs', () => {
    assert.deepEqual(EXTRA_TAB_LABELS, { signals: 'Signals & ICP', usage: 'Usage' })
  })
})

describe('the tabs of a catalogue item\'s page', () => {
  const ids = (tabs: Array<{ id: string }>) => tabs.map((t) => t.id)
  const item = (over: Partial<Parameters<typeof detailTabs>[0]> = {}) => ({ bundleable: true, hasCustomFields: false, masterId: 7, masterKind: 'sub_product' as const, ...over })

  it('are exactly the old tabs for an item with no record behind it', () => {
    assert.deepEqual(ids(detailTabs(item({ masterId: null, masterKind: null }))), ['details', 'bundle', 'history'])
    assert.deepEqual(ids(detailTabs(item({ masterId: undefined, masterKind: undefined }))), ['details', 'bundle', 'history'], 'an older server sends neither')
    assert.deepEqual(ids(detailTabs(item({ masterId: null, masterKind: null, bundleable: false }))), ['details', 'history'], 'a service has no bundle')
    assert.deepEqual(ids(detailTabs(item({ masterId: null, masterKind: null, hasCustomFields: true }))), ['details', 'bundle', 'history', 'custom'])
  })

  it('gain Signals & ICP and Usage, after the bundle and before the history, for an item tied to a sub-product', () => {
    assert.deepEqual(ids(detailTabs(item())), ['details', 'bundle', 'signals', 'usage', 'history'])
    assert.deepEqual(ids(detailTabs(item({ hasCustomFields: true }))), ['details', 'bundle', 'signals', 'usage', 'history', 'custom'])
    assert.deepEqual(ids(detailTabs(item({ bundleable: false }))), ['details', 'signals', 'usage', 'history'])
  })

  it('gain Usage alone for a catalogue-only item', () => {
    assert.deepEqual(ids(detailTabs(item({ masterKind: 'item' }))), ['details', 'bundle', 'usage', 'history'])
  })

  it('gain nothing when the record has a kind but no id, so a half-answer cannot open a panel with nothing to read', () => {
    assert.deepEqual(ids(detailTabs(item({ masterId: null }))), ['details', 'bundle', 'history'])
  })

  it('word every tab', () => {
    assert.deepEqual(detailTabs(item({ hasCustomFields: true })).map((t) => t.label), ['Details', 'Bundle', 'Signals & ICP', 'Usage', 'History', 'Custom Fields'])
  })
})

describe('the links between the pages', () => {
  const hrefs = { products: '/module/crm/sales/products', services: '/module/crm/sales/services' }

  it('opens a catalogue item in Products or in Services, by its type', () => {
    assert.equal(catalogueItemHref(hrefs, 12, 'product'), '/module/crm/sales/products/12')
    assert.equal(catalogueItemHref(hrefs, '12', 'service'), '/module/crm/sales/services/12')
    assert.equal(catalogueItemHref(hrefs, 12, null), '/module/crm/sales/products/12', 'an unknown type opens in Products')
    assert.equal(catalogueItemHref(hrefs, 12, undefined), '/module/crm/sales/products/12')
  })

  it('opens a product line, or a sub-product that is not in the catalogue, under Products', () => {
    assert.equal(lineRecordHref('/module/crm/sales/products', 7), '/module/crm/sales/products/lines/7')
    assert.equal(lineRecordHref('/p', '7'), '/p/lines/7')
  })

  it('opens the Products screen on its product lines', () => {
    assert.equal(linesScopeHref('/module/crm/sales/products'), '/module/crm/sales/products?scope=lines')
  })

  it('opens Company Opportunities for a product line, and for one of its sub-products', () => {
    assert.equal(signalsHref('scholarclone'), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', null), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', ''), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', 'SCH-11'), '/signals?product=scholarclone%3A%3ASCH-11')
    assert.equal(signalsHref('enterprise_brain', 'P 7'), '/signals?product=enterprise_brain%3A%3AP%207', 'the address is encoded')
  })

  it('has no Signals address for a record with no product line key', () => {
    assert.equal(signalsHref(null), null)
    assert.equal(signalsHref(undefined, 'SCH-11'), null)
    assert.equal(signalsHref(''), null)
  })
})

describe('the summary under the title of the product lines', () => {
  it('counts the sub-products and the product lines, in the singular where it is one', () => {
    assert.equal(linesSummary({ products: 5, subProducts: 25 }), '25 sub-products in 5 product lines.')
    assert.equal(linesSummary({ products: 1, subProducts: 1 }), '1 sub-product in 1 product line.')
    assert.equal(linesSummary({ products: 0, subProducts: 0 }), '0 sub-products in 0 product lines.')
  })
})
