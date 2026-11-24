/**
 * Everything the Intelligence screens show, derived from the ONE snapshot the API gave (the detectors this person may see, and every open insight).
 * Pure functions, no React: so each rule below is tested on its own. Nothing is invented: a count is a count of what was loaded, a coverage figure is a
 * sum only where the server sent both numbers and the basis is the same, and "healthy" is said only when every check this person can see ran and found
 * nothing.
 */
import type { DetectorSummary, Insight, InsightSeverity, InsightsMeta } from '../../services/intelligence/types'
import {
  ALL_DOMAINS,
  allAreas,
  areaById,
  areaDetectorIds,
  areaHref,
  classifyInsight,
  DETECTOR_TITLE,
  isCrossDetector,
  domainDetectorIds,
  DOMAINS,
  stableKey,
  type AreaDef,
  type DomainDef,
  type Placement,
} from './domains'
import type { ModuleIntelligenceDef } from './modules'
import { coverageText, sortInsights, SEVERITY_ORDER } from './model'
import { AVAILABILITY } from './availability'
import { registrySummary } from './coverage-registry'
import { crossFindings, withoutCross } from './cross'

/* ── the snapshot ─────────────────────────────────────────────────────── */

export interface Snapshot {
  insights: Insight[]
  /** Only the detectors this person is authorised for: the server leaves the others out. */
  detectors: DetectorSummary[]
  meta: InsightsMeta
  /** True when the server has more insights than the screen was willing to load (see load-all). */
  truncated: boolean
  /** How many insights the server says exist for this person, when it said. */
  total: number | null
}

export function emptyCounts(): Record<InsightSeverity, number> {
  return { info: 0, attention: 0, high: 0, critical: 0 }
}

export function countBySeverity(insights: readonly Insight[]): Record<InsightSeverity, number> {
  const counts = emptyCounts()
  for (const i of insights) if (i.severity in counts) counts[i.severity] += 1
  return counts
}

/** High and critical: the two a person should act on rather than read later. */
export function attentionCount(counts: Record<InsightSeverity, number>): number {
  return counts.high + counts.critical
}

/* ── condition ────────────────────────────────────────────────────────── */

export type Condition =
  | 'needs_attention'
  | 'watch'
  | 'healthy'
  | 'no_findings'
  | 'not_enough_data'
  | 'not_available'
  | 'not_connected'
  | 'partial'
  | 'data_unavailable'
  | 'access_restricted'
  | 'not_assessed'
  | 'excluded'

export const CONDITION_LABEL: Record<Condition, string> = {
  needs_attention: 'Needs attention',
  watch: 'Watch',
  healthy: 'Healthy',
  no_findings: 'No findings shown',
  not_enough_data: 'Not enough data',
  not_available: 'Not available for your role',
  not_connected: 'Not connected',
  partial: AVAILABILITY.partial.label,
  data_unavailable: AVAILABILITY.data_unavailable.label,
  access_restricted: AVAILABILITY.access_restricted.label,
  not_assessed: AVAILABILITY.not_assessed.label,
  excluded: AVAILABILITY.excluded.label,
}

/** One sentence per condition, in fixed words. */
export const CONDITION_MEANING: Record<Condition, string> = {
  needs_attention: 'At least one finding is high priority or critical.',
  watch: 'Findings are open, none of them high priority or critical.',
  healthy: 'Every check you can see ran with enough data and found nothing to flag.',
  no_findings: 'No findings are shown here, but that is not an all-clear: see the note.',
  not_enough_data: 'The checks could not fully assess this yet. That is not the same as everything being fine.',
  not_available: 'None of the checks for this are open to your role.',
  not_connected: 'No intelligence source is connected to this yet.',
  partial: AVAILABILITY.partial.meaning,
  data_unavailable: AVAILABILITY.data_unavailable.meaning,
  access_restricted: AVAILABILITY.access_restricted.meaning,
  not_assessed: AVAILABILITY.not_assessed.meaning,
  excluded: AVAILABILITY.excluded.meaning,
}

