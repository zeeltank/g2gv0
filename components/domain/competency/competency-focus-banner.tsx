'use client'

import { Filter, X } from 'lucide-react'

/**
 * Shown when a screen was opened from a competency's detail panel.
 *
 * A silently pre-filtered list reads as "there is almost no data here", so the
 * narrowing is stated and one click removes it.
 */
export function CompetencyFocusBanner({
  competencyName,
  competencyId,
  onClear,
}: {
  competencyName: string | null
  competencyId: string | null
  onClear: () => void
}) {
  if (!competencyId) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-foreground">
        <Filter className="h-4 w-4 shrink-0 text-primary" />
        Showing only records linked to{' '}
        <span className="font-bold">{competencyName || `competency #${competencyId}`}</span>
      </span>
      <button
        onClick={onClear}
        className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <X className="h-3.5 w-3.5" /> Show all
      </button>
    </div>
  )
}
