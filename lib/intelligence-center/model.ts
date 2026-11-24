/**
 * The words and rules of the Intelligence screens, as pure functions (no React, no browser), so they are tested without rendering anything.
 *
 * House rules this file enforces, because every one of them has been broken somewhere in this product before:
 *   - A number the server did not send is never invented, and "not recorded" / "not enough data" is never turned into zero.
 *   - Measured, rule-based and AI-estimate are always labelled as different kinds of statement; an estimate says it is not a measured fact.
 *   - A status is a WORD (the colour only helps).
 *   - A link from an insight is an in-app path or nothing: an absolute URL, a protocol-relative URL or a script is refused.
 */
import type {
  DetectorState,
  DetectorSummary,
  Insight,
  InsightConfidence,
  InsightCoverage,
  InsightEvidence,
  InsightSeverity,
  InsightsMeta,
} from '../../services/intelligence/types'

/* ── severity ─────────────────────────────────────────────────────────── */

/** Least to most urgent: the server's own order. */
export const SEVERITY_ORDER: readonly InsightSeverity[] = ['info', 'attention', 'high', 'critical']

export const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  info: 'For information',
  attention: 'Needs a look',
  high: 'High priority',
  critical: 'Critical',
}

export function severityRank(severity: InsightSeverity): number {
  return SEVERITY_ORDER.indexOf(severity)
}

export function severityLabel(severity: InsightSeverity): string {
  return SEVERITY_LABEL[severity] ?? 'For information'
}

/** Most urgent first; then newest; then by title so the order never depends on how the server happened to list them. */
export function sortInsights(insights: readonly Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity)
    if (bySeverity !== 0) return bySeverity
    const byDate = Date.parse(b.as_of) - Date.parse(a.as_of)
    if (Number.isFinite(byDate) && byDate !== 0) return byDate
    return a.title.localeCompare(b.title)
  })
}

/** "Needs attention" is high and critical: the two a person should act on, not read later. */
export function needsAttention(insights: readonly Insight[]): Insight[] {
  return sortInsights(insights.filter((i) => i.severity === 'high' || i.severity === 'critical'))
}

/* ── confidence ───────────────────────────────────────────────────────── */

export interface ConfidenceLabel {
  label: string
  /** One short line that says what kind of statement this is. */
  note: string
  /** True only for the kind that must never be read as a fact. */
  isEstimate: boolean
}

export function confidenceLabel(confidence: InsightConfidence): ConfidenceLabel {
  switch (confidence) {
    case 'measured':
      return { label: 'Measured', note: 'Counted from your records.', isEstimate: false }
    case 'rule_based':
      return { label: 'Rule-based', note: 'A fixed rule applied to your records.', isEstimate: false }
    case 'ai_estimate':
      return { label: 'AI estimate', note: 'Estimate, not a measured fact.', isEstimate: true }
    default:
      // An unknown value is neither a measured fact nor an AI estimate: it is named for what it is, an unclassified statement.
      return { label: 'Unclassified', note: 'The kind of statement was not recognised.', isEstimate: false }
  }
}

/* ── coverage ─────────────────────────────────────────────────────────── */

export const NOT_ENOUGH_DATA = 'Not enough data to assess'

export interface CoverageText {
  sufficient: boolean
  /** The headline: "Based on 12 of 15 …" or "Not enough data to assess". */
  headline: string
  /** The server's own reason when the data is not enough; otherwise null. */
  reason: string | null
}

function count(n: number): string {
  return n.toLocaleString('en-GB')
}

export function coverageText(coverage: InsightCoverage): CoverageText {
  if (!coverage.sufficient) {
    return { sufficient: false, headline: NOT_ENOUGH_DATA, reason: coverage.reason ?? 'The data recorded so far is too thin to assess this.' }
  }
  const basis = coverage.basis.trim()
  const subject = basis === '' ? 'records' : basis
  // The server withholds exact counts from viewers a small-group rule applies to (they would reveal how small a team is): say what it is based on, no numbers.
  if (coverage.observed === null) {
    return { sufficient: true, headline: `Based on ${subject}`, reason: null }
  }
  if (coverage.expected !== null && coverage.expected > 0) {
    const pct = coverage.percent !== null ? ` (${Math.round(coverage.percent)}%)` : ''
    return { sufficient: true, headline: `Based on ${count(coverage.observed)} of ${count(coverage.expected)} ${subject}${pct}`, reason: null }
  }
  return { sufficient: true, headline: `Based on ${count(coverage.observed)} ${subject}`, reason: null }
}

/* ── time ─────────────────────────────────────────────────────────────── */

