import { formatDay } from '@/lib/signal-review/signal-display'
import type { Org360, OrgAccountItem, OrgLifecycle, OrgLinkBasis, OrgMeta, OrgSourcePointer, OrgSourceType, OrgSuggestion } from '@/services/org-accounts/types'

/**
 * Words and small rules for the Organisation 360 parts of the Organizations screen: what a lifecycle is called, which source badges an organisation has,
 * how a link is explained, what the score and the places of a possible duplicate mean, which rows the Linked records card shows, the "why now" facts, and
 * which actions the server's `meta.can` allows. Pure, so each is tested without a browser.
 */

export const NO_VALUE = '—'

// ── Lifecycle ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const LIFECYCLE_LABELS: Record<OrgLifecycle, string> = {
  discovered: 'Discovered',
  target: 'Target',
  engaged: 'Engaged',
  customer: 'Customer',
  archived: 'Archived',
}

export function lifecycleLabel(lifecycle: OrgLifecycle): string {
  return LIFECYCLE_LABELS[lifecycle] ?? String(lifecycle)
}

// ── Sources ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type SourceKey = 'crm' | 'gtm' | 'signals'

export interface SourceBadge {
  key: SourceKey
  label: string
  /** A fact about that source row: the account number, the GTM stage, the count of open signals. */
  detail: string | null
}

const SOURCE_LABELS: Record<SourceKey, string> = { crm: 'CRM', gtm: 'GTM', signals: 'Signals' }

/** "1 open signal", "4 open signals". */
export function openSignalsText(count: number): string {
  return `${count} open ${count === 1 ? 'signal' : 'signals'}`
}

/** One badge for each source the organisation HAS a row in, and none for a source it lacks: a badge says "this is known there". */
export function sourceBadges(item: Pick<OrgAccountItem, 'sources'>): SourceBadge[] {
  const badges: SourceBadge[] = []
  const { crm, gtm, signals } = item.sources
  if (crm) badges.push({ key: 'crm', label: SOURCE_LABELS.crm, detail: crm.account_no })
  if (gtm) badges.push({ key: 'gtm', label: SOURCE_LABELS.gtm, detail: gtm.stage })
  if (signals) badges.push({ key: 'signals', label: SOURCE_LABELS.signals, detail: openSignalsText(signals.open_signals) })
  return badges
}

const BASIS_TEXT: Record<OrgLinkBasis, string> = {
  existing_link: 'linked by an earlier link',
  exact_name: 'linked because the names are identical',
  exact_domain: 'linked because the websites are the same',
  manual: 'confirmed by a person',
}

/** What an organisation says when its only record is the one it was found by: there is nothing to have linked, so there is no reason to give. */
export const ONLY_RECORD_TEXT = 'the only record found for this organisation'

/**
 * Why a source row is tied to the organisation, in words. A lone record has no link to explain (`onlyRecord`), so it says that instead of
 * "reason not recorded"; a record of a larger organisation whose basis is missing still admits it.
 */
export function basisText(basis: OrgLinkBasis | null | undefined, onlyRecord = false): string {
  if (basis) return BASIS_TEXT[basis] ?? 'linked'
  return onlyRecord ? ONLY_RECORD_TEXT : 'linked, reason not recorded'
}

const SOURCE_TYPE_LABELS: Record<OrgSourceType, string> = {
  crm_organization: 'CRM organisation',
  gtm_account: 'GTM account',
  g2g_company: 'Signals company',
}

export function sourceTypeLabel(type: OrgSourceType): string {
  return SOURCE_TYPE_LABELS[type] ?? String(type)
}

/** What a missing source says, so an empty row is an answer and not a blank. */
export const MISSING_SOURCE_TEXT: Record<SourceKey, string> = {
  crm: 'No CRM organisation yet',
  gtm: 'No GTM account found',
  signals: 'No Signals company found',
}

export interface LinkedRecordRow {
  key: SourceKey
  /** "CRM organisation", "GTM account" or "Signals company". */
  label: string
  found: boolean
  /** The name that record has, or null when there is none. */
  name: string | null
  /** A few facts about that record in one line, or null. */
  detail: string | null
  /** Why it is linked, in words; null when there is no record. */
  basis: string | null
}

const countText = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The rows of the Linked records card: the CRM organisation, the GTM account and the Signals company this organisation is, each with the reason it is
 * tied to the others. A source with no record is still a row, and says so.
 */