export interface ConditionInput {
  insights: readonly Insight[]
  /** The detectors, of those this person may see, that feed this unit. */
  detectors: readonly DetectorSummary[]
  /** Whether detectors exist for this unit at all. */
  connected: boolean
  /** True for a new check: when none of its detectors has reported, the unit is "not yet assessed" (never "not available", never healthy). */
  pending?: boolean
  /** Why an empty result cannot be called healthy (results may be withheld, not loaded, or covered by another area). Null when nothing is in doubt. */
  caveat?: string | null
}

/**
 *  not_connected   no detector exists for it
 *  needs_attention any open finding is high or critical
 *  watch           open findings, none high or critical (attention / info only)
 *  not_assessed    a new check (pending) that has not reported yet
 *  access_restricted / data_unavailable  every check says so (restricted by the server / its data could not be read)
 *  not_available   detectors exist but none is in this person's list (or all are "not applicable" to them)
 *  healthy         every authorised check is "ok" and there are no findings
 *  no_findings     would be healthy, but something may be withheld, not loaded, or covered elsewhere: a neutral state, never "Healthy"
 *  not_enough_data anything else with no findings: insufficient data, a check that could not run, or a mix with some "ok" (never an all-clear)
 */
export function conditionOf({ insights, detectors, connected, caveat = null, pending = false }: ConditionInput): Condition {
  if (!connected) return 'not_connected'
  if (insights.some((i) => i.severity === 'critical' || i.severity === 'high')) return 'needs_attention'
  if (insights.length > 0) return 'watch'
  const relevant = detectors.filter((d) => d.state !== 'not_applicable')
  if (relevant.length === 0) return pending && detectors.length === 0 ? 'not_assessed' : 'not_available'
  // The server said so, in words: these are never folded into "not enough data" or an all-clear.
  if (relevant.every((d) => d.state === 'access_restricted')) return 'access_restricted'
  if (relevant.every((d) => d.state === 'data_unavailable')) return 'data_unavailable'
  if (relevant.every((d) => d.state === 'ok')) return caveat ? 'no_findings' : 'healthy'
  return 'not_enough_data'
}

/* ── coverage ─────────────────────────────────────────────────────────── */

export interface CoverageItem {
  detector: string
  title: string
  state: DetectorSummary['state']
  /** "Based on 12 of 15 …", "Not enough data to assess", or null when the server sent no coverage. */
  headline: string | null
  reason: string | null
  observed: number | null
  expected: number | null
  percent: number | null
  basis: string
  sufficient: boolean
}

export interface CoverageRollup {
  /** Checks that could be assessed for this person (not-applicable ones are left out). */
  checks: number
  /** Of those, how many ran with enough data. */
  enough: number
  insufficient: number
  errored: number
  /** One honest sentence; never a percentage the server did not send. */
  headline: string
  /** Each check's own figure, with its own basis. Figures from different checks are never added together. */
  items: CoverageItem[]
}

export function rollUpCoverage(detectors: readonly DetectorSummary[]): CoverageRollup {
  const relevant = detectors.filter((d) => d.state !== 'not_applicable')
  const items: CoverageItem[] = relevant.map((d) => {
    const c = d.coverage
    return {
      detector: d.detector,
      title: d.title,
      state: d.state,
      headline: c ? coverageText(c).headline : null,
      reason: d.reason ?? c?.reason ?? null,
      observed: c?.observed ?? null,
      expected: c?.expected ?? null,
      percent: c?.percent ?? null,
      basis: c?.basis?.trim() ?? '',
      sufficient: d.state === 'ok',
    }
  })
  const checks = relevant.length
  const enough = relevant.filter((d) => d.state === 'ok').length
  const insufficient = relevant.filter((d) => d.state === 'insufficient_data').length
  const errored = relevant.filter((d) => d.state === 'error').length

  let headline: string
  if (checks === 0) headline = 'No checks are open to your role'
  else if (enough === checks) headline = checks === 1 ? 'The check had enough data' : `All ${checks} checks had enough data`
  else headline = `${enough} of ${checks} ${checks === 1 ? 'check' : 'checks'} had enough data`
  return { checks, enough, insufficient, errored, headline, items }
}

/* ── units: one domain, or one area ───────────────────────────────────── */

