'use client'

/**
 * MY CAPABILITY — Slice 1b, item 8. The employee's own gap view.
 *
 * Menu 156, re-granted in 4b, on a controller that resolves the subject against
 * the caller (G-COMP-SEC-01). An employee sees their own gap and no one else's;
 * the server enforces that and returns 403 for a colleague.
 *
 * ─── THE TWO THINGS THIS SCREEN MUST NOT SOFTEN ─────────────────────────────
 *
 * 1. UNMEASURED IS NEITHER ZERO NOR PASS, and it matters more here than
 *    anywhere else in the product. A person looking at their own record must
 *    never see "0" and read it as a failing score when it means NOBODY HAS
 *    ASSESSED THEM. Unmeasured rows render as "Not yet assessed" — no number, no
 *    bar, no red.
 *
 * 2. COVERAGE TRAVELS WITH THE LEVEL. A proficiency number is never shown
 *    without how much of the competency it speaks for. A 4 measured on 20% of a
 *    competency's weight is not a 4.
 *
 * ─── TONE ───────────────────────────────────────────────────────────────────
 * Capability coverage is 2.7% today, so MOST EMPLOYEES WILL SEE MOSTLY
 * UNMEASURED. The screen has to make that honest without making it alarming:
 * unmeasured is neutral (slate), a real shortfall is amber, and the empty state
 * says the assessment has not happened yet rather than implying the person is
 * lacking.
 *
 * No arithmetic here. Every number comes from the API, which gets it from
 * ProficiencyService — the one named roll-up.
 */

import { CheckCircle2, CircleDashed, AlertTriangle, Info } from 'lucide-react'
import type { CompetencyGap, CompetencyGapRow } from '@/services/competency/gap'

function CoverageBar({ coverage }: { coverage: number }) {
  const pct = Math.round(coverage * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/40" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}% assessed</span>
    </div>
  )
}

function StateCell({ row }: { row: CompetencyGapRow }) {
  // UNMEASURED: no number, no bar, no red. It is not a score.
  if (row.state === 'unmeasured') {
    return (
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
        <CircleDashed className="h-4 w-4 shrink-0" />
        <span className="text-sm">Not yet assessed</span>
      </div>
    )
  }

  if (row.state === 'met') {
    return (
      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold tabular-nums">{row.measured_level}</span>
        <span className="text-xs text-muted-foreground">of {row.required_proficiency} required</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-semibold tabular-nums">{row.measured_level}</span>
      <span className="text-xs text-muted-foreground">
        of {row.required_proficiency} required · gap {row.gap}
      </span>
    </div>
  )
}

export function CmMyCapability({ gap }: { gap: CompetencyGap | null }) {
  if (!gap || gap.competencies.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-6 text-center">
        <p className="text-sm font-semibold">No requirements defined yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your job role does not have competency requirements set up. This is not a
          gap in your record — there is nothing to compare against yet.
        </p>
      </div>
    )
  }

  const { competencies_required: total, competencies_unmeasured: unmeasured } = gap.coverage

  return (
    <div className="space-y-4">
      {/* Honest, not alarming. Most employees will see mostly unmeasured. */}
      {unmeasured > 0 && (
        <div role="note" className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              {unmeasured} of {total} competencies have not been assessed yet.
            </span>{' '}
            That is not a score of zero and not a shortfall — it means no assessment
            has been recorded. Your organisation is still building this up.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competency</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your level</th>
              {/* Coverage is a column, not a footnote - it travels with the level. */}
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How much is assessed</th>
            </tr>
          </thead>
          <tbody>
            {gap.competencies.map((row) => (
              <tr key={row.competency_id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium">{row.competency_name}</span>
                  {row.is_mandatory && (
                    <span className="ml-2 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      Required
                    </span>
                  )}
                </td>
                <td className="px-4 py-3"><StateCell row={row} /></td>
                <td className="px-4 py-3">
                  {row.state === 'unmeasured'
                    ? <span className="text-xs text-muted-foreground">—</span>
                    : <CoverageBar coverage={row.coverage} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* THE SECOND NUMBER. An average can sit above the bar while an item
          inside it does not, so these are listed rather than folded in. */}
      {gap.mandatory_below_required.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Specific items below the required level
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            These sit inside a required competency, so they matter even where the
            overall level looks met.
          </p>
          <ul className="mt-2 space-y-1">
            {gap.mandatory_below_required.map((m) => (
              <li key={m.kasba_item_id} className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">{m.competency_name}</span>
                {' — '}
                <span className="capitalize">{m.kasba_type}</span>
                {m.item_label ? ` “${m.item_label}”` : ''}
                {': '}
                <span className="tabular-nums">{m.rating}</span> of {m.required}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
