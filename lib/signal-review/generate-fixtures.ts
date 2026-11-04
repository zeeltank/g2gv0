import assert from 'node:assert/strict'
import type { ProductInfo } from '../../services/portfolio/types'
import type { RunSnapshot } from '../../services/signal-review/signal-run-service'

/** Made-up products and runs for the "Generate signals" tests. */

export function run(over: Partial<RunSnapshot> = {}): RunSnapshot {
  return { id: 90, status: 'running', stage_message: null, queries_run: null, sources_found: null, opportunities_qualified: null, opportunities_new: null, error_message: null, ...over }
}

export function offer(over: Partial<ProductInfo['offers'][number]> = {}): ProductInfo['offers'][number] {
  return {
    id: 1, offer_id: 'SCH-11', name: 'Fees module', what_it_does: null, readiness_status: null, needs_solved: null, primary_segments: null, trigger_signals: null,
    pricing_model: null, typical_deal_band: null, icp_ready: true, ...over,
  }
}

export function product(over: Partial<ProductInfo> = {}): ProductInfo {
  return {
    key: 'scholar', label: 'Scholar', business_fit: 'scholar', portfolio_name: 'Scholar', offers: [], icp: null, target_accounts: 0, contacts: 0, ready: true,
    state: 'ready', next_step: null, draft_icp: null, missing: [], opportunities_count: 0, research_runs_count: 0, ...over,
  }
}

/** Two products: Scholar with two sub-products, and G2G whose B2B ICP is not set up. */
export function products(): ProductInfo[] {
  return [
    product({ offers: [offer(), offer({ id: 2, offer_id: 'SCH-12', name: 'Attendance', icp_ready: false })] }),
    product({
      key: 'g2g', label: 'G2G', business_fit: 'g2g', portfolio_name: 'G2G', ready: false, missing: ['Ideal customer'],
      icp_models: { b2b: { ready: false, missing: ['Ideal customer'], configured: true }, b2c: { ready: false, missing: [], configured: false }, b2g: { ready: true, missing: [], configured: true } },
    }),
  ]
}

/**
 * Presses the button with this label. A missing button fails the test on the spot: pressing 'nothing' inside React's act() leaves it unfinished, and the
 * test then hangs instead of failing.
 */
export async function pressButton(k: { withText(text: string): HTMLElement | null; click(el: Element): Promise<unknown> }, label: string): Promise<void> {
  const button = k.withText(label)
  assert.ok(button, `there is a "${label}" button`)
  await k.click(button)
}
