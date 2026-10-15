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

  it('tells a saved-but-inactive ICP from a missing one', () => {
    const icp = setupSteps(product({ draft_icp: { id: 1, name: 'EB' } })).find((s) => s.key === 'icp')!
    assert.match(icp.detail, /not active/)
  })

  it('flags an invalid ICP as a problem, not as todo', () => {
    assert.equal(states(product({ state: 'invalid' })).icp, 'problem')
  })

  it('marks everything done only from stored facts', () => {
    const p = product({ ready: true, state: 'ready', target_accounts: 389, contacts: 53, offers: [{ id: 1 } as ProductInfo['offers'][number]] })
    assert.deepEqual(states(p), { offers: 'done', icp: 'done', accounts: 'done', generate: 'done' })
    assert.match(setupSteps(p).find((s) => s.key === 'accounts')!.detail, /389 loaded \(53 with a contact name\)/)
  })

  it('treats target accounts as recommended, never as a blocker', () => {
    assert.equal(setupSteps(product({ ready: true, state: 'ready' })).find((s) => s.key === 'accounts')!.optional, true)
  })
})
