'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Lightbulb, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { intelligenceService } from '@/services/intelligence/intelligence-service'
import type { InsightSurface, IntelligenceApi } from '@/services/intelligence/types'
import { emptyVerdict, emptyWording, needsAttention, statesOf, suppressedNotice } from '@/lib/intelligence-center/model'
import { NOTICE } from '@/lib/intelligence-center/tones'
import { InsightList } from './insight-list'
import { useIntelligenceLoad } from './use-intelligence-load'

export const INTELLIGENCE_CENTER_PATH = '/intelligence'

interface ContextualInsightsProps {
  /** Which screen this sits on; the server returns only the insights relevant to it. */
  surface: InsightSurface
  /** Injected for tests; defaults to the real service. */
  service?: IntelligenceApi
  /** `strip`: a collapsible band at the top of a host screen. `widget`: the body of an existing dashboard card (the card supplies the title). */
  variant?: 'strip' | 'widget'
  /** How many insights to show before pointing at the Intelligence Center. */
  maxItems?: number
  /**
   * What to do when this account may not see Intelligence (403) or the session ended (401): `hide` renders nothing at all, so a host screen is not
   * disturbed; `note` says so in one sentence (for a card whose purpose is Intelligence).
   */
  whenDenied?: 'hide' | 'note'
  className?: string
}

/**
 * Intelligence in context: the few insights that matter on THIS screen, fetched on its own so a slow or failed Intelligence answer can never blank the
 * screen it sits on. Every state is explicit: loading, error (with Retry where Retry can help), denied, "nothing needs attention" (only when the checks
 * ran), "not enough data to assess yet" (when they could not), and the insights.
 */
export function ContextualInsights({ surface, service = intelligenceService, variant = 'strip', maxItems = 3, whenDenied, className }: ContextualInsightsProps) {
  const denied = whenDenied ?? (variant === 'widget' ? 'note' : 'hide')
  const [open, setOpen] = useState(true)
  const { state, reload } = useIntelligenceLoad(() => service.insights({ surface, per_page: 10 }).then((r) => r.data), `${surface}`)

  if (state.status === 'error' && (state.failure.kind === 'forbidden' || state.failure.kind === 'unauthenticated')) {
    if (denied === 'hide') return null
    return <p className="text-sm text-muted-foreground" data-intelligence-state="denied">{state.failure.message}</p>
  }

  const body = (() => {
    if (state.status === 'loading') {
      return (
        <div role="status" aria-label="Loading insights" data-intelligence-state="loading" className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }
    if (state.status === 'error') {
      return (
        <div role="alert" data-intelligence-state="error" className={cn(NOTICE.info, 'flex flex-wrap items-center justify-between gap-2')}>
          <span>{state.failure.message}</span>
          {state.failure.retryable && (
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      )
    }
    const { insights, meta, pagination } = state.data
    const wording = emptyWording(emptyVerdict(statesOf(meta)))
    const total = pagination?.total ?? insights.length
    const hidden = Math.max(0, total - Math.min(insights.length, maxItems))
    const suppressed = suppressedNotice(meta)
    return (
      <div data-intelligence-state={insights.length === 0 ? 'empty' : 'ready'} className="space-y-3">
        <InsightList
          insights={insights}
          compact
          limit={maxItems}
          empty={
            <div className="rounded-lg border border-dashed border-border px-3 py-4">
              <p className="text-sm font-medium text-foreground">{wording.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{wording.detail}</p>
            </div>
          }
        />
        {suppressed && <p className="text-xs text-muted-foreground">{suppressed}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(NOTICE.provisional, 'py-1')}>Provisional thresholds</p>
          {hidden > 0 && <p className="text-xs text-muted-foreground" data-more-findings>Showing {Math.min(insights.length, maxItems)} of {total.toLocaleString('en-GB')} findings.</p>}
          <Link href={INTELLIGENCE_CENTER_PATH} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline">
            Open Intelligence
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    )
  })()

  if (variant === 'widget') {
    return <div className={className} data-intelligence-surface={surface}>{body}</div>
  }

  const attention = state.status === 'ready' ? needsAttention(state.data.insights).length : 0
  // Only the first page (10) is loaded here: when there are more, the badge says it counts among those, not among everything.
  const loadedCount = state.status === 'ready' ? state.data.insights.length : 0
  const totalCount = state.status === 'ready' ? state.data.pagination?.total ?? loadedCount : 0
  const attentionLabel = totalCount > loadedCount ? `${attention} among the first ${loadedCount} need${attention === 1 ? 's' : ''} attention` : `${attention} need${attention === 1 ? 's' : ''} attention`
  const regionId = `intelligence-${surface}`
  return (
    <section aria-labelledby={`${regionId}-title`} data-intelligence-surface={surface} className={cn('mb-4 rounded-lg border border-border bg-card text-foreground', className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <h2 id={`${regionId}-title`} className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" />
          Intelligence
          {attention > 0 && <span className="rounded-full border border-orange-500 bg-card px-2 py-0.5 text-xs font-medium">{attentionLabel}</span>}
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${regionId}-body`}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDown className={cn('size-3.5 transition-transform motion-reduce:transition-none', open ? 'rotate-180' : '')} aria-hidden="true" />
        </button>
      </div>
      <div id={`${regionId}-body`} hidden={!open} className="px-4 pb-4">
        {body}
      </div>
    </section>
  )
}