/** "21 Nov 2026, 09:30 UTC". The server's timestamp is UTC; the screen says so rather than guessing a time zone. */
export function formatAsOf(iso: string | null | undefined): string {
  if (!iso) return 'Time not recorded'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 'Time not recorded'
  const d = new Date(ms)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return `${date}, ${time} UTC`
}

/* ── deep links ───────────────────────────────────────────────────────── */

/**
 * The only way a deep link reaches an `href`. Accepts an in-app path: one leading slash, then no second slash, no backslash, no scheme, no control
 * character and no whitespace. Everything else is refused (null), so a tampered or mistaken value can never send a person to another site or run a script.
 */
export function safeDeepLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string') return null
  const value = link.trim()
  if (value === '' || value !== link) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f\s]/.test(value)) return null
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null
  return value
}

const MODULE_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ['/gtm', 'GTM'],
  ['/signal-review', 'Signals'],
  ['/signals', 'Signals'],
  ['/portfolio', 'Portfolio'],
  ['/module/crm', 'CRM'],
  ['/module/lms', 'Learning'],
  ['/module/talent', 'Talent'],
  ['/module/agentic-ai', 'Agentic AI'],
  ['/platform-services', 'Platform Services'],
  ['/ai', 'AI console'],
  ['/module/hrit-solutions', 'HR Operations'],
  ['/module/task-management', 'Task Management'],
  ['/module/capability-intelligence', 'Capability'],
  ['/module/organizational-management', 'Organization'],
  ['/intelligence', 'Intelligence'],
  ['/dashboard/attendance', 'Attendance'],
  ['/dashboard/leave-management', 'Leave'],
  ['/dashboard/leave', 'Leave'],
  ['/organization', 'Organization'],
  ['/dashboard', 'Dashboard'],
]

/** "Open in GTM" for the link's module; a link into a module we do not name says "Open the record". */
export function openLabel(link: string | null): string {
  if (!link) return 'Open the record'
  const hit = MODULE_BY_PREFIX.find(([prefix]) => link === prefix || link.startsWith(`${prefix}/`) || link.startsWith(`${prefix}?`))
  return hit ? `Open in ${hit[1]}` : 'Open the record'
}

/* ── evidence ─────────────────────────────────────────────────────────── */

export function formatMetricValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'not recorded'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-GB') : 'not recorded'
  return value
}

/** One line of evidence, in words. A reference to a record carries no name: the screen has only its kind and id. */
export function evidenceLine(item: InsightEvidence): string {
  switch (item.kind) {
    case 'metric': {
      const unit = item.unit ? ` ${item.unit}` : ''
      const value = formatMetricValue(item.value)
      return `${item.label}: ${value}${value === 'not recorded' ? '' : unit}`
    }
    case 'window':
      return `${item.label}: ${item.from} to ${item.to}`
    case 'entity':
      return `${item.label} (record ${item.entity_id})`
    default:
      return ''
  }
}

/** Where the numbers came from, for the small print under the evidence (deduplicated, in the server's words). */
export function evidenceSources(evidence: readonly InsightEvidence[]): string[] {
  const seen = new Set<string>()
  for (const item of evidence) {
    if (item.kind === 'metric' && item.source) seen.add(item.source)
  }
  return [...seen]
}

/* ── domains, audience ────────────────────────────────────────────────── */

export const AUDIENCE_LABEL: Record<Insight['audience'], string> = {
  self: 'About you',
  team: 'Your direct reports',
  department: 'Your department',
  organization: 'Whole organisation',
}

/* ── detector states, empty wording ───────────────────────────────────── */

/** The states behind an answer, whichever shape the server used (a list, or a map of detector id -> state). Empty when the server did not say. */
export function statesOf(meta: InsightsMeta | undefined): DetectorState[] {
  const raw = meta?.states
  if (!raw) return []
  if (Array.isArray(raw)) return [...raw]
  // The server reports a COUNT per state ({ ok: 3, insufficient_data: 2, ... }); expand it so each detector is one entry.
  // A map of detector id -> state also works. Anything unrecognised is ignored, never turned into a state.
  const known = KNOWN_STATES
  const out: DetectorState[] = []
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && known.includes(key as DetectorState)) {
      const times = Math.max(0, Math.min(Math.floor(value), 1000))
      for (let i = 0; i < times; i++) out.push(key as DetectorState)
    } else if (typeof value === 'string' && known.includes(value as DetectorState)) {
      out.push(value as DetectorState)
    }
  }
  return out
}

export type EmptyVerdict = 'all_ok' | 'all_insufficient' | 'all_error' | 'all_unavailable' | 'all_restricted' | 'mixed' | 'unknown'

