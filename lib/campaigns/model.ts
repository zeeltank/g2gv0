import { readableText, whole } from '@/lib/leads/model'
import type { PmOption } from '@/services/product-master/types'
import type {
  Campaign, CampaignCrmRef, CampaignFunnel, CampaignGtmRef, CampaignLeadsRef, CampaignProductRef, Lead, LeadCampaignRef,
} from '@/types/crm'

/**
 * The rules of the campaign screens' agentic additions (slice 9, hp_erp docs/agentic-crm/slices/S09-campaigns-to-leads.md) that need no browser: how the
 * server's new fields are read, what the funnel says in words and numbers, when the Product column shows, what the Product choice offers and sends, and the
 * sentences that say what a campaign is linked to. Tested on their own (lib/campaigns/model.test.ts).
 *
 * Nothing here is allowed to need the backend: every new field is optional and a missing key means "this server does not say", never "none". `whole` and
 * `readableText` are the Leads screen's own readers (lib/leads/model.ts), reused and not copied.
 */

// ── Reading the server's answer ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)

/** The first of these names the object has, so the contract's snake_case and the presenter's camelCase are both read. `found` tells "sent as null" from "not sent". */
function pick(source: Record<string, unknown>, ...names: string[]): { found: boolean; value: unknown } {
  for (const name of names) if (name in source) return { found: true, value: source[name] }
  return { found: false, value: undefined }
}

/** A count: a whole number from 0 up, from a number or a string of digits. Anything else (negative, 1.5, "abc", null) is not a count (null). */
export function count(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}

function readProduct(value: unknown): CampaignProductRef | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return { id, key: readableText(r.key), name: readableText(r.name) ?? `Product #${id}` }
}

/**
 * The funnel as the server counted it. `targets` must be a count, else the answer is not a funnel (null). A stage the answer leaves out or cannot be read as a
 * count is 0: the server counts "none recorded" as 0, and a host that lacks a touchpoint column answers 0 for it.
 */
function readFunnel(value: unknown): CampaignFunnel | null {
  const r = record(value)
  const targets = r ? count(r.targets) : null
  if (!r || targets === null) return null
  const stage = (...names: string[]) => count(pick(r, ...names).value) ?? 0
  return {
    targets,
    sent: stage('sent'),
    opened: stage('opened'),
    replied: stage('replied'),
    meetings: stage('meetings'),
    converted: stage('converted'),
    optedOut: stage('opted_out', 'optedOut'),
  }
}

