import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { icpStateLabel, signalsHref } from './page-model'

/**
 * The link from a Product or a Sub-product to Company Opportunities, and the words of an ideal-customer state. The first two tests were written for the old product-line model
 * (lib/product-master/lines-model.test.ts) and moved here with the function when that model went (slice 15, track WPD); the page that uses them is the Sub-product page.
 */
describe('the link to Company Opportunities and the words of an ideal-customer state', () => {
  it('opens Company Opportunities for a Product, and for one of its Sub-products', () => {
    assert.equal(signalsHref('scholarclone'), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', null), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', ''), '/signals?product=scholarclone')
    assert.equal(signalsHref('scholarclone', 'SCH-11'), '/signals?product=scholarclone%3A%3ASCH-11')
    assert.equal(signalsHref('enterprise_brain', 'P 7'), '/signals?product=enterprise_brain%3A%3AP%207', 'the address is encoded')
  })

  it('has no Signals address for a record with no Product key', () => {
    assert.equal(signalsHref(null), null)
    assert.equal(signalsHref(undefined, 'SCH-11'), null)
    assert.equal(signalsHref(''), null)
  })

  it('says every ideal-customer state in words, and Not applicable when none applies', () => {
    const words = { active: 'In use', draft: 'Draft', archived: 'Archived', template: 'Built in', none: 'None yet' } as const
    for (const [state, word] of Object.entries(words)) assert.equal(icpStateLabel(state as keyof typeof words), word, state)
    assert.equal(icpStateLabel(null), 'Not applicable')
    assert.equal(icpStateLabel(undefined), 'Not applicable')
  })
})
