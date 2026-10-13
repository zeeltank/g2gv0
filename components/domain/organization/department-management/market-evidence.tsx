'use client'

import { Badge } from '@/components/ui/badge'
import type { ClaimLevel, FetchLevel, MatchedOffer, Opportunity } from '@/services/signals/opportunities'
import { Fact } from './signals-ui'

/**
 * Presentation of the demand-side (imported) fields on a company opportunity.
 *
 * Everything here renders nothing for a researched row that has none of these fields, so the
 * existing cards look exactly as before.
 */

const CLAIM: Record<ClaimLevel, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  confirmed: { label: 'Confirmed', variant: 'success' },
  inference: { label: 'Inference', variant: 'warning' },
  hypothesis: { label: 'Hypothesis', variant: 'muted' },
}

const FETCH_LABEL: Record<FetchLevel, string> = {
  full_document: 'Full document read',
  page_text: 'Page text read',
  search_snippet: 'Search snippet only',
  blocked: 'Source blocked',
}

const TRIGGER_LABEL: Record<string, string> = {
  tender: 'Tender', rfp: 'RFP', eoi: 'EOI', rfq: 'RFQ', programme: 'Programme', regulation: 'Regulation',
  expansion: 'Expansion', funding: 'Funding', acquisition: 'Acquisition', leadership: 'Leadership change',
  hiring: 'Hiring', partnership: 'Partnership', other: 'Other',
}

export const humanise = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : ''

/** Claim level + what was actually read. The two together are the evidence grade. */
export function EvidenceBadges({ o }: { o: Opportunity }) {
  if (!o.claim_level && !o.fetch_level) return null

  return (
    <>
      {o.claim_level && (
        <Badge variant={CLAIM[o.claim_level].variant} title={o.evidence_note ?? undefined}>
          {CLAIM[o.claim_level].label}
        </Badge>
      )}
      {o.fetch_level && <Badge variant="outline" title={o.evidence_note ?? undefined}>{FETCH_LABEL[o.fetch_level]}</Badge>}
    </>
  )
}

/** Days to expiry: red at 7 days or fewer, muted once expired, nothing when the signal never expires. */
export function ExpiryChip({ o }: { o: Opportunity }) {
  if (o.days_left === null || o.days_left === undefined) return null

  if (o.is_expired || o.days_left < 0) {
    return <Badge variant="muted" title={`Expired ${o.expires_at ?? ''}`}>Expired</Badge>
  }
  const label = o.days_left === 0 ? 'Closes today' : o.days_left === 1 ? '1 day left' : `${o.days_left} days left`

  return <Badge variant={o.days_left <= 7 ? 'destructive' : 'navy'} title={`Closes ${o.expires_at ?? ''}`}>{label}</Badge>
}

export function ImportedChips({ o }: { o: Opportunity }) {
  return (
    <>
      {o.trigger_type && <Badge variant="default">{TRIGGER_LABEL[o.trigger_type] ?? humanise(o.trigger_type)}</Badge>}
      <EvidenceBadges o={o} />
      <ExpiryChip o={o} />
      {o.is_government_track && <Badge variant="warning" title="Reached through a system-integrator partner">SI partnership</Badge>}
      {o.scores && <Badge variant="muted" title={o.score_reasoning ?? undefined}>Score {o.scores.total}/35</Badge>}
      {o.is_sample && <Badge variant="destructive">Sample</Badge>}
    </>
  )
}

/**
 * Readiness of a matched offer. A strong match to an unverified offer stays visible and is
 * labelled, never hidden or ranked lower: only an administrator's confirmation makes it Verified.
 */
export function ReadinessBadge({ offer }: { offer: Pick<MatchedOffer, 'is_deliverable' | 'readiness_status'> }) {
  return offer.is_deliverable
    ? <Badge variant="success" title={offer.readiness_status ?? undefined}>Verified</Badge>
    : <Badge variant="warning" title={offer.readiness_status ?? 'Readiness not confirmed by an administrator'}>Not yet verified</Badge>
}

