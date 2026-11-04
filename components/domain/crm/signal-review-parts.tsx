'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  claimLevelText, dateBadge, dateExplanation, dateProvenance, evidenceQuote, firstSeenText, sourceLink, statusChip,
  type StatusChipTone,
} from '@/lib/signal-review/signal-display'
import { fitSummary } from '@/lib/signal-review/list-model'
import { DATE_BASE, DATE_LOOK, PRODUCT_CHIP_TONE, STATUS_TONE } from '@/lib/signal-review/tones'
import type { ProductFilterOption, SignalRow } from '@/services/signal-review/signal-types'
import type { DateInfo, ReviewStatus } from '@/services/signal-review/types'

// Inline spans, not Badge (a div): the chips also sit inside the drawer's description, which is a paragraph.

const CHIP = 'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium'

/** The status in words. The words carry the meaning; the colour only helps. */
export function SignalStatusChip({ status }: { status: ReviewStatus }) {
  const chip = statusChip(status)
  return <span data-status={status} className={cn(CHIP, STATUS_TONE[chip.tone])}>{chip.label}</span>
}

/** The date, and what kind of date it is. A signal with no date says "Date unknown" in a dashed outline. */
export function SignalDateBadge({ info }: { info: DateInfo | null | undefined }) {
  const badge = dateBadge(info)
  return <span data-date-kind={badge.kind} className={cn(DATE_BASE, DATE_LOOK[badge.kind])}>{badge.text}</span>
}

/** The Product Master record a signal is matched to, or a plain "No product" (a signal that could not be matched is never given a guessed product). */
export function SignalProductChip({ name }: { name: string | null | undefined }) {
  return name
    ? <span className={cn(CHIP, PRODUCT_CHIP_TONE)}>{name}</span>
    : <span className={cn(CHIP, 'border-dashed border-border text-muted-foreground')}>No product</span>
}

/** One label and its value in a drawer's definition list. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

/**
 * What the decision is based on: the wording copied from the source, a link to the source, how the date was found, which product it fits and how sure
 * the finding is. Everything is read from the signal as stored; a missing piece says it is missing instead of being left out.
 */
export function SignalEvidence({ signal, products }: { signal: SignalRow; products?: readonly ProductFilterOption[] }) {
  const quote = evidenceQuote(signal)
  const link = sourceLink(signal)
  const seen = firstSeenText(signal)
  const fit = fitSummary(signal, products)
  const claim = claimLevelText(signal.claim_level)

  return (
    <section aria-labelledby="sr-evidence-heading" className="space-y-2">
      <h3 id="sr-evidence-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</h3>

      {quote
        ? <blockquote className="rounded border-l-4 border-warning bg-warning/10 px-3 py-2 text-sm italic">“{quote}”</blockquote>
        : <p className="text-sm text-muted-foreground">No wording from the source was kept for this signal.</p>}

      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <Fact label="Source">
          {link
            ? (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:no-underline">
                <span className="break-all">{link.title}</span>
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )
            : <span className="text-muted-foreground">No web address recorded.</span>}
        </Fact>
        <Fact label="Date">
          <span className="flex flex-col gap-1">
            <span><SignalDateBadge info={signal.date_info} /></span>
            <span className="text-muted-foreground">{dateExplanation(signal.date_info, dateProvenance(signal.assessment))}</span>
          </span>
        </Fact>
        {seen && <Fact label="First seen">{seen}</Fact>}
        <Fact label="Product">
          <SignalProductChip name={signal.product_master_name} />
          {signal.relevant_offer_name && <span className="ml-2 text-muted-foreground">matched offer: {signal.relevant_offer_name}</span>}
        </Fact>
        <Fact label="Fit · score">{fit ?? <span className="text-muted-foreground">Not recorded</span>}</Fact>
        {claim && <Fact label="How sure">{claim}</Fact>}
      </dl>
    </section>
  )
}
