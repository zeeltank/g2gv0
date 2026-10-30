'use client'

import { ExternalLink, SearchCheck, TriangleAlert } from 'lucide-react'
import type { RunStageStats } from '@/services/signals/opportunities'

type PotentialReview = NonNullable<RunStageStats['potential_opportunities']>

/** These source-quoted suggestions are deliberately separate from the qualified opportunity feed. */
export function PotentialOpportunities({
  review,
  title = 'Potential opportunities - needs review',
  intro = 'These are sourced events that may be worth reviewing. They do not establish buying intent, are not qualified signals, and are excluded from signal totals.',
  titleId = 'potential-opportunities-title',
}: { review: PotentialReview | undefined; title?: string; intro?: string; titleId?: string }) {
  if (!review) return null

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <SearchCheck className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{intro}</p>

          {!review.attempted && review.status === 'skipped' ? (
            <p role="status" className="mt-3 text-sm text-amber-800 dark:text-amber-200">
              {review.reason === 'no_sources' ? 'The review pass was skipped because no usable source pages were available.' : 'The review pass was skipped because the run was near its time limit. No AI suggestions were generated.'}
            </p>
          ) : review.status === 'failed' ? (
            <p role="status" className="mt-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              The review pass could not finish. The main research run and its result are unchanged.
            </p>
          ) : review.items.length === 0 ? (
            <p role="status" className="mt-3 text-sm text-muted-foreground">The review pass found no source-backed early events to show.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {review.items.map((item, index) => (
                <li key={`${item.source_url}-${index}`} className="rounded-xl border border-amber-500/20 bg-background p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground">{item.company_name}</h3>
                      <p className="mt-0.5 text-sm text-foreground">{item.event}</p>
                    </div>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                      {item.trigger_type.replace(/_/g, ' ')} · Review
                    </span>
                  </div>

                  {item.why_review && <p className="mt-2 text-sm text-muted-foreground">{item.why_review}</p>}
                  <blockquote className="mt-2 border-l-2 border-amber-500/40 pl-3 text-sm text-muted-foreground">“{item.source_quote}”</blockquote>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{item.page_read ? 'Page read' : 'Search snippet only'}</span>
                    {item.source_published_at && <span>Source date: {item.source_published_at}</span>}
                    {item.region_status === 'unconfirmed' && <span>Region not confirmed in source</span>}
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                      {item.source_title || 'Open source'} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