export interface UnitView {
  condition: Condition
  /** Most urgent first. */
  insights: Insight[]
  counts: Record<InsightSeverity, number>
  /** High + critical. */
  attention: number
  /** The detectors of this unit this person may see. */
  detectors: DetectorSummary[]
  /** Titles of the detectors that feed this unit but are not open to this person. */
  unavailable: string[]
  coverage: CoverageRollup
  top: Insight | null
  /** The first suggested action of the most urgent findings that has one. */
  nextAction: { text: string; insight: Insight } | null
  /** A reason the server gave for the checks not assessing, when that is why the condition is "not enough data". */
  gapReason: string | null
  /** When the condition is "no findings shown": why that is not an all-clear. */
  note: string | null
}

export interface AreaView extends UnitView {
  area: AreaDef
  href: string
}

export interface DomainView extends UnitView {
  domain: DomainDef
  areas: AreaView[]
}

export interface ModuleView extends UnitView {
  module: ModuleIntelligenceDef
  areas: AreaView[]
}

function authorised(snapshot: Snapshot, ids: readonly string[]): DetectorSummary[] {
  return snapshot.detectors.filter((d) => ids.includes(d.detector))
}

function placementOf(insight: Insight): Placement {
  return classifyInsight(insight)
}

/** True when this person's picture may be missing findings: the server withheld some, or not every page was loaded. */
export function isWithheld(snapshot: Snapshot): boolean {
  const n = snapshot.meta.suppressed_count
  const note = snapshot.meta.suppression_note
  return (typeof n === 'number' && n > 0) || (typeof note === 'string' && note.trim() !== '') || snapshot.truncated
}

export const WITHHELD_NOTE = 'Some results may be withheld or not loaded, so an empty list is not an all-clear.'
export const INCOMPLETE_NOTE = 'The checks report more findings than were loaded, so this may be incomplete.'

function caveatFor(snapshot: Snapshot, detectors: readonly DetectorSummary[], shared: string | null): string | null {
  if (isWithheld(snapshot)) return WITHHELD_NOTE
  if (detectors.some((d) => d.insight_count > snapshot.insights.filter((i) => i.detector === d.detector).length)) return INCOMPLETE_NOTE
  return shared
}

function unitOf(snapshot: Snapshot, insights: Insight[], ids: readonly string[], connected: boolean, shared: string | null = null, pending = false): UnitView {
  const sorted = sortInsights(insights)
  const detectors = authorised(snapshot, ids)
  const counts = countBySeverity(sorted)
  const caveat = caveatFor(snapshot, detectors, shared)
  const condition = conditionOf({ insights: sorted, detectors, connected, caveat, pending })
  const withAction = sorted.find((i) => i.suggested_action && i.suggested_action.trim() !== '')
  const gap = detectors.find((d) => d.state !== 'ok' && d.state !== 'not_applicable' && d.reason)
  return {
    condition,
    insights: sorted,
    counts,
    attention: attentionCount(counts),
    detectors,
    unavailable: ids.filter((id) => !snapshot.detectors.some((d) => d.detector === id) && !snapshot.insights.some((i) => i.detector === id)).map((id) => DETECTOR_TITLE[id] ?? id),
    coverage: rollUpCoverage(detectors),
    top: sorted[0] ?? null,
    nextAction: withAction ? { text: withAction.suggested_action as string, insight: withAction } : null,
    gapReason: condition === 'not_enough_data' || condition === 'data_unavailable' ? gap?.reason ?? null : null,
    note: condition === 'no_findings' ? caveat : null,
  }
}

