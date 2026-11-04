'use client'

import { cn } from '@/lib/utils'
import { fitScoreModel, type FitModel, type OfferView, type ScoreModel } from '@/lib/signal-review/fit-score'
import type { ProductFilterOption, SignalRow } from '@/services/signal-review/signal-types'
import { Fact, SignalProductChip } from './signal-review-parts'

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const NOT_RECORDED = <span className="text-muted-foreground">Not recorded</span>

function FitParts({ fit }: { fit: FitModel }) {
  if (fit.parts.length === 0) return <p className="text-sm text-muted-foreground">The parts of this fit were not recorded.</p>
  return (
    <ul className="space-y-2.5 text-sm" aria-label="The parts of the fit">
      {fit.parts.map((part) => (
        <li key={part.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{part.label}</span>
            <span className="tabular-nums">{part.score} of {part.max}</span>
          </div>
          {part.max > 0 && (
            <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, (part.score / part.max) * 100))}%` }} />
            </span>
          )}
          {part.why && <p className="text-muted-foreground">{part.why}</p>}
        </li>
      ))}
    </ul>
  )
}

function ScoreParts({ score }: { score: ScoreModel }) {
  return (
    <div className="space-y-2">
      <p className="text-sm"><span className="text-2xl font-semibold tabular-nums">{score.total}</span> <span className="text-muted-foreground">total score</span></p>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm" aria-label="The parts of the score">
        {score.parts.map((part) => (
          <li key={part.key} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
            <span>{part.label}</span>
            {part.value === null ? NOT_RECORDED : <span className="font-medium tabular-nums">{part.value}</span>}
          </li>
        ))}
      </ul>
      {score.recorded === 0 && <p className="text-sm text-muted-foreground">Only the total was recorded; the parts it is made of were not.</p>}
      {score.recorded > 0 && score.recorded < score.parts.length && <p className="text-sm text-muted-foreground">The parts marked “Not recorded” were not stored with this signal.</p>}
    </div>
  )
}

function OfferItem({ offer }: { offer: OfferView }) {
  return (
    <li className="space-y-1 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-medium">{offer.name}</span>
        <span className="tabular-nums text-muted-foreground">{offer.score === null ? 'Match score not recorded' : `Match score ${offer.score}`}</span>
      </div>
      {offer.category && <p className="text-muted-foreground">{offer.category}</p>}
      <p className={cn(!offer.rationale && 'text-muted-foreground')}>{offer.rationale ?? 'No reason was stored for this match.'}</p>
      {offer.needCodes.length > 0 && <p className="text-muted-foreground">Shared needs: {offer.needCodes.join(', ')}</p>}
    </li>
  )
}

/**
 * The drawer's "Fit and score" tab: why this signal fits the product and how it scored. Every line comes from a field the API sends; a part the server
 * did not record says so, and no strength word is invented (the band shown is the server's own).
 */
export function SignalFitScore({ signal, products }: { signal: SignalRow; products?: readonly ProductFilterOption[] }) {
  const m = fitScoreModel(signal, products)

  return (
    <div className="space-y-5">
      <section aria-labelledby="sr-fit-heading" className="space-y-2">
        <h3 id="sr-fit-heading" className={HEADING}>Fit with the product</h3>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <Fact label="Product">
            <SignalProductChip name={m.product} />
            {m.offerName && <span className="ml-2 text-muted-foreground">matched offer: {m.offerName}</span>}
          </Fact>
          <Fact label="Business fit">{m.businessFit ?? NOT_RECORDED}</Fact>
          <Fact label="Fit total">
            {m.fit
              ? (
                <span>
                  <span className="font-medium tabular-nums">{m.fit.total}{m.fit.max !== null ? ` of ${m.fit.max}` : ''}</span>
                  {m.fit.band && <span className="ml-2 text-muted-foreground">band: {m.fit.band}</span>}
                </span>
              )
              : NOT_RECORDED}
          </Fact>
          <Fact label="How sure">{m.claim ?? NOT_RECORDED}</Fact>
          <Fact label="Confidence">{m.confidence ?? NOT_RECORDED}</Fact>
        </dl>
        {m.fit ? <FitParts fit={m.fit} /> : <p className="text-sm text-muted-foreground">No fit assessment was recorded for this signal.</p>}
      </section>

      <section aria-labelledby="sr-score-heading" className="space-y-2">
        <h3 id="sr-score-heading" className={HEADING}>Score</h3>
        {m.score ? <ScoreParts score={m.score} /> : <p className="text-sm text-muted-foreground">This signal was not scored.</p>}
        <p className={cn('text-sm', !m.reasoning && 'text-muted-foreground')}>{m.reasoning ?? 'No reasoning was recorded for the score.'}</p>
      </section>

      <section aria-labelledby="sr-needs-heading" className="space-y-2">
        <h3 id="sr-needs-heading" className={HEADING}>Needs and matched offers</h3>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <Fact label="Need codes">{m.needCodes.length > 0 ? m.needCodes.join(', ') : NOT_RECORDED}</Fact>
        </dl>
        {m.offers.length > 0
          ? <ul className="space-y-2" aria-label="Matched offers">{m.offers.map((offer) => <OfferItem key={offer.key} offer={offer} />)}</ul>
          : <p className="text-sm text-muted-foreground">No product offer was matched to this signal.</p>}
      </section>
    </div>
  )
}
