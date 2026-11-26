'use client'

import type { ReactNode } from 'react'
import type { Insight } from '@/services/intelligence/types'
import { sortInsights } from '@/lib/intelligence-center/model'
import { InsightCard } from './insight-card'

interface InsightListProps {
  insights: readonly Insight[]
  compact?: boolean
  /** What to show when there is nothing to list (the caller knows whether that means "all clear" or "not enough data"). */
  empty?: ReactNode
  /** Show at most this many; the rest stay behind the caller's own link. */
  limit?: number
}

/** The insights, most urgent first. */
export function InsightList({ insights, compact = false, empty = null, limit }: InsightListProps) {
  const sorted = sortInsights(insights)
  const shown = typeof limit === 'number' ? sorted.slice(0, limit) : sorted
  if (shown.length === 0) return <>{empty}</>
  return (
    <ul className="space-y-3">
      {shown.map((insight) => (
        <li key={insight.key}>
          <InsightCard insight={insight} compact={compact} />
        </li>
      ))}
    </ul>
  )
}