/** What to say about a unit that has no findings to list: one title and one sentence, per condition. "Healthy" only when nothing is in doubt. */
export function emptyText(unit: Pick<UnitView, 'condition' | 'gapReason' | 'note'>, isOther = false): { title: string; detail: string } {
  if (isOther) return { title: 'Nothing here', detail: 'No finding is waiting in this bucket.' }
  switch (unit.condition) {
    case 'healthy':
      return { title: 'Checked, nothing to flag', detail: CONDITION_MEANING.healthy }
    case 'no_findings':
      return { title: 'No findings shown', detail: unit.note ?? CONDITION_MEANING.no_findings }
    case 'not_available':
      return { title: 'Not available for your role', detail: CONDITION_MEANING.not_available }
    case 'not_enough_data':
      return { title: 'Not enough data to assess yet', detail: unit.gapReason ?? CONDITION_MEANING.not_enough_data }
    case 'not_connected':
      return { title: 'Not connected', detail: CONDITION_MEANING.not_connected }
    case 'not_assessed':
    case 'access_restricted':
    case 'data_unavailable':
    case 'partial':
    case 'excluded':
      return { title: CONDITION_LABEL[unit.condition], detail: unit.gapReason ?? CONDITION_MEANING[unit.condition] }
    default:
      return { title: 'No findings are open', detail: unit.gapReason ?? CONDITION_MEANING[unit.condition] }
  }
}

export function insightsOfArea(snapshot: Snapshot, area: AreaDef): Insight[] {
  return snapshot.insights.filter((i) => {
    const place = placementOf(i)
    return place.domain === area.domain && place.area === area.id
  })
}

export function insightsOfDomain(snapshot: Snapshot, domain: DomainDef): Insight[] {
  return snapshot.insights.filter((i) => placementOf(i).domain === domain.id)
}

export function buildAreaView(snapshot: Snapshot, area: AreaDef): AreaView {
  const insights = insightsOfArea(snapshot, area)
  // The "Other findings" bucket has no detectors of its own: it is connected exactly when something is in it.
  const connected = area.domain === 'other' ? insights.length > 0 : area.feeds.length > 0
  const ids = area.domain === 'other' ? [...new Set(insights.map((i) => i.detector))] : areaDetectorIds(area)
  // A detector that also feeds another area (deal health feeds CRM opportunities and GTM deals) says nothing about THIS area alone being clear.
  const others = allAreas().filter((a) => a !== area && a.feeds.some((f) => area.feeds.some((mine) => mine.detector === f.detector)))
  const shared = others.length > 0 ? `No findings in this area (this check also covers ${others.map((a) => a.title).join(', ')}).` : null
  return { ...unitOf(snapshot, insights, ids, connected, shared, area.pending === true), area, href: areaHref(area.domain, area.id) }
}

export function buildDomainView(snapshot: Snapshot, domain: DomainDef): DomainView {
  const insights = insightsOfDomain(snapshot, domain)
  const ids = domain.id === 'other' ? [...new Set(insights.map((i) => i.detector))] : domainDetectorIds(domain)
  const connected = domain.id === 'other' ? insights.length > 0 : !domain.notConnected
  const pending = domain.areas.length > 0 && domain.areas.every((a) => a.pending === true)
  return { ...unitOf(snapshot, insights, ids, connected, null, pending), domain, areas: domain.areas.map((a) => buildAreaView(snapshot, a)) }
}

/** A parent-module view made from all of its declared submodule areas, never the current screen alone. */
export function buildModuleView(snapshot: Snapshot, module: ModuleIntelligenceDef): ModuleView {
  const areas = module.areas.flatMap((ref) => {
    const def = areaById(ref.domain, ref.area)
    return def ? [buildAreaView(snapshot, def)] : []
  })
  const ids = [...new Set(areas.flatMap((view) => view.detectors.map((detector) => detector.detector).concat(
    view.area.feeds.map((feed) => feed.detector),
  )))]
  const insights = areas.flatMap((view) => view.insights)
  const summary = registrySummary(module.key)
  const gap = summary.not_assessed + summary.excluded > 0
    ? `Some module functionality is not assessed by the connected checks (${summary.not_assessed} not yet assessed, ${summary.excluded} excluded).`
    : null
  const pending = areas.length > 0 && areas.every((view) => view.area.pending === true)
  const base = unitOf(snapshot, insights, ids, areas.length > 0, gap, pending)
  // A module with no detector at all has data that has simply not been assessed: "not yet assessed", never "not connected".
  const unit: UnitView = areas.length === 0 ? { ...base, condition: 'not_assessed' } : base

  return { ...unit, module, areas }
}