/**
 * What an EMPTY list means. "Nothing needs attention" is only true when the checks ran and found nothing; if the checks could not run for lack of data it
 * says so, and if the server did not tell us the states we do not claim either.
 */
export function emptyVerdict(states: readonly DetectorState[]): EmptyVerdict {
  const relevant = states.filter((s) => s !== 'not_applicable')
  if (relevant.length === 0) return 'unknown'
  if (relevant.every((s) => s === 'ok')) return 'all_ok'
  if (relevant.every((s) => s === 'insufficient_data')) return 'all_insufficient'
  if (relevant.every((s) => s === 'error')) return 'all_error'
  if (relevant.every((s) => s === 'data_unavailable')) return 'all_unavailable'
  if (relevant.every((s) => s === 'access_restricted')) return 'all_restricted'
  return 'mixed'
}

export function emptyWording(verdict: EmptyVerdict): { title: string; detail: string } {
  switch (verdict) {
    case 'all_ok':
      return { title: 'Nothing needs attention', detail: 'The checks ran on the data recorded so far and found nothing to flag.' }
    case 'all_insufficient':
      return { title: 'Not enough data to assess yet', detail: 'The data recorded so far is too thin for these checks. That is not the same as everything being fine.' }
    case 'all_error':
      return { title: 'These checks could not be completed right now', detail: 'Nothing was assessed. Try again in a moment.' }
    case 'all_unavailable':
      return { title: 'The data for these checks is unavailable', detail: 'The data they need could not be read, so nothing was assessed. That is not zero records and not an all-clear.' }
    case 'all_restricted':
      return { title: 'Access restricted', detail: 'The server reported that you may not see these checks. Nothing is shown and nothing is implied.' }
    case 'mixed':
      return { title: 'Nothing is flagged', detail: 'Some checks did not have enough data yet, so this is not a full all-clear.' }
    default:
      return { title: 'No insights to show right now', detail: 'This does not mean everything is fine: the screen was not told how many checks could run.' }
  }
}

export const STATE_LABEL: Record<DetectorState, string> = {
  ok: 'Checked',
  insufficient_data: 'Not enough data',
  not_applicable: 'Not applicable',
  data_unavailable: 'Data unavailable',
  access_restricted: 'Access restricted',
  error: 'Could not run',
}

/** The states this screen understands. */
export const KNOWN_STATES: readonly DetectorState[] = ['ok', 'insufficient_data', 'not_applicable', 'data_unavailable', 'access_restricted', 'error']

/** A state from the server that this screen does not know (a newer or a legacy value). It is shown as "not recognised": never as checked, zero or healthy. */
export const UNRECOGNISED_STATE = 'unrecognised' as const
export type SafeState = DetectorState | typeof UNRECOGNISED_STATE

export function normalizeState(state: unknown): SafeState {
  return typeof state === 'string' && (KNOWN_STATES as readonly string[]).includes(state) ? (state as DetectorState) : UNRECOGNISED_STATE
}

export function stateLabel(state: unknown): string {
  const safe = normalizeState(state)
  return safe === UNRECOGNISED_STATE ? 'State not recognised' : STATE_LABEL[safe]
}

/** Detectors that could not assess at all, listed first on the Evidence & coverage view so a gap is never hidden below a long list of fine ones. */
export function sortDetectors(detectors: readonly DetectorSummary[]): DetectorSummary[] {
  const weight: Record<SafeState, number> = { unrecognised: 0, error: 0, data_unavailable: 0, access_restricted: 1, insufficient_data: 1, ok: 2, not_applicable: 3 }
  return [...detectors].sort((a, b) => weight[normalizeState(a.state)] - weight[normalizeState(b.state)] || a.title.localeCompare(b.title))
}

/* ── provisional notice ───────────────────────────────────────────────── */

export const PROVISIONAL_NOTICE =
  'The thresholds behind these insights are provisional. They are proposals that will be calibrated against real data, so treat them as prompts to look, not as conclusions.'

/** The server's own note when it sent one, otherwise the standard wording. */
export function provisionalNotice(meta: InsightsMeta | undefined): string {
  const note = meta?.thresholds_note?.trim()
  return note ? note : PROVISIONAL_NOTICE
}

export function suppressedNotice(meta: InsightsMeta | undefined): string | null {
  const n = meta?.suppressed_count
  // For viewers the small-group rule applies to, the server withholds the exact count (it would reveal that something exists and how small the group is)
  // and sends a fixed generic note instead. Viewers it does not apply to get the count.
  if (typeof n !== 'number' && typeof meta?.suppression_note === 'string' && meta.suppression_note.trim() !== '') return meta.suppression_note
  if (typeof n !== 'number' || n <= 0) return null
  return 'Some insights are not shown because they concern too few people to share without identifying them.'
}
