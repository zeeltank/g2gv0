'use client'

import { useId, useMemo } from 'react'
import Link from 'next/link'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { quoteCaption, signalEvidence, type SignalEvidence } from '@/lib/leads/model'
import { buildLinks, signalReviewHref } from '@/lib/org-accounts/links'
import type { FactsApi } from '@/services/facts/api-types'
import type { Fact } from '@/services/facts/types'
import type { Lead } from '@/types/crm'
import { FactEvidenceSection } from './fact-evidence-section'

/**
 * The Evidence tab of a lead (hp_erp docs/agentic-crm/slices/S06-leads.md): where the lead came from (the signal's title, date, fit, source link, and a
 * quote when the server sends one) above the facts an agent or a source suggested about the lead, which S4b's section draws. Everything that came from the web
 * or a model is shown as text; a source link is opened only when it is an http(s) address. It reads nothing itself except through the facts section, and it
 * sends nothing.
 */
export function LeadEvidenceTab({ lead, onWroteRecord, factsService }: {
  lead: Lead
  /** A fact accepted here wrote one of the lead's own fields: the page shows the new value. */
  onWroteRecord?: (fact: Fact) => void
  /** For tests: the facts API as a fake. The page passes nothing. */
  factsService?: FactsApi
}) {
  return (
    <div className="space-y-4" data-lead-evidence>
      <SourceSignal evidence={signalEvidence(lead)} />
      <FactEvidenceSection entityType="lead" entityId={lead.id} service={factsService} onWroteRecord={onWroteRecord} />
    </div>
  )
}

function SourceSignal({ evidence }: { evidence: SignalEvidence }) {
  const titleId = useId()
  const { resolveAccessLink } = useSidebarNavigation()
  const links = useMemo(() => buildLinks(resolveAccessLink), [resolveAccessLink])
  // Signal Review, narrowed to this signal's title; null when the person's menu has no Signal Review row (no link is drawn rather than a broken one).
  const reviewHref = evidence.kind === 'signal' ? signalReviewHref(links, evidence.title) : null

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-border bg-card" data-section="Source signal" data-signal-state={evidence.kind}>
      <header className="space-y-1 border-b border-border px-4 py-3">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">Where this lead came from</h3>
        <p className="text-xs text-muted-foreground">The signal this lead was made from, and what it said.</p>
      </header>

      <div className="space-y-3 p-4">
        {evidence.kind === 'none' && (
          <p className="text-sm text-muted-foreground" data-empty>
            This lead was not made from a signal, so there is no signal to show. Facts suggested for it appear below.
          </p>
        )}

        {evidence.kind === 'unreadable' && (
          <p className="text-sm text-foreground" data-unreadable>
            This lead was made from a signal{evidence.id ? ` (number ${evidence.id})` : ''}, but the server did not send the signal itself. It may have been removed.
          </p>
        )}

        {evidence.kind === 'signal' && (
          <>
            <p className="break-words text-sm font-semibold text-foreground" data-signal-title>{evidence.title}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground" data-signal-date>{evidence.dateText}</dd>
              {evidence.fitText && (
                <>
                  <dt className="text-muted-foreground">Fit</dt>
                  <dd className="text-foreground" data-signal-fit>{evidence.fitText}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Source</dt>
              <dd className="min-w-0 break-words text-foreground" data-signal-source>
                {evidence.url ? (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={evidence.url}
                    className="break-all underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {evidence.host ?? evidence.url}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : 'No source address was recorded.'}
              </dd>
            </dl>

            {evidence.quote && (
              <figure className="space-y-1" data-quote-kind={evidence.quoteKind ?? 'unsaid'}>
                {/* The source's own words are a quotation; a description of what happened is not, and is never drawn as one. */}
                {evidence.quoteKind === 'observed_event'
                  ? <p className="break-words border-l-2 border-border pl-3 text-sm text-foreground" data-signal-quote>{evidence.quote}</p>
                  : <blockquote className="break-words border-l-2 border-border pl-3 text-sm text-foreground" data-signal-quote>{evidence.quote}</blockquote>}
                <figcaption className="text-xs text-muted-foreground">{quoteCaption(evidence.quoteKind)}</figcaption>
              </figure>
            )}

            {reviewHref && (
              <p className="text-sm">
                <Link href={reviewHref} className="text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-signal-review-link>
                  Open this signal in Signal Review
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
