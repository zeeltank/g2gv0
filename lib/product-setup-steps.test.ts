import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { setupSteps } from '../components/domain/portfolio/product-setup-steps'
import type { ProductInfo } from '../services/portfolio/types'

const product = (over: Partial<ProductInfo>): ProductInfo => ({
  key: 'enterprise_brain', label: 'Enterprise Brain', business_fit: 'eb', portfolio_name: 'EB', offers: [], icp: null, target_accounts: 0, contacts: 0,
  ready: false, state: 'needs_setup', next_step: null, draft_icp: null, missing: [], opportunities_count: 0, research_runs_count: 0, ...over,
})
const states = (p: ProductInfo) => Object.fromEntries(setupSteps(p).map((s) => [s.key, s.state]))

describe('setupSteps', () => {
  it('reports an unconfigured product honestly: nothing is done and generating is not available', () => {
    assert.deepEqual(states(product({})), { offers: 'todo', icp: 'todo', accounts: 'todo', generate: 'todo' })
  })

  it('the ICP step is about the ICPs of the sub-products: none set, some set, all set, and no sub-products at all', () => {
    const sub = (icp: boolean, name = 'S') => ({ id: 1, name, icp_ready: icp, icp_models: { b2b: { ready: icp, configured: icp, missing: [] } } }) as unknown as ProductInfo['offers'][number]
    const icpStep = (p: ProductInfo) => setupSteps(p).find((s) => s.key === 'icp')!

    assert.match(icpStep(product({})).detail, /Add a sub-product/)
    assert.match(icpStep(product({ offers: [sub(false), sub(false)] })).detail, /ICP not configured for any sub-product/)
    const partial = icpStep(product({ offers: [sub(true), sub(false, 'Plant Dashboard')], sub_products_without_icp: [{ offer_id: 'EB-02', name: 'Plant Dashboard', problems: [] }] }))
    assert.equal(partial.state, 'todo')
    assert.match(partial.detail, /1 of 2 sub-products have an ICP: Plant Dashboard still need one/)
    assert.equal(icpStep(product({ offers: [sub(true), sub(true)] })).state, 'done')
  })

  it('a product-level ICP state does not make the step done or a problem: only the sub-products do', () => {
    assert.equal(states(product({ state: 'invalid' })).icp, 'todo')
    assert.equal(states(product({ state: 'ready', ready: true })).icp, 'todo', 'ready by derivation still needs every sub-product set up for the step to be done')
  })

  it('marks everything done only from stored facts', () => {
    const sub = { id: 1, icp_ready: true, icp_models: { b2b: { ready: true, configured: true, missing: [] } } } as unknown as ProductInfo['offers'][number]
    const p = product({ ready: true, state: 'ready', target_accounts: 389, contacts: 53, offers: [sub] })
    assert.deepEqual(states(p), { offers: 'done', icp: 'done', accounts: 'done', generate: 'done' })
    assert.match(setupSteps(p).find((s) => s.key === 'accounts')!.detail, /389 loaded \(53 with a contact name\)/)
  })

  it('treats target accounts as recommended, never as a blocker', () => {
    assert.equal(setupSteps(product({ ready: true, state: 'ready' })).find((s) => s.key === 'accounts')!.optional, true)
  })
})
