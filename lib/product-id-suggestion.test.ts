import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { ID_PREFIXES, nextProductId } from './product-form'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Next product ID for a category', () => {
  it('is the category code with the highest number in use plus one, two digits at least', () => {
    assert.equal(nextProductId('Scholar K-12', ['SCH-01', 'SCH-04', 'SCH-02']), 'SCH-05')
    assert.equal(nextProductId('EB', []), 'EB-01')
    assert.equal(nextProductId('G2G', ['G2G-09']), 'G2G-10')
    assert.equal(nextProductId('HE', ['HE-99']), 'HE-100')
  })

  it('ignores IDs that are not CODE-number, other categories, and is case-insensitive', () => {
    assert.equal(nextProductId('Scholar K-12', ['SCH-FEE', 'SCH-CAREER', 'EB-07', 'sch-03']), 'SCH-04')
  })

  it('suggests nothing for a category without a code or an empty choice', () => {
    assert.equal(nextProductId('', ['SCH-01']), '')
    assert.equal(nextProductId('Unknown', []), '')
    assert.ok(Object.keys(ID_PREFIXES).length >= 5)
  })
})

// RE-POINTED (S15 WPD2, 23 Nov 2026): the Category choice of the retired Portfolio dialog (product-form-dialog.tsx) is the Product choice of the one form drawer; the ID is
// suggested from it the same way (the next number after the highest one among that Product's sub-products).
describe('Add product form', () => {
  const about = read('components/domain/portfolio/product-form-about.tsx')
  const drawer = read('components/domain/portfolio/product-form-drawer.tsx')

  it('shows the Product before the ID and the Name (the Product decides the suggested ID)', () => {
    const at = (label: string) => about.indexOf(`<Field label="${label}"`)
    assert.ok(at('Product') > 0 && at('Product') < at('ID') && at('ID') < at('Name'))
  })

  it('fills the ID from the Product in add mode, leaves a typed ID alone, and the ID stays editable until the first save', () => {
    assert.match(drawer, /return nextProductId\(product\.portfolioName, product\.subProducts\.map\(\(s\) => s\.offerId \?\? ''\)\.filter\(Boolean\)\)/)
    assert.match(drawer, /const suggestion = !editing && !idTouched \? suggestId\(choices, productId\) : ''/)
    assert.match(drawer, /const setOfferId = \(offerId: string\) => \{ setIdTouched\(offerId\.trim\(\) !== ''\); setAbout\(\{ offerId \}\) \}/)
    assert.match(about, /onChange=\{\(e\) => onOfferId\(e\.target\.value\)\} disabled=\{busy \|\| hasAbout\}/)
  })
})
