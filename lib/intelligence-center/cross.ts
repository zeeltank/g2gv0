/**
 * Cross-functional findings ("Possible relationships"), as the frontend reads and words them.
 *
 * Contract with the backend (the backend files were not present when this was written; see the stage report): detector ids `cross.*`, domain `cross`,
 * categories `cross_*`, confidence `rule_based`, evidence made of the two observed sets (entity references and/or metrics, one entity type per set).
 *
 * Honesty rules enforced here, and tested:
 *   - every such finding carries the label CROSS_LABEL: a possible relationship, requires verification, no cause established;
 *   - they appear on Global Intelligence only, never inside a module page;
 *   - a deep link is drawn only when it passes safeDeepLink AND resolves to a screen this product verifiably has (verifiedDeepLink);
 *   - when no cross check reports, or none could assess, the page says which of the availability states applies: it never invents a finding.
 */
import type { Insight } from '../../services/intelligence/types'
import { allModuleLinks, isCrossInsight } from './domains'
import { COVERAGE_REGISTRY } from './coverage-registry'
import { safeDeepLink } from './model'

export const CROSS_LABEL = 'Possible relationship — requires verification, no cause established'
export const CROSS_SECTION_TITLE = 'Possible relationships'
export const CROSS_SECTION_NOTE = 'Two things that were observed together. They are not shown to cause one another, and nothing here has been verified.'

/** Record pages that are verified to exist (see entity-links.ts). */
const RECORD_PAGES: readonly RegExp[] = [/^\/module\/crm\/sales\/(opportunities|invoices)\/[1-9]\d{0,11}$/, /^\/organization\/departments\/[1-9]\d{0,11}$/]

let cache: ReadonlySet<string> | null = null
function verifiedPaths(): ReadonlySet<string> {
  if (!cache) {
    cache = new Set([
      ...allModuleLinks().map((link) => link.href),
      ...COVERAGE_REGISTRY.flatMap((row) => (row.route && row.state !== 'excluded' ? [row.route] : [])),
    ])
  }
  return cache
}

/** True when this in-app path is one of the screens the taxonomy and the coverage registry verify (or a verified record page). */
export function isVerifiedRoute(path: string): boolean {
  const bare = path.split(/[?#]/)[0]
  return verifiedPaths().has(bare) || RECORD_PAGES.some((pattern) => pattern.test(bare))
}

/** The link of a cross-functional finding: an in-app path that is also a verified screen, otherwise null (the card then says there is no screen to open). */
export function verifiedDeepLink(link: string | null | undefined): string | null {
  const safe = safeDeepLink(link)
  return safe !== null && isVerifiedRoute(safe) ? safe : null
}

export function isCrossFinding(insight: Pick<Insight, 'detector' | 'domain'>): boolean {
  return isCrossInsight(insight)
}

export function crossFindings(insights: readonly Insight[]): Insight[] {
  return insights.filter(isCrossFinding)
}

export function withoutCross(insights: readonly Insight[]): Insight[] {
  return insights.filter((insight) => !isCrossFinding(insight))
}

/** The two observed sets of a finding: the entity references grouped by kind (first two kinds), with the metrics listed apart. */
export function observedSetCount(insight: Pick<Insight, 'evidence'>): number {
  return new Set(insight.evidence.flatMap((item) => (item.kind === 'entity' ? [item.entity_type] : []))).size
}