function readGtmCampaign(value: unknown): CampaignGtmRef | null {
  const r = record(value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return null
  return { id, name: readableText(r.name) ?? `GTM campaign #${id}`, status: readableText(r.status) }
}

function readLeads(value: unknown): CampaignLeadsRef | null {
  const r = record(value)
  const n = r ? count(r.count) : null
  return n === null ? null : { count: n }
}

/**
 * The fields slice 9 adds to a campaign, read from whatever the server sent. Only the fields the server SENT are in the answer: a key it left out stays out,
 * so the screens can tell an older server (no key) from a campaign with nothing to show (`null`).
 */
export function readCampaignExtras(raw: unknown): Pick<Campaign, 'product' | 'funnel' | 'gtmCampaign' | 'leads'> {
  const source = record(raw) ?? {}
  const out: Pick<Campaign, 'product' | 'funnel' | 'gtmCampaign' | 'leads'> = {}

  const product = pick(source, 'product')
  if (product.found) out.product = readProduct(product.value)

  const funnel = pick(source, 'funnel')
  if (funnel.found) out.funnel = readFunnel(funnel.value)

  const gtm = pick(source, 'gtm_campaign', 'gtmCampaign')
  if (gtm.found) out.gtmCampaign = readGtmCampaign(gtm.value)

  const leads = pick(source, 'leads')
  if (leads.found) out.leads = readLeads(leads.value)

  return out
}

/** A campaign as the server sent it, with the fields of slice 9 read into the names the screens use. */
export function withCampaignExtras(raw: Campaign): Campaign {
  return { ...raw, ...readCampaignExtras(raw) }
}

/**
 * What a GTM campaign's detail answer says it is linked to (slice 9, decision D9): `product: {id, key, name}|null` and `crm_campaign: {id, name, status}|null`,
 * both beside `campaign`, `members` and `metrics`. Only what was sent is in the answer; a key left out is "this server does not say" and the GTM screen then
 * draws no line for it.
 */
export function readGtmLinks(raw: unknown): { product?: CampaignProductRef | null; crmCampaign?: CampaignCrmRef | null } {
  const source = record(raw) ?? {}
  const out: { product?: CampaignProductRef | null; crmCampaign?: CampaignCrmRef | null } = {}

  const product = pick(source, 'product')
  if (product.found) out.product = readProduct(product.value)

  const crm = pick(source, 'crm_campaign', 'crmCampaign')
  if (crm.found) {
    const r = record(crm.value)
    const id = r ? whole(r.id) : null
    out.crmCampaign = r && id !== null ? { id, name: readableText(r.name) ?? `CRM campaign #${id}`, status: readableText(r.status) } : null
  }
  return out
}

/** The campaign a lead first came from (`campaign: {id, name}|null`). Sent as null is "none"; a key left out is "this server does not say". */
export function readLeadCampaign(raw: unknown): Pick<Lead, 'campaign'> {
  const source = record(raw) ?? {}
  const campaign = pick(source, 'campaign')
  if (!campaign.found) return {}
  const r = record(campaign.value)
  const id = r ? whole(r.id) : null
  if (!r || id === null) return { campaign: null }
  const read: LeadCampaignRef = { id, name: readableText(r.name) ?? `Campaign #${id}` }
  return { campaign: read }
}

/** A lead as the server sent it, with the campaign it came from read. */
export function withLeadCampaign(raw: Lead): Lead {
  return { ...raw, ...readLeadCampaign(raw) }
}

// ── The funnel ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type FunnelStepKey = 'targets' | 'sent' | 'opened' | 'replied' | 'meetings' | 'converted'

/** The share of the step before: a real percentage, or the reason there is none. */
export type FunnelShare =
  | { kind: 'share'; percent: number; of: string; above: boolean }
  /** The step before has none recorded, so there is nothing to divide by. */
  | { kind: 'none'; of: string }

export interface FunnelStep {
  key: FunnelStepKey
  label: string
  count: number
  /** null for the first step: nothing comes before it. */
  share: FunnelShare | null
  /** The share in words, the text a person reads beside the number; null for the first step and for a step with nothing before it and nothing itself. */
  shareText: string | null
  /** How wide to draw the bar: this step as a share of the targets, 0 to 100. The number is the truth; the bar only helps the eye. */
  barPercent: number
}

/** Opted out is not a step after Converted: it is people who asked to be left alone, so it stands apart and is measured against the targets. */
export interface FunnelOptOut {
  label: string
  count: number
  shareText: string | null
  barPercent: number
}

/** The funnel's stages in order, with the plain-English label the screen shows for each. */
export const FUNNEL_STEPS: ReadonlyArray<{ key: FunnelStepKey; label: string }> = [
  { key: 'targets', label: 'Targets' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'replied', label: 'Replied' },
  { key: 'meetings', label: 'Meetings booked' },
  { key: 'converted', label: 'Converted' },
]

/** "40% of sent". A share that rounds to 0 but is not 0 reads "less than 1%", so a real step never looks like none. */
function percentText(percent: number): string {
  return percent > 0 && percent < 1 ? 'less than 1%' : `${Math.round(percent)}%`
}

/**
 * This step as a share of the one before it. The step before having none recorded means there is nothing to divide by (never a division by zero, and never
 * a made-up 0% or 100%). A step ABOVE its predecessor is shown exactly as it is, over 100%, and flagged `above`: each touchpoint is recorded on its own, so a
 * target can have a reply recorded and no open, and hiding or capping that would misstate the data.
 */
export function stepShare(previous: number, current: number, previousLabel: string): FunnelShare {
  const of = previousLabel.toLowerCase()
  if (previous <= 0) return { kind: 'none', of }
  const percent = (current / previous) * 100
  return { kind: 'share', percent, of, above: current > previous }
}

export function shareText(share: FunnelShare | null, current: number): string | null {
  if (!share) return null
  if (share.kind === 'none') return current > 0 ? `no share: 0 ${share.of}` : null
  return `${percentText(share.percent)} of ${share.of}`
}

/** 0 to 100, for a bar: a step's share of the targets. A step with something recorded always shows a sliver (2%), so it does not look like none. */
export function barPercent(current: number, targets: number): number {
  if (targets <= 0 || current <= 0) return 0
  return Math.min(100, Math.max(2, (current / targets) * 100))
}

export interface FunnelView {
  /** No targets yet: the funnel has nothing to count, and says what to do. */
  empty: boolean
  /** Targets, but no touchpoint recorded on any of them. */
  quiet: boolean
  steps: FunnelStep[]
  optedOut: FunnelOptOut
  /** At least one step is higher than the one before it, so the screen explains why. */
  anyAbove: boolean
}

/** What the Funnel section shows. null when the server sent no funnel (an older server, or a campaign it could not read): the section is then not drawn. */
export function funnelView(funnel: CampaignFunnel | null | undefined): FunnelView | null {
  if (!funnel) return null
  const counts: Record<FunnelStepKey, number> = {
    targets: funnel.targets, sent: funnel.sent, opened: funnel.opened, replied: funnel.replied, meetings: funnel.meetings, converted: funnel.converted,
  }
  const steps: FunnelStep[] = FUNNEL_STEPS.map((step, index) => {
    const previous = index === 0 ? null : FUNNEL_STEPS[index - 1]
    const share = previous ? stepShare(counts[previous.key], counts[step.key], previous.label) : null
    return { key: step.key, label: step.label, count: counts[step.key], share, shareText: shareText(share, counts[step.key]), barPercent: barPercent(counts[step.key], funnel.targets) }
  })
  const optedShare = stepShare(funnel.targets, funnel.optedOut, 'Targets')
  const optedOut: FunnelOptOut = {
    label: 'Opted out',
    count: funnel.optedOut,
    shareText: shareText(optedShare, funnel.optedOut),
    barPercent: barPercent(funnel.optedOut, funnel.targets),
  }
  const recorded = funnel.sent + funnel.opened + funnel.replied + funnel.meetings + funnel.converted + funnel.optedOut
  return {
    empty: funnel.targets === 0,
    quiet: funnel.targets > 0 && recorded === 0,
    steps,
    optedOut,
    anyAbove: steps.some((step) => step.share?.kind === 'share' && step.share.above),
  }
}

export const FUNNEL_EMPTY_TEXT = 'No targets yet. Add leads, contacts or organizations on the Targets tab, and this funnel fills in as their activity is recorded.'
export const FUNNEL_QUIET_TEXT = 'Nothing has been recorded on these targets yet.'
/** What the numbers are, said once: they are what was recorded against each target, not what the mail log holds. */
export const FUNNEL_BASIS_TEXT = 'These counts come from what has been recorded against each target. The Num Sent figure under Campaign Details is counted from the mail log, so the two can differ.'
export const FUNNEL_ABOVE_TEXT = 'A step can be higher than the one before it: each event is recorded on its own, so a target can have a reply recorded without an open.'

// ── What a campaign is linked to ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const NO_PRODUCT_TEXT = 'No product chosen'

/** The product line of a campaign: null when the server did not say (the line is not drawn), else the name or "No product chosen". */
export function productText(product: CampaignProductRef | null | undefined): string | null {
  if (product === undefined) return null
  return product ? product.name : NO_PRODUCT_TEXT
}

/** "Diwali outreach (active)". */
function nameWithStatus(name: string, status: string | null): string {
  return status ? `${name} (${status})` : name
}

/** The GTM campaign that is the same campaign as this CRM one, as a sentence; null when the server did not say. */
export function gtmCampaignText(gtm: CampaignGtmRef | null | undefined): string | null {
  if (gtm === undefined) return null
  return gtm ? nameWithStatus(gtm.name, gtm.status) : 'None linked'
}

/** How many leads first came from this campaign, as a sentence; null when the server did not say. Plain text: the Leads screen has no campaign filter to link to. */
export function leadsText(leads: CampaignLeadsRef | null | undefined): string | null {
  if (!leads) return null
  if (leads.count === 0) return 'No leads have come from this campaign yet'
  return leads.count === 1 ? '1 lead first came from this campaign' : `${leads.count} leads first came from this campaign`
}

/** The CRM campaign a GTM campaign is the same as; null when the server did not say (the GTM screen then draws no line). */
export function crmCampaignText(crm: CampaignCrmRef | null | undefined): string | null {
  if (crm === undefined) return null
  return crm ? nameWithStatus(crm.name, crm.status) : 'Not linked to a CRM campaign'
}

/**
 * Where a CRM campaign's page is, given what the sidebar hook resolved the Campaigns menu row to. The hook answers '/dashboard' when the person's menu does
 * not hold the row, and then there is no page for them to be sent to: null, and the screen shows the name as plain text.
 */
export function crmCampaignHref(resolvedBase: string, id: number): string | null {
  const base = resolvedBase.trim().replace(/\/+$/, '')
  if (base === '' || base === '/dashboard') return null
  return `${base}/${id}`
}

/** "Campaign: Diwali outreach" under a lead's name; null when the lead came from no campaign or the server did not say. */
export function leadCampaignName(campaign: LeadCampaignRef | null | undefined): string | null {
  return campaign ? campaign.name : null
}

// ── The list's Product column ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Product column shows once any campaign the list has loaded has a product, and keeps its place while the person pages, so it does not come and go. */
export function noteProductSeen(seen: boolean, campaigns: readonly Pick<Campaign, 'product'>[]): boolean {
  return seen || campaigns.some((campaign) => !!campaign.product)
}

/** Columns of the table, for the rows that span it (loading, empty): the tick box and the five it has always had, plus Product when it shows. */
export const campaignColumnCount = (showProduct: boolean): number => 6 + (showProduct ? 1 : 0)

// ── The Product choice on the form ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Choice {
  value: string
  label: string
}