export function MatchedOffers({ offers, limit }: { offers?: MatchedOffer[]; limit?: number }) {
  if (!offers || offers.length === 0) return null
  const shown = limit ? offers.slice(0, limit) : offers

  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Matched offers</dt>
      <dd className="mt-1.5 space-y-1.5">
        {shown.map((m) => (
          <div key={m.offer_id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-semibold text-primary">{m.offer_id}</span>
            <span className="min-w-0 break-words text-foreground">{m.offer_name ?? ''}</span>
            {m.match_score !== null && <span className="text-muted-foreground">match {m.match_score}</span>}
            <ReadinessBadge offer={m} />
          </div>
        ))}
        {limit && offers.length > limit && <p className="text-xs text-muted-foreground">+{offers.length - limit} more in the detail view</p>}
      </dd>
    </div>
  )
}

/** The full qualification block shown in the detail dialog. */
export function MarketDetail({ o }: { o: Opportunity }) {
  const imported = o.trigger_summary || o.claim_level || o.expires_at || o.scores
  if (!imported) return null

  const scoreRows: [string, number | null][] = o.scores ? [
    ['Buying signal', o.scores.buying_signal], ['Problem fit', o.scores.problem_fit], ['Product fit', o.scores.product_fit],
    ['Accessibility', o.scores.accessibility], ['Urgency', o.scores.urgency], ['Potential value', o.scores.potential_value],
    ['Evidence quality', o.scores.evidence_quality],
  ] : []

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border/60 p-4">
        <h5 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qualification</h5>
        <dl className="grid gap-3 sm:grid-cols-2">
          {o.trigger_summary && <Fact label="Buying trigger">{o.trigger_summary}</Fact>}
          {o.reference_no && <Fact label="Reference">{o.reference_no}</Fact>}
          {o.expires_at && <Fact label="Closes">{o.expires_at}{o.days_left !== null && o.days_left !== undefined ? ` (${o.is_expired ? 'expired' : `${o.days_left} days left`})` : ''}</Fact>}
          {o.buyer_type && <Fact label="Buyer type">{humanise(o.buyer_type)}{o.buyer_state ? ` · ${o.buyer_state}` : ''}</Fact>}
          {o.buyer_segment && <Fact label="Buyer segment">{o.buyer_segment}</Fact>}
          {o.candidate_need_codes && o.candidate_need_codes.length > 0 && <Fact label="Need codes">{o.candidate_need_codes.join(', ')}</Fact>}
          {o.business_fit && <Fact label="Business fit">{o.business_fit.toUpperCase()}</Fact>}
          {o.entry_point && <Fact label="Entry point">{humanise(o.entry_point)}</Fact>}
          {o.scale && <Fact label="Scale">{humanise(o.scale)}</Fact>}
          {o.estimated_value && <Fact label="Estimated value">{o.estimated_value}</Fact>}
          {o.likely_problem && <Fact label="Likely problem">{o.likely_problem}</Fact>}
          {o.likely_stakeholder && <Fact label="Likely stakeholder">{o.likely_stakeholder}</Fact>}
          {o.what_we_could_sell && <Fact label="What we could sell">{o.what_we_could_sell}</Fact>}
          {o.partner_route_note && <Fact label="Partner route">{o.partner_route_note}</Fact>}
          {o.soft_marketing_angle && <Fact label="Soft marketing angle">{o.soft_marketing_angle}</Fact>}
        </dl>
        {o.evidence_note && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">{o.evidence_note}</p>}
      </section>

      {o.scores && (
        <section className="space-y-2 rounded-lg border border-border/60 p-4">
          <h5 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Score {o.scores.total} / 35</h5>
          <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {scoreRows.map(([label, value]) => (
              <li key={label} className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value ?? '—'} / 5</span></li>
            ))}
          </ul>
          {o.score_reasoning && <p className="text-xs leading-relaxed text-muted-foreground">{o.score_reasoning}</p>}
        </section>
      )}

      <MatchedOffers offers={o.matched_offers} />
    </div>
  )
}
