'use client'

import { cn } from '@/lib/utils'
import type { MonthlyAttendanceSummary } from '@/services/hrms'

/**
 * One employee's month, counted.
 *
 * ── THE SERVER'S NUMBERS, NEVER DERIVED ONES ────────────────────────────────
 *
 * Every figure here comes from `MonthlyAttendanceSummary`, which the monthly
 * report endpoint computes against the roster and the holiday calendar. This
 * component does no arithmetic of its own, and returns **null** when the server
 * did not send the counts.
 *
 * That precedent is already set in this module - the tracking calendar drawer
 * hides its summary card for exactly this reason, and its comment says why:
 * nine confident zeroes are worse than no card, because a zero reads as a
 * measurement. A screen whose job is to settle an attendance dispute cannot
 * afford a number it made up.
 *
 * ── WHY `late` IS ALLOWED TO BE MEANINGLESS ─────────────────────────────────
 *
 * `late_days` is computed server-side against the rostered start, and for the
 * 2,008 employees who have no roster there is no start to be late against. The
 * server still sends 0. So when the caller knows the employee has no roster,
 * this renders an em dash for lateness rather than passing that 0 on - the same
 * rule the tile follows for its punctuality marker.
 */
export function AttendanceMonthSummary({
  summary,
  hasRoster,
  className,
}: {
  summary: MonthlyAttendanceSummary | null
  /** False suppresses the lateness figure - see the docblock. */
  hasRoster?: boolean
  className?: string
}) {
  if (!summary) return null

  const cells: Array<{ label: string; value: string; tone?: string; help?: string }> = [
    { label: 'Present', value: String(summary.present_days), tone: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Absent', value: String(summary.absent_days), tone: 'text-rose-700 dark:text-rose-300' },
    {
      label: 'Late',
      // Not the server's 0 when there is nothing to be late against.
      value: hasRoster === false ? '—' : String(summary.late_days),
      tone: 'text-amber-700 dark:text-amber-300',
      help: hasRoster === false ? 'No roster, so lateness cannot be calculated' : undefined,
    },
    { label: 'Leave', value: String(summary.leave_days), tone: 'text-indigo-700 dark:text-indigo-300' },
    { label: 'Holiday', value: String(summary.holiday_days), tone: 'text-teal-700 dark:text-teal-300' },
    { label: 'Non-working', value: String(summary.weekend_days), tone: 'text-muted-foreground' },
  ]

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">This month</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {summary.working_days} working {summary.working_days === 1 ? 'day' : 'days'} of{' '}
          {summary.total_days}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dd
              className={cn('text-xl font-semibold tabular-nums', cell.tone ?? 'text-foreground')}
              title={cell.help}
            >
              {cell.value}
            </dd>
            <dt className="truncate text-xs text-muted-foreground">{cell.label}</dt>
          </div>
        ))}
      </dl>

      {hasRoster === false && (
        <p className="mt-3 text-xs text-violet-700 dark:text-violet-300">
          This employee has no rostered working days, so &ldquo;Absent&rdquo; and
          &ldquo;Non-working&rdquo; above are the server&apos;s best guess rather than a
          measurement, and lateness cannot be calculated at all.
        </p>
      )}
    </div>
  )
}
