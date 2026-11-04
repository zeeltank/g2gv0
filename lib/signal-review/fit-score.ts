import type { MatchedOffer, ProductFilterOption, SignalAssessment, SignalRow, SignalScores } from '@/services/signal-review/signal-types'
import { claimLevelText } from './signal-display'
import { fitLabel } from './list-model'

/**
 * What the drawer's "Fit and score" tab shows, read from the fields the API really sends and from nothing else: a part the server did not record is
 * reported as not recorded, never filled with a guess, and no Strong/Medium/Weak word is made up (the only band shown is the one the server stated).
 * Pure, so those rules are tested without a browser.
 */

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)

// ── The score ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seven parts of a signal's score, in the order the server lists them. */
export const SCORE_PARTS = [
  { key: 'buying_signal', label: 'Buying signal' },
  { key: 'problem_fit', label: 'Problem fit' },
  { key: 'product_fit', label: 'Product fit' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'potential_value', label: 'Potential value' },
  { key: 'evidence_quality', label: 'Evidence quality' },
] as const satisfies ReadonlyArray<{ key: keyof SignalScores; label: string }>

export interface ScorePart {
  key: string
  label: string
  /** Null when the server did not record this part. */
  value: number | null
}

export interface ScoreModel {
  total: number
  parts: ScorePart[]
  /** How many of the seven parts were recorded. */
  recorded: number
}

/** The score, or null when the signal was never scored. The scale is the server's own; no maximum is claimed. */
export function scoreModel(scores: SignalScores | null | undefined): ScoreModel | null {
  if (!scores || !isNumber(scores.total)) return null
  const parts = SCORE_PARTS.map(({ key, label }) => ({ key, label, value: isNumber(scores[key]) ? (scores[key] as number) : null }))
  return { total: scores.total, parts, recorded: parts.filter((p) => p.value !== null).length }
}

// ── The fit with the product ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const FIT_LABELS: Record<string, string> = {
  product: 'Product',
  icp: 'Buyer and trigger',
  geography: 'Place',
  evidence: 'Evidence',
  intent: 'Buying intent',
  freshness: 'Freshness',
}
const FIT_ORDER = Object.keys(FIT_LABELS)

export interface FitPart {
  key: string
  label: string
  score: number
  max: number
  why: string | null
}

export interface FitModel {
  total: number
  /** The most the total can be: the parts' own maxima added up. Null when the parts were not recorded (no maximum is claimed). */
  max: number | null
  /** The band the server stated for this fit (High, Medium or Low); null when it did not state one. */
  band: string | null
  parts: FitPart[]
}

const sentence = (value: string | null): string | null => (value ? value.charAt(0).toUpperCase() + value.slice(1) : null)
const humanKey = (key: string): string => sentence(key.replace(/_/g, ' ')) ?? key

/** How well the signal fits its product, as the server worked it out; null for a signal that carries no such assessment. */
export function fitModel(assessment: SignalAssessment | null | undefined): FitModel | null {
  const fit = assessment?.fit
  if (!fit || !isNumber(fit.total)) return null

  const raw = fit.components && typeof fit.components === 'object' ? Object.entries(fit.components) : []
  const valid = raw.flatMap(([key, c]) => (c && isNumber(c.score) && isNumber(c.max) ? [{ key, label: FIT_LABELS[key] ?? humanKey(key), score: c.score, max: c.max, why: sentence(text(c.why)) }] : []))
  const rank = (key: string) => { const i = FIT_ORDER.indexOf(key); return i === -1 ? FIT_ORDER.length : i }
  const parts = [...valid].sort((a, b) => rank(a.key) - rank(b.key))

  // A maximum is only claimed when every part came through: a sum over a part missing would be a smaller, wrong number.
  const complete = parts.length > 0 && parts.length === raw.length
  return { total: fit.total, max: complete ? parts.reduce((sum, p) => sum + p.max, 0) : null, band: text(fit.band), parts }
}

// ── Needs and offers ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const codes = (value: unknown): string[] => (Array.isArray(value) ? value.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map((c) => c.trim()) : [])

export interface OfferView {
  key: string
  name: string
  category: string | null
  /** Null when the match was stored without a score. */
  score: number | null
  /** Why the matcher tied this offer to the signal; null when it was stored without one. */
  rationale: string | null
  needCodes: string[]
}

/** The offers the matcher tied to the signal, best first (the server's order is kept). */
export function offerViews(offers: readonly MatchedOffer[] | null | undefined): OfferView[] {
  if (!Array.isArray(offers)) return []
  return offers.map((o, index) => {
    const name = text(o.offer_name) ?? text(o.offer_id) ?? 'An offer (its name was not recorded)'
    return {
      key: `${text(o.offer_id) ?? name}-${index}`,
      name,
      category: text(o.offer_category),
      score: isNumber(o.match_score) ? o.match_score : null,
      rationale: text(o.rationale),
      needCodes: codes(o.matched_need_codes),
    }
  })
}

// ── The whole tab ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FitScoreModel {
  /** The Product Master record the signal is matched to. */
  product: string | null
  offerName: string | null
  /** The signal's `business_fit` code as a person reads it (the product's own name when the server named it). */
  businessFit: string | null
  fit: FitModel | null
  score: ScoreModel | null
  /** The researcher's reasoning for the score. */
  reasoning: string | null
  confidence: string | null
  claim: string | null
  needCodes: string[]
  offers: OfferView[]
}

export function fitScoreModel(signal: SignalRow, products?: readonly ProductFilterOption[]): FitScoreModel {
  const business = text(signal.business_fit)
  return {
    product: text(signal.product_master_name),
    offerName: text(signal.relevant_offer_name),
    businessFit: business ? fitLabel(business, products) : null,
    fit: fitModel(signal.assessment),
    score: scoreModel(signal.scores),
    // `strength_reason` is the same text under its older name; either may be the one a given response carries.
    reasoning: text(signal.score_reasoning) ?? text(signal.strength_reason),
    confidence: text(signal.confidence),
    claim: claimLevelText(text(signal.claim_level)),
    needCodes: codes(signal.candidate_need_codes),
    offers: offerViews(signal.matched_offers),
  }
}
