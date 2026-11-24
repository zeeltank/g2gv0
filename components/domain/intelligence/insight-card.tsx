'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/services/intelligence/types'
import {
  AUDIENCE_LABEL,
  confidenceLabel,
  coverageText,
  formatAsOf,
  openLabel,
  safeDeepLink,
  severityLabel,
} from '@/lib/intelligence-center/model'
import { EvidenceList } from './evidence'
import { CHIP_BASE, confidenceChip, COVERAGE_CHIP, SEVERITY_CHIP, SEVERITY_EDGE } from '@/lib/intelligence-center/tones'

interface InsightCardProps {
  insight: Insight
  /** A short form for host screens: title, what happened, the chips and the link. */
  compact?: boolean
  className?: string
}

/**
 * One insight: what happened, why it matters, the evidence, how much data stands behind it, what to do, and where in G2G to do it.
 * The severity and the kind of statement (measured / rule-based / AI estimate) are WORDS; the border colour only helps.
 */
export function InsightCard({ insight, compact = false, className }: InsightCardProps) {
  const confidence = confidenceLabel(insight.confidence)
  const coverage = coverageText(insight.coverage)
  const link = safeDeepLink(insight.deep_link)
  const titleId = `insight-${insight.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <article
      aria-labelledby={titleId}
      data-insight={insight.key}
      data-severity={insight.severity}
      className={cn('rounded-lg border border-border border-l-4 bg-card p-4 text-foreground', SEVERITY_EDGE[insight.severity], className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(CHIP_BASE, SEVERITY_CHIP[insight.severity])} data-chip="severity">{severityLabel(insight.severity)}</span>
        <span className={cn(CHIP_BASE, confidenceChip(insight.confidence))} data-chip="confidence">{confidence.label}</span>
        {!compact && <span className="text-xs text-muted-foreground">{AUDIENCE_LABEL[insight.audience]}</span>}
      </div>

      <h3 id={titleId} className="mt-2 text-sm font-semibold">{insight.title}</h3>
      <p className="mt-1 text-sm">{insight.what_happened}</p>
      {confidence.isEstimate && <p className="mt-1 text-xs font-medium" data-estimate-note>{confidence.note}</p>}

      {!compact && (
        <>
          <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Why it matters: </span>{insight.why_it_matters}</p>

          {insight.evidence.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Evidence</p>
              <div className="mt-1"><EvidenceList evidence={insight.evidence} fallbackLink={link} /></div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn(CHIP_BASE, coverage.sufficient ? COVERAGE_CHIP.enough : COVERAGE_CHIP.thin)} data-chip="coverage">{coverage.headline}</span>
            {coverage.reason && <span className="text-xs text-muted-foreground">{coverage.reason}</span>}
          </div>

          {insight.suggested_action && (
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm"><span className="font-medium">What to do: </span>{insight.suggested_action}</p>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{!confidence.isEstimate ? `${confidence.note} ` : ''}{formatAsOf(insight.as_of)}</span>
        {link && (
          <Link href={link} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline">
            {openLabel(link)}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  )
}
