import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { resolveSelection, normalizeProductKey } from './product-selection'

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

describe('normalizeProductKey', () => {
  const catalog = [
    { key: 'scholarclone', label: 'ScholarClone' },
    { key: 'enterprise_brain', label: 'Enterprise Brain' },
    { key: 'g2g', label: 'G2G' },
    { key: 'payroll_suite', label: 'Payroll Suite' },
  ]

  it('normalizes hyphenated and underscore variants to canonical keys', () => {
    assert.equal(normalizeProductKey('enterprise-brain', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('enterprise_brain', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('enterprisebrain', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('eb', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('scholar-clone', catalog), 'scholarclone')
    assert.equal(normalizeProductKey('scholar_clone', catalog), 'scholarclone')
    assert.equal(normalizeProductKey('scholarclone', catalog), 'scholarclone')
    assert.equal(normalizeProductKey('g2g', catalog), 'g2g')
    assert.equal(normalizeProductKey('payroll-suite', catalog), 'payroll_suite')
  })

  it('handles casing and URL-encoded strings safely', () => {
    assert.equal(normalizeProductKey('Enterprise-Brain', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('enterprise%2Dbrain', catalog), 'enterprise_brain')
    assert.equal(normalizeProductKey('SCHOLAR-CLONE', catalog), 'scholarclone')
  })

  it('returns empty string for null, undefined or empty input without throwing', () => {
    assert.equal(normalizeProductKey(null, catalog), '')
    assert.equal(normalizeProductKey(undefined, catalog), '')
    assert.equal(normalizeProductKey('', catalog), '')
  })

  it('returns clean normalized string for unknown product keys', () => {
    assert.equal(normalizeProductKey('custom_solution', catalog), 'custom_solution')
    assert.equal(normalizeProductKey('unknown-key', catalog), 'unknown-key')
  })
})
