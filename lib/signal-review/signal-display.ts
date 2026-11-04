import type { SignalAssessment, SignalRow } from '@/services/signal-review/signal-types'
import type { DateInfo, ReviewStatus } from '@/services/signal-review/types'

/**
 * Words for the Signal Review list and drawer: what a status is called, what a date badge says, how the evidence is described. Pure, so the rules that
 * matter ("Follow-up" is shown as "Contacted", an undated signal says so and never shows a date) are tested without a browser.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "12 Oct 2026" from a `YYYY-MM-DD` day (a time after it is ignored). Built by hand so the month names do not change with the browser's language data.
 * Anything that is not a real calendar day is null: the badge must never print "Event NaN" or a made-up date.
 */
export function formatDay(value: string | null | undefined): string | null {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/.exec(value.trim()) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const real = new Date(Date.UTC(year, month - 1, day))
  if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null
  return `${day} ${MONTHS[month - 1]} ${year}`
}

// ── Date badge ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type DateBadgeKind = 'event' | 'published' | 'unknown'

export interface DateBadge {
  kind: DateBadgeKind
  text: string
}

export const DATE_UNKNOWN_TEXT = 'Date unknown'

/**
 * What the date badge says, and what KIND of date it is: "Event 12 Oct 2026" (the source states when it happens), "Published 3 Oct 2026" (only the
 * source's publication day is known) or "Date unknown". A status that claims a date the server did not send reads "Date unknown", never a blank date.
 */
export function dateBadge(info: DateInfo | null | undefined): DateBadge {
  const day = formatDay(info?.date)
  if (info?.status === 'event_date_stated' && day) return { kind: 'event', text: `Event ${day}` }
  if (info?.status === 'source_date_only' && day) return { kind: 'published', text: `Published ${day}` }
  return { kind: 'unknown', text: DATE_UNKNOWN_TEXT }
}

const PROVENANCE_WORDS: Record<string, string> = {
  structured_data: 'from the page’s data',
  meta_tag: 'from the page’s metadata',
  time_element: 'from the page',
  visible_absolute: 'from the page text',
  visible_relative: 'worked out from “posted N days ago”',
  search_provider: 'from the search provider',
}

/** How the date was found, in a sentence, for the drawer's Evidence section. */
export function dateExplanation(info: DateInfo | null | undefined, provenance?: string | null): string {
  const badge = dateBadge(info)
  if (badge.kind === 'event') return 'The source states the date the event happens or happened.'
  if (badge.kind === 'published') {
    const how = provenance ? PROVENANCE_WORDS[provenance] : undefined
    return `Only the day the source was published is known, not the day the event happens${how ? ` (${how})` : ''}.`
  }
  return 'No date could be found on the source, so how recent this is cannot be told.'
}

// ── Status ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type StatusChipTone = 'neutral' | 'warning' | 'success' | 'destructive'

export interface StatusChip {
  label: string
  tone: StatusChipTone
}

const STATUS_CHIPS: Record<ReviewStatus, StatusChip> = {
  New: { label: 'Needs decision', tone: 'neutral' },
  'Follow-up': { label: 'Contacted', tone: 'warning' },
  Reviewed: { label: 'Reviewed', tone: 'success' },
  Dismissed: { label: 'Not relevant', tone: 'destructive' },
}

/** What a stored `review_status` is called on this screen. `Follow-up` is the stored word; every screen says "Contacted". */
export function statusChip(status: ReviewStatus): StatusChip {
  return STATUS_CHIPS[status] ?? { label: String(status), tone: 'neutral' }
}

// ── Evidence ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const CLAIM_LEVEL_WORDS: Record<string, string> = {
  confirmed: 'Confirmed: the source itself says this',
  inference: 'Inferred: our reading of what the source says',
  hypothesis: 'A hypothesis: not yet backed by the source',
}

export function claimLevelText(level: string | null | undefined): string | null {
  return level ? (CLAIM_LEVEL_WORDS[level] ?? level) : null
}

/** A link is opened only when it is an http(s) address: a stored `javascript:` or `data:` URL must never become something a person can click. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** The wording copied from the source: the researcher's kept quote, else the imported excerpt, else nothing (the drawer says so). */
export function evidenceQuote(signal: Pick<SignalRow, 'assessment' | 'primary_source'>): string | null {
  const quote = signal.assessment?.provenance?.public_fact?.quote?.trim() || signal.primary_source?.excerpt?.trim()
  return quote || null
}

export function sourceLink(signal: Pick<SignalRow, 'source_url' | 'source_title' | 'primary_source' | 'assessment'>): { url: string; title: string } | null {
  const url = safeHttpUrl(signal.source_url) ?? safeHttpUrl(signal.primary_source?.url) ?? safeHttpUrl(signal.assessment?.provenance?.public_fact?.source_url)
  if (!url) return null
  const title = signal.source_title || signal.primary_source?.title || signal.assessment?.provenance?.public_fact?.source_title
  return { url, title: title?.trim() || new URL(url).hostname }
}

export function dateProvenance(assessment: SignalAssessment | null | undefined): string | null {
  return assessment?.evidence?.date_provenance ?? null
}

/** "2 Nov 2026 by run #81", or "2 Nov 2026, added by hand". Null when the signal has no first-seen day. */
export function firstSeenText(signal: Pick<SignalRow, 'first_discovered_at' | 'research_run_id' | 'entered_manually'>): string | null {
  const day = formatDay(signal.first_discovered_at)
  if (!day) return null
  if (signal.research_run_id) return `${day} by run #${signal.research_run_id}`
  return signal.entered_manually ? `${day}, added by hand` : day
}

/** "Score 24", or null when the signal was never scored. The scale is the server's own; no maximum is claimed. */
export function scoreText(signal: Pick<SignalRow, 'scores'>): string | null {
  const total = signal.scores?.total
  return typeof total === 'number' ? `Score ${total}` : null
}