export function linkedRecords(org: Org360): LinkedRecordRow[] {
  const { links } = org.identity
  const pointers: Array<[SourceKey, OrgSourcePointer | null]> = [['crm', links.crm], ['gtm', links.gtm], ['signals', links.company]]
  const held = pointers.filter(([, pointer]) => pointer !== null).length
  const basisFor = (pointer: OrgSourcePointer | null) => (pointer ? basisText(pointer.basis, held === 1) : null)

  const crm = org.crm
  const gtm = org.gtm
  const company = org.company
  return [
    {
      key: 'crm', label: 'CRM organisation', found: crm !== null, name: crm?.name ?? null, basis: basisFor(links.crm),
      detail: crm ? [crm.account_no, crm.industry, [crm.billing_city, crm.billing_state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || null : null,
    },
    {
      key: 'gtm', label: 'GTM account', found: gtm !== null, name: gtm?.name ?? null, basis: basisFor(links.gtm),
      detail: gtm
        ? [gtm.stage ? `Stage: ${gtm.stage}` : null, countText(gtm.deals_count, 'deal', 'deals'), gtm.icp_fit_score !== null ? `Fit with the ideal customer: ${gtm.icp_fit_score}` : null].filter(Boolean).join(' · ')
        : null,
    },
    {
      key: 'signals', label: 'Signals company', found: company !== null, name: company?.name ?? null, basis: basisFor(links.company),
      detail: company
        ? [company.industry, [company.location, company.state].filter(Boolean).join(', '), countText(org.signals.total, 'signal', 'signals')].filter(Boolean).join(' · ')
        : null,
    },
  ]
}

// ── Possible duplicates ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "75% of the name words match": a share of the words, not a probability that the two are the same. */
export function scoreText(score: number): string {
  const percent = Math.max(0, Math.min(100, Math.round((Number.isFinite(score) ? score : 0) * 100)))
  return `${percent}% of the name words match`
}

/** "Different places: Surat / Mumbai" for a pair that says it is in two places that share no word; null for every other pair. */
export function placeConflictText(suggestion: Pick<OrgSuggestion, 'place_conflict' | 'left' | 'right'>): string | null {
  if (!suggestion.place_conflict) return null
  const places = [suggestion.left.place, suggestion.right.place].filter((place): place is string => Boolean(place))
  return places.length === 2 ? `Different places: ${places[0]} / ${places[1]}` : 'Different places'
}

/** What a pair that can only be marked as different says, in place of the Confirm button. */
export const NOT_CONFIRMABLE_TEXT = 'Both are Signals companies. One organisation holds only one record of each kind, so these two can only be marked as different.'

// ── Capped lists ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What a list of `shown` rows says about `total` rows. A list the server capped must say so ("Showing 20 of 45"); only a complete one may say it
 * shows all. A total smaller than the rows in hand is not believed.
 */
export function shownText(shown: number, total: number): string {
  const all = Math.max(total, shown)
  return all > shown ? `Showing ${shown} of ${all}` : `Showing all ${shown}`
}

// ── Why now ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WhyNowFact {
  key: 'signals' | 'next_event' | 'deals' | 'last_activity'
  label: string
  value: string
}

/** The four facts of the strip: counts as text (a real 0 is an answer), and a missing date says so in words. */
export function whyNowFacts(why: Org360['why_now']): WhyNowFact[] {
  return [
    { key: 'signals', label: 'Open signals', value: String(why.open_signals) },
    { key: 'next_event', label: 'Next event', value: formatDay(why.next_event_date) ?? 'None dated' },
    { key: 'deals', label: 'Open deals', value: String(why.open_deals) },
    { key: 'last_activity', label: 'Last activity', value: formatDay(why.last_activity_at) ?? 'None yet' },
  ]
}

// ── Actions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AvailableActions {
  edit: boolean
  createCrm: boolean
  confirmLinks: boolean
}

/** What this person may do here. Nothing is offered until the server's `meta` has said so. */
export function availableActions(meta: OrgMeta | null | undefined): AvailableActions {
  const can = meta?.can
  return {
    edit: Boolean(can?.edit),
    confirmLinks: Boolean(can?.confirm_links),
    createCrm: Boolean(can?.create_crm_organization),
  }
}

// ── Money ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return NO_VALUE
  return `${currency ?? ''} ${amount.toFixed(2)}`.trim()
}