/** One view per domain card, in display order. "Other findings" is added only when something landed in it. */
export function buildDomainViews(snapshot: Snapshot): DomainView[] {
  const views = DOMAINS.map((d) => buildDomainView(snapshot, d))
  const other = ALL_DOMAINS.find((d) => d.id === 'other')
  if (other) {
    const view = buildDomainView(snapshot, other)
    if (view.insights.length > 0) views.push(view)
  }
  return views
}

/* ── priorities ───────────────────────────────────────────────────────── */

export interface Priority {
  insight: Insight
  placement: Placement
}

/** The most urgent open findings across every domain: critical, high, attention, info; then newest. */
export function topPriorities(snapshot: Snapshot, limit = 6): Priority[] {
  // A possible relationship is unverified: it never ranks among the management priorities (it has its own section).
  return sortInsights(withoutCross(snapshot.insights))
    .slice(0, limit)
    .map((insight) => ({ insight, placement: placementOf(insight) }))
}

/**
 * Resolves the key from an address to a loaded finding: the exact key first (old links), then the stable form of both (so a link survives the day rolling
 * over). If several loaded findings share one stable key, the newest wins.
 */
export function findInsight(snapshot: Snapshot, key: string): Insight | null {
  const exact = snapshot.insights.find((i) => i.key === key)
  if (exact) return exact
  const wanted = stableKey(key)
  const matches = snapshot.insights.filter((i) => stableKey(i.key) === wanted)
  if (matches.length === 0) return null
  return [...matches].sort((a, b) => (Date.parse(b.as_of) || 0) - (Date.parse(a.as_of) || 0))[0]
}

/* ── the organisation overview ────────────────────────────────────────── */

export interface Overview {
  counts: Record<InsightSeverity, number>
  total: number
  /** How many domains are in each condition (the "Other findings" bucket is counted only when it has something in it). */
  domainTally: Record<Condition, number>
  coverage: CoverageRollup
  /** One honest sentence about how much data the whole picture rests on. */
  confidence: string
  /** Detectors that ran, had enough data and found nothing: "checked, nothing to flag". */
  clear: DetectorSummary[]
  lastUpdated: string | null
}

export function newestTimestamp(values: ReadonlyArray<string | null | undefined>): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const v of values) {
    if (!v) continue
    const ms = Date.parse(v)
    if (Number.isFinite(ms) && ms > bestMs) {
      best = v
      bestMs = ms
    }
  }
  return best
}

export function lastUpdated(snapshot: Snapshot): string | null {
  return snapshot.meta.generated_at ?? newestTimestamp([...snapshot.detectors.map((d) => d.as_of), ...snapshot.insights.map((i) => i.as_of)])
}

export function buildOverview(snapshot: Snapshot, views: DomainView[] = buildDomainViews(snapshot)): Overview {
  // Possible relationships are counted in their own section, never added to the counts of verified findings.
  const counts = countBySeverity(withoutCross(snapshot.insights))
  const domainTally: Record<Condition, number> = {
    needs_attention: 0, watch: 0, healthy: 0, no_findings: 0, not_enough_data: 0, not_available: 0, not_connected: 0,
    partial: 0, data_unavailable: 0, access_restricted: 0, not_assessed: 0, excluded: 0,
  }
  for (const v of views) domainTally[v.condition] += 1
  const coverage = rollUpCoverage(snapshot.detectors)
  const withFindings = new Set(snapshot.insights.map((i) => i.detector))
  // Nothing is listed as clear when results may be withheld or not loaded.
  const clear = isWithheld(snapshot) ? [] : snapshot.detectors.filter((d) => d.state === 'ok' && d.insight_count === 0 && !withFindings.has(d.detector))

  let confidence: string
  if (coverage.checks === 0) {
    confidence = 'No checks are open to your role, so nothing here can be assessed.'
  } else {
    const gaps: string[] = []
    if (coverage.insufficient > 0) gaps.push(`${coverage.insufficient} did not have enough data`)
    if (coverage.errored > 0) gaps.push(`${coverage.errored} could not run`)
    confidence = `This picture rests on ${coverage.enough} of ${coverage.checks} ${coverage.checks === 1 ? 'check' : 'checks'} that had enough data${gaps.length > 0 ? `; ${gaps.join(' and ')}` : ''}.`
  }
  return { counts, total: withoutCross(snapshot.insights).length, domainTally, coverage, confidence, clear, lastUpdated: lastUpdated(snapshot) }
}

