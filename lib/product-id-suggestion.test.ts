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

describe('Add product form', () => {
  const s = read('components/domain/portfolio/product-form-dialog.tsx')

  it('shows Category and Status before Product ID and Name', () => {
    const at = (id: string) => s.indexOf(`<Field id="${id}"`)
    assert.ok(at('pf-category') < at('pf-status') && at('pf-status') < at('pf-id') && at('pf-id') < at('pf-name'))
  })

  it('fills the ID from the category in add mode, leaves a typed ID alone, and the ID stays editable', () => {
    assert.match(s, /void chooseCategory\(e\.target\.value\)/)
    assert.match(s, /if \(mode !== 'create' \|\| idEdited\) return/)
    assert.match(s, /nextProductId\(category, ids\)/)
    assert.match(s, /disabled=\{busy \|\| mode === 'edit'\}/)
  })
})
