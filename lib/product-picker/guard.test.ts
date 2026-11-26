import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { ALL_PICKER_AND_CONSUMER_FILES, CONSUMERS, OTHER_CONSUMERS, PICKER_FILES, SOURCE_ROOTS } from './files'
import { getProductsReceivers, read, readsBareProductList, readsMasterOptions, retiredWords, sourceFiles } from './scan'

/**
 * The static guard of the shared product picker (slice 15, completeness audit 3 and track WPC). The behaviour of the picker and of every consumer is proved by the
 * whole-screen tests next to this file; THIS file proves that nothing quietly goes back: no screen reads the old product list (the old Products screens are deleted: nothing is allowed to) to let a
 * person choose a product, every consumer still holds the picker component it was moved to, the three consumers that are not pickers still read their endpoints, and
 * no retired word (Catalogue, Offer, Item, Product line, "Product / Service") is on a picker or a consumer. Each scan is also run on made-up source, because a scan that
 * cannot see an offence proves nothing. Tests run from the repository root.
 */
// The guard's own table and scans name the very strings they look for.
const OWN = new Set(['lib/product-picker/files.ts', 'lib/product-picker/scan.ts'])
const files = sourceFiles(SOURCE_ROOTS).filter((file) => !OWN.has(file))

describe('the picker and its consumers are where the guard expects them', () => {
  it('finds every file of the picker and every consumer', () => {
    for (const file of ALL_PICKER_AND_CONSUMER_FILES) assert.ok(existsSync(file), `${file} is listed in lib/product-picker/files.ts but is missing`)
    assert.equal(PICKER_FILES.length, 10, 'the picker is ten files: the service, five in lib (with the list of how each form treats a Sub-product that is not sold), four components')
    assert.equal(CONSUMERS.length, 14, 'fourteen consumer files (the table in files.ts; the price book page is not one: Price Books were removed in S16)')
  })

  it('reads source files to scan (a guard that scanned nothing would pass for ever)', () => {
    assert.ok(files.length > 500, `only ${files.length} source files were found under ${SOURCE_ROOTS.join(', ')}`)
    assert.ok(files.includes('components/domain/portfolio/product-picker.tsx'), 'the picker is among the files read')
    assert.ok(files.includes('services/crm/index.ts'), 'the CRM service is among the files read')
  })

  for (const consumer of CONSUMERS) {
    it(`${consumer.file} still holds the picker it was moved to (${consumer.picks})`, () => {
      const source = read(consumer.file)
      for (const needle of consumer.uses) assert.ok(source.includes(needle), `${consumer.file} no longer contains ${needle} (pinned by ${consumer.pinnedBy})`)
    })
  }
})

describe('no screen reads the old product list to let a person choose a product', () => {
  it('no file calls crmService.getProducts (with an item type) any more: portfolioService.getProducts of the Signals selector is the only getProducts call', () => {
    const offences = files
      .filter((file) => getProductsReceivers(read(file)).some((receiver) => receiver !== 'portfolioService'))
    assert.deepEqual(offences, [], 'a screen reads crmService.getProducts for a picker again: use SubProductPicker (the shared picker)')
  })

  it('none of the fourteen consumers calls getProducts at all', () => {
    const offences = CONSUMERS.filter((consumer) => getProductsReceivers(read(consumer.file)).length > 0).map((consumer) => consumer.file)
    assert.deepEqual(offences, [], 'a consumer of the shared picker reads a product list of its own')
  })

  it('only the two services of the signals ask the Product Master for its options list', () => {
    const allowed = new Set<string>(['services/signal-review/runs-service.ts', 'services/signal-review/signal-review-service.ts'])
    const offences = files.filter((file) => !allowed.has(file) && readsMasterOptions(read(file)))
    assert.deepEqual(offences, [], 'a screen reads every Product, Sub-product and item at once: use the Product choices (/product-master/lines) or the picker')
  })

  it('only the CRM service reads the bare old list (GET /crm/products)', () => {
    const offences = files.filter((file) => file !== 'services/crm/index.ts' && readsBareProductList(read(file)))
    assert.deepEqual(offences, [], 'a file reads GET /crm/products itself')
  })
})

describe('the three consumers that are not pickers still read their endpoints (audit 3, G-E7)', () => {
  for (const other of OTHER_CONSUMERS) {
    it(`${other.file} still reads ${other.reads}`, () => {
      assert.ok(read(other.file).includes(other.mustContain), `${other.file} no longer contains ${other.mustContain}`)
    })
  }
})

describe('the scans see what they are for (on made-up source)', () => {
  it('sees the old catalogue list read, in any form of the call, and not the Signals selector or a definition', () => {
    assert.deepEqual(getProductsReceivers("const r = await crmService.getProducts(context, 'product', { perPage: 100 })"), ['crmService'])
    assert.deepEqual(getProductsReceivers('crmService\n  .getProducts(context, itemType)'), ['crmService'])
    assert.deepEqual(getProductsReceivers('portfolioService.getProducts(context)'), ['portfolioService'])
    assert.deepEqual(getProductsReceivers('getProducts: (context, itemType) => apiClient.get(url)'), [], 'a definition is not a call')
    assert.deepEqual(getProductsReceivers('// crmService.getProducts(context, "product")\n/* crmService.getProducts() */'), [], 'a comment is not a call')
  })

  it('sees the bare old list and the full options list, and not a record read or a bulk call', () => {
    assert.equal(readsBareProductList("apiClient.get<CrmProductListResponse>('/crm/products', {"), true)
    assert.equal(readsBareProductList('apiClient.get("/crm/products")'), true)
    assert.equal(readsBareProductList('apiClient.get(`/crm/products/${id}`)'), false)
    assert.equal(readsBareProductList("apiClient.post('/crm/products/bulk/delete', body)"), false)
    assert.equal(readsMasterOptions('await productMasterService.options()'), true)
    assert.equal(readsMasterOptions("import { productMasterService } from 'x'\nconst o = await service.options()"), true)
    assert.equal(readsMasterOptions('const o = await service.options()'), false, 'another service is not the Product Master')
    assert.equal(readsMasterOptions('productMasterService.lines()'), false)
  })

  it('sees a retired word in a label, a sentence, an attribute and the text between tags, in either case, and a Product / Service pair', () => {
    for (const source of [
      "const label = 'Catalogue'",
      'const s = "Add an Offer to the portfolio"',
      'const t = `Delete ${n} items from CRM`',
      '<h2>Product lines</h2>',
      '<Button aria-label="Open the catalogue">Go</Button>',
      "const w = 'Product / Service'",
    ]) assert.ok(retiredWords('x.tsx', source).length > 0, `should be seen: ${source}`)
  })

  it('ignores identifiers, comments, API values, the other words and a document\'s own "line items"', () => {
    for (const source of [
      'const itemType = row.itemMasterId',
      'items.map((item) => item.id)',
      "if (row.kind === 'item') return 1",
      '// the catalogue row is never deleted',
      "const label = 'Sub-product'",
      '<p>No line items yet. Click “Add Line” to start building this quote.</p>',
      'const url = "/portfolio/products/5"',
    ]) assert.deepEqual(retiredWords('x.tsx', source), [], `should be ignored: ${source}`)
  })
})

describe('the words on the picker and on every consumer are Product and Sub-product', () => {
  it('names no retired word (Catalogue, Offer, Item, Product line, Product / Service) in what a person could read', () => {
    const found = ALL_PICKER_AND_CONSUMER_FILES.flatMap((file) => retiredWords(file, read(file)))
    assert.deepEqual(found, [], 'a retired word is on a screen')
  })
})