/* ── narrative of a unit, composed from the insights' own words ───────── */

export const SEVERITY_MEANING: Record<InsightSeverity, string> = {
  critical: 'This is the most urgent kind of finding. It should be looked at first.',
  high: 'This should be acted on soon, not left for later.',
  attention: 'This is worth a look when you next review this area.',
  info: 'This is for your information. No action is implied.',
}

export interface NarrativeLine {
  key: string
  title: string
  text: string
}

export interface Narrative {
  /** What is happening: the findings' own `what_happened`. */
  happening: NarrativeLine[]
  /** What it means: a count of the findings by how urgent they are. */
  means: string
  /** Why it matters: the findings' own `why_it_matters`, each said once. */
  why: NarrativeLine[]
}

export function meansSentence(counts: Record<InsightSeverity, number>): string {
  const total = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0)
  if (total === 0) return 'No open findings.'
  const parts: string[] = []
  const urgent = attentionCount(counts)
  if (urgent > 0) parts.push(`${urgent} high priority or critical`)
  if (counts.attention > 0) parts.push(`${counts.attention} need${counts.attention === 1 ? 's' : ''} a look`)
  if (counts.info > 0) parts.push(`${counts.info} for information`)
  return `${total} open ${total === 1 ? 'finding' : 'findings'}: ${parts.join(', ')}.`
}

export function narrativeOf(unit: Pick<UnitView, 'insights' | 'counts'>, limit = 3): Narrative {
  const top = unit.insights.slice(0, limit)
  const seen = new Set<string>()
  const why: NarrativeLine[] = []
  for (const i of top) {
    const text = i.why_it_matters.trim()
    if (text === '' || seen.has(text)) continue
    seen.add(text)
    why.push({ key: i.key, title: i.title, text })
  }
  return {
    happening: top.map((i) => ({ key: i.key, title: i.title, text: i.what_happened })),
    means: meansSentence(unit.counts),
    why,
  }
}

/** The distinct suggested actions of a unit's findings, most urgent finding first. */
export function recommendedActions(insights: readonly Insight[], limit = 5): Array<{ text: string; insight: Insight }> {
  const seen = new Set<string>()
  const out: Array<{ text: string; insight: Insight }> = []
  for (const insight of sortInsights(insights)) {
    const text = insight.suggested_action?.trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push({ text, insight })
    if (out.length >= limit) break
  }
  return out
}

export function filterBySeverity(insights: readonly Insight[], severity: InsightSeverity | 'all'): Insight[] {
  return severity === 'all' ? [...insights] : insights.filter((i) => i.severity === severity)
}

/* ── cross-functional: possible relationships (Global Intelligence only) ─ */

export interface CrossView extends UnitView {
  /** The possible relationships that were reported, most urgent first. */
  findings: Insight[]
}

/**
 * The state of the "Possible relationships" section. It is built from the `cross.*` detectors the server actually reported: with none reported the section
 * is "not yet assessed" (never "healthy", never a finding), and a check that could not assess (restricted / unavailable / too little data) says so.
 */
export function buildCrossView(snapshot: Snapshot): CrossView {
  const findings = sortInsights(crossFindings(snapshot.insights))
  const ids = snapshot.detectors.filter((d) => isCrossDetector(d.detector)).map((d) => d.detector)
  const unit = unitOf(snapshot, findings, ids, true, null, true)
  return { ...unit, findings }
}

/** What to say when there is no possible relationship to list. Never "no relationship exists": only what the checks that ran observed. */
export function crossEmptyText(unit: Pick<UnitView, 'condition' | 'gapReason' | 'note'>): { title: string; detail: string } {
  if (unit.condition === 'healthy') {
    return { title: 'No possible relationship observed', detail: 'The cross-functional checks ran and observed none. That does not prove there is no relationship.' }
  }
  if (unit.condition === 'not_assessed') {
    return { title: CONDITION_LABEL.not_assessed, detail: 'No cross-functional check has reported yet, so no possible relationship is shown. Data may exist; it has simply not been assessed.' }
  }
  return emptyText(unit)
}
