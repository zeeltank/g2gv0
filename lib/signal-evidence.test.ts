import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { evidenceBadge, fitHeading } from './signal-evidence'

describe('evidenceBadge', () => {
  it('labels each class the server can send', () => {
    assert.equal(evidenceBadge('direct_evidence')?.label, 'Direct evidence')
    assert.equal(evidenceBadge('strong_indicator')?.label, 'Strong indicator')
    assert.equal(evidenceBadge('weak_indicator')?.label, 'Weak indicator')
    assert.equal(evidenceBadge('needs_further_research')?.label, 'Needs further research')
  })

  it('shows nothing for a signal stored before classes existed, or an unknown value', () => {
    assert.equal(evidenceBadge(undefined), null)
    assert.equal(evidenceBadge(null), null)
    assert.equal(evidenceBadge(''), null)
    assert.equal(evidenceBadge('confirmed'), null)
    assert.equal(evidenceBadge('toString'), null)
  })
})

describe('fitHeading', () => {
  it('names a child product with its parent', () => {
    assert.equal(fitHeading({ kind: 'child_product', name: 'Career Guidance Programme', parent_product: 'Scholar K-12' }), 'Career Guidance Programme (child product of Scholar K-12)')
  })

  it('uses the plain name for a general part, and nothing when there is none', () => {
    assert.equal(fitHeading({ kind: 'product_part', name: 'School Erp', parent_product: 'Scholar K-12' }), 'School Erp')
    assert.equal(fitHeading({ kind: 'child_product', parent_product: 'Scholar K-12' }), null)
    assert.equal(fitHeading(null), null)
    assert.equal(fitHeading(undefined), null)
  })
})
