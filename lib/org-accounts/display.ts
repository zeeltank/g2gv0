import type { Org360, OrgAccountItem, OrgActivityLine, OrgLifecycle, OrgLinkBasis, OrgMeta, OrgSourcePointer, OrgSourceType } from '@/services/org-accounts/types'

/**
 * Words and small rules for the Organisation 360 screens: what a lifecycle is called, which source badges an organisation has, how a link is explained,
 * what the score of a possible duplicate means, and which actions the server's `meta.can` allows. Pure, so each is tested without a browser.
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

/** The StatusBadge variant for each lifecycle. The word always comes with it: the colour only helps. */
export type LifecycleTone = 'default' | 'processing' | 'pending' | 'success' | 'inactive'

const LIFECYCLE_TONES: Record<OrgLifecycle, LifecycleTone> = {
  discovered: 'default',
  target: 'processing',
  engaged: 'pending',
  customer: 'success',
  archived: 'inactive',
}

export function lifecycleTone(lifecycle: OrgLifecycle): LifecycleTone {
  return LIFECYCLE_TONES[lifecycle] ?? 'default'
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

/** Why a source row is tied to the organisation, in words. A pointer with no basis recorded says so instead of inventing a reason. */
export function basisText(basis: OrgLinkBasis | null | undefined): string {
  return basis ? (BASIS_TEXT[basis] ?? 'linked') : 'linked, reason not recorded'
}

export interface HeaderSource {
  key: SourceKey
  label: string
  basis: string
}

/** The badges of the detail header: one for each source the identity points at, with the reason it is linked. */
export function headerSources(links: Org360['identity']['links']): HeaderSource[] {
  const pointers: Array<[SourceKey, OrgSourcePointer | null]> = [['crm', links.crm], ['gtm', links.gtm], ['signals', links.company]]
  return pointers.flatMap(([key, pointer]) => (pointer ? [{ key, label: SOURCE_LABELS[key], basis: basisText(pointer.basis) }] : []))
}

const SOURCE_TYPE_LABELS: Record<OrgSourceType, string> = {
  crm_organization: 'CRM organisation',
  gtm_account: 'GTM account',
  g2g_company: 'Signals company',
}

export function sourceTypeLabel(type: OrgSourceType): string {
  return SOURCE_TYPE_LABELS[type] ?? String(type)
}

/** What a missing source says, so an empty card is an answer and not a blank. */
export const MISSING_SOURCE_TEXT: Record<SourceKey, string> = {
  crm: 'No CRM organisation yet',
  gtm: 'No GTM account yet',
  signals: 'No Signals company yet',
}

// ── Possible duplicates ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "75% of the name words match": a share of the words, not a probability that the two are the same. */
export function scoreText(score: number): string {
  const percent = Math.max(0, Math.min(100, Math.round((Number.isFinite(score) ? score : 0) * 100)))
  return `${percent}% of the name words match`
}

// ── Capped lists ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What a list of `shown` rows says about `total` rows. A list the server capped must say so ("Showing 20 of 45"); only a complete one may say it
 * shows all. A total smaller than the rows in hand is not believed.
 */
export function shownText(shown: number, total: number): string {
  const all = Math.max(total, shown)
  return all > shown ? `Showing ${shown} of ${all}` : `Showing all ${shown}`
}

// ── Actions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AvailableActions {
  edit: boolean
  createCrm: boolean
  confirmLinks: boolean
}

/**
 * What this person may do here. Nothing is offered until the server's `meta` has said so; the CRM organisation can be created only when the
 * organisation has none yet.
 */
export function availableActions(meta: OrgMeta | null | undefined, org?: Org360 | null): AvailableActions {
  const can = meta?.can
  return {
    edit: Boolean(can?.edit),
    confirmLinks: Boolean(can?.confirm_links),
    createCrm: Boolean(can?.create_crm_organization && org && org.identity.links.crm === null && org.crm === null),
  }
}

// ── Dates, money, activity ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return NO_VALUE
  return `${currency ?? ''} ${amount.toFixed(2)}`.trim()
}

const ACTIVITY_LABELS: Record<OrgActivityLine['kind'], string> = { note: 'Note', task: 'Task', decision: 'Decision', lead: 'Lead' }

export function activityKindLabel(kind: OrgActivityLine['kind']): string {
  return ACTIVITY_LABELS[kind] ?? String(kind)
}
