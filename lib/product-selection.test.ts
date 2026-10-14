import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { resolveSelection } from './product-selection'

const products = [
  { key: 'scholarclone', ready: true },
  { key: 'enterprise_brain', ready: false },
  { key: 'g2g', ready: false },
]

describe('resolveSelection', () => {
  it('keeps a valid saved or linked product, even one that is not ready', () => {
    assert.equal(resolveSelection('enterprise_brain', products, false), 'enterprise_brain')
    assert.equal(resolveSelection('g2g', products, false), 'g2g')
  })

  it('starts on ScholarClone when nothing usable was saved', () => {
    assert.equal(resolveSelection(null, products, false), 'scholarclone')
    assert.equal(resolveSelection('', products, false), 'scholarclone')
    assert.equal(resolveSelection('nonsense', products, false), 'scholarclone')
  })

  it('never returns "all" on a screen that cannot show all, replacing an old saved "all"', () => {
    assert.equal(resolveSelection('all', products, false), 'scholarclone')
  })

  it('keeps "all" where the screen can show it', () => {
    assert.equal(resolveSelection('all', products, true), 'all')
    assert.equal(resolveSelection(null, products, true), 'all')
    assert.equal(resolveSelection('g2g', products, true), 'g2g')
  })

  it('falls back to the first ready product, then the first, if ScholarClone is unavailable', () => {
    assert.equal(resolveSelection(null, [{ key: 'g2g', ready: false }, { key: 'enterprise_brain', ready: true }], false), 'enterprise_brain')
    assert.equal(resolveSelection(null, [{ key: 'g2g', ready: false }], false), 'g2g')
  })
})