export const NO_PRODUCT_CHOICE = 'No product'

/**
 * "No product" and every product the Product Master lists. A product the campaign already has that the list does not hold (archived since) is kept under its
 * own name, so the box never shows a wrong value and a person can still clear it.
 */
export function productChoices(options: readonly PmOption[], current: CampaignProductRef | null): Choice[] {
  const choices: Choice[] = [{ value: '', label: NO_PRODUCT_CHOICE }, ...options.map((option) => ({ value: String(option.id), label: option.label }))]
  if (current && !choices.some((choice) => choice.value === String(current.id))) choices.push({ value: String(current.id), label: current.name })
  return choices
}

/** The Product choice is drawn when there is a product to choose, or one is already chosen (so it can be cleared). */
export const showProductChoice = (options: readonly PmOption[], current: CampaignProductRef | null): boolean => options.length > 0 || current !== null

/** The product a Product box value means: the id, or null for "No product" (and for anything that is not an id). */
export const chosenProduct = (value: string): number | null => whole(value)

/**
 * The product part of a create or edit request. Left out unless the person chose or changed it: a new campaign with no product sends nothing, an edit that
 * left the product alone sends nothing (so a form can never undo a link it did not show, and an older server that cannot store one is never asked to), and a
 * cleared product is sent as null.
 */
export function productPayload(originalId: number | null, chosenId: number | null, editing: boolean): { product_master_id?: number | null } {
  if (editing) return originalId === chosenId ? {} : { product_master_id: chosenId }
  return chosenId === null ? {} : { product_master_id: chosenId }
}
