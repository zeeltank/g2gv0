'use client'

import * as React from 'react'
import { AlertCircle, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLaravelContext } from '@/lib/laravel-context'
import { nineBoxService, type NineBox } from '@/services/competency/nine-box'

/**
 * PERFORMANCE x CAPABILITY, and the capability axis is the capability chain.
 *
 * This is the join the whole plan has been building toward: a manager's rating
 * on one axis, `ProficiencyService`'s weighted roll-up of KASBA items on the
 * other. The endpoint has been correct for some time and had no caller.
 *
 * ── THE TWO THINGS THIS SCREEN MUST NOT DO ─────────────────────────────────
 *
 * 1. PUT AN UNMEASURED EMPLOYEE IN A BOX. `capability: null` means nobody has
 *    assessed them. Dropping such a person at low-capability would assert a
 *    measurement that was never taken — and it is the single most likely way a
 *    grid like this does harm, because a box is read as a judgement.
 *
 * 2. HIDE THEM. They are counted, named and listed beneath the grid. A 9-box
 *    that silently omits people overstates how much of the workforce it
 *    describes, and the server returns `unplaced` precisely so this cannot
 *    happen by accident.
 */

/** Rows are capability high→low so the grid reads like the conventional 9-box. */
const CAPABILITY_ROWS = ['high', 'medium', 'low'] as const
const PERFORMANCE_COLS = ['low', 'medium', 'high'] as const

/** The conventional names. Shown so a box is more than a coordinate. */
const BOX_LABELS: Record<string, string> = {
  'high:high':     'Star',
  'high:medium':   'High performer',
  'high:low':      'High impact, low capability',
  'medium:high':   'High potential',
  'medium:medium': 'Core',
  'medium:low':    'Inconsistent',
  'low:high':      'Under-used capability',
  'low:medium':    'Developing',
  'low:low':       'Needs attention',
}

export function NineBoxGrid() {
  const [data, setData] = React.useState<NineBox | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await nineBoxService.get(getLaravelContext())
        if (!cancelled) setData(res.data)
      } catch (e) {
        // A REFUSAL IS NOT AN EMPTY GRID. The endpoint is admin/HR only and
        // returns 403 to anyone else; rendering that as "nobody to show" would
        // read as a fact about the workforce.
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load the 9-box grid.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Reading performance ratings and capability measurements…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-6">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">The 9-box grid is unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // The endpoint's own words for why there is nothing to draw, not reworded.
  if (data.note) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
        <Users className="mx-auto size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-foreground">No grid to draw yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{data.note}</p>
      </div>
    )
  }

  const unplacedEmployees = data.employees.filter((e) => e.box === null)
  const max = Math.max(1, ...Object.values(data.grid))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Performance × Capability</h3>
          <p className="text-xs text-muted-foreground">
            Capability is the weighted roll-up of each employee&apos;s assessed competencies against their role.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{data.placed}</span> placed
          {data.unplaced > 0 && <> · <span className="font-bold text-amber-600">{data.unplaced}</span> not placeable</>}
        </p>
      </div>

      <div className="flex gap-3">
        {/* Axis label, rotated, so the grid itself stays uncluttered. */}
        <div className="flex w-6 shrink-0 items-center justify-center">
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            Capability →
          </span>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="grid min-w-[420px] grid-cols-3 gap-2">
            {CAPABILITY_ROWS.map((cap) =>
              PERFORMANCE_COLS.map((perf) => {
                const key = `${perf}:${cap}`
                const n = data.grid[key] ?? 0
                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      n > 0 ? 'border-primary/20 bg-primary/5' : 'border-dashed border-border bg-muted/10',
                    )}
                    style={n > 0 ? { backgroundColor: `hsl(var(--primary) / ${0.04 + (n / max) * 0.12})` } : undefined}
                  >
                    <p className="text-lg font-bold text-foreground">{n}</p>
                    <p className="mt-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                      {BOX_LABELS[key] ?? key}
                    </p>
                  </div>
                )
              }),
            )}
          </div>

          <div className="mt-2 grid min-w-[420px] grid-cols-3 gap-2">
            {PERFORMANCE_COLS.map((p) => (
              <p key={p} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {p} performance
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* THE BANDS THAT PRODUCED EACH POSITION. Returned by the server for
          exactly this reason: a box is a conclusion, and a reader should be
          able to see the rule behind it rather than trusting the square. */}
      <p className="text-[11px] text-muted-foreground">
        Bands — performance: low &lt; {data.bands.performance.low}, medium &lt; {data.bands.performance.medium}, then high.
        Capability uses the same 1–5 space: low &lt; {data.bands.capability.low}, medium &lt; {data.bands.capability.medium}.
        The two axes are <span className="font-semibold text-foreground">not rescaled to match</span> — one is a typed
        rating, the other a weighted roll-up.
      </p>

      {/* NOT PLACEABLE — rendered, never dropped. */}
      {unplacedEmployees.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-bold uppercase text-amber-600">
            {unplacedEmployees.length} employee{unplacedEmployees.length === 1 ? '' : 's'} cannot be placed
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            They have a performance rating but no capability measurement, so the grid has nothing to place them
            against. They are <span className="font-semibold text-foreground">not</span> shown at low capability —
            that would assert an assessment nobody made. Assess them against their role&apos;s competencies, or map
            competencies to their role if none are set.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {unplacedEmployees.slice(0, 12).map((e) => (
              <li key={e.user_id} className="text-[11px] text-foreground/80">
                Employee #{e.user_id}
                <span className="text-muted-foreground">
                  {' '}— performance {e.performance},{' '}
                  {e.competencies_required === 0 ? 'no competencies set for their role' : 'no competency assessed'}
                </span>
              </li>
            ))}
            {unplacedEmployees.length > 12 && (
              <li className="text-[11px] text-muted-foreground">…and {unplacedEmployees.length - 12} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
