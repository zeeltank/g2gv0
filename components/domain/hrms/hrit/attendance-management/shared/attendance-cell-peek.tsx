'use client'

import * as React from 'react'
import { CalendarClock, History, Pencil, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  latenessMinutes,
  statusHelp,
  statusLabel,
  type AttendanceDayCell,
} from './attendance-day-status'

/**
 * The detail behind a day cell - one popover for the whole grid.
 *
 * ── WHY ONE, AND WHY A POPOVER AT ALL ───────────────────────────────────────
 *
 * Everything a cell could not fit used to live in a `title=` attribute: worked
 * duration, the expected shift, the work mode, whether HR had changed it. A
 * native tooltip appears on hover and **never on focus**, so none of it was
 * reachable by keyboard - the largest accessibility gap on the screen, and the
 * reason this exists rather than a prettier `title`.
 *
 * `components/ui/tooltip.tsx` could not be used: it is hand-rolled, absolutely
 * positioned inside a `relative` wrapper, and therefore **clipped by the grid's
 * own `overflow-x-auto`** - the tooltip for any cell past the fold would render
 * inside the scroll box and be cut off. Radix's Popover portals out of it.
 *
 * But a Popover root per cell would be ~1,550 roots on a 50x31 grid. So the
 * grid holds one `peek` state, each tile reports its own `getBoundingClientRect`
 * on hover/focus, and this component anchors a single popover to a zero-size
 * fixed element at that rect.
 *
 * ── THE CLOSE DELAY IS LOAD-BEARING ─────────────────────────────────────────
 *
 * The card carries buttons, so the pointer has to be able to travel from the
 * cell into the card without the card closing underneath it. `usePeek` below
 * holds the close for ~140ms and cancels it if the pointer arrives.
 */

export interface PeekTarget {
  rect: DOMRect
  date: string
  cell: AttendanceDayCell
  employeeName?: string
  employeeId?: number
  /** Only HR sees the correction action; the server still decides. */
  canCorrect?: boolean
}

/**
 * The open/close state for a shared peek, with the hand-off delay.
 *
 * Returned as handlers rather than a component so the grid can pass `open`
 * straight to a tile's `onPeek`/`onPeekEnd` without re-rendering the whole
 * table on every mouse move.
 */
export function usePeek() {
  const [target, setTarget] = React.useState<PeekTarget | null>(null)
  const closing = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = React.useCallback(() => {
    if (closing.current) {
      clearTimeout(closing.current)
      closing.current = null
    }
  }, [])

  const open = React.useCallback(
    (next: PeekTarget) => {
      cancelClose()
      setTarget(next)
    },
    [cancelClose],
  )

  // Delayed, so the pointer can cross the gap between the cell and the card.
  const close = React.useCallback(() => {
    cancelClose()
    closing.current = setTimeout(() => setTarget(null), 140)
  }, [cancelClose])

  const closeNow = React.useCallback(() => {
    cancelClose()
    setTarget(null)
  }, [cancelClose])

  React.useEffect(() => cancelClose, [cancelClose])

  return { target, open, close, closeNow, cancelClose }
}

export function AttendanceCellPeek({
  target,
  onCancelClose,
  onClose,
  onCorrect,
  onOpenHistory,
  onOpenEmployee,
}: {
  target: PeekTarget | null
  onCancelClose: () => void
  onClose: () => void
  onCorrect?: (target: PeekTarget) => void
  onOpenHistory?: (target: PeekTarget) => void
  onOpenEmployee?: (target: PeekTarget) => void
}) {
  const cell = target?.cell
  const delta = cell ? latenessMinutes(cell) : null

  return (
    <Popover open={target !== null}>
      {/*
        * A zero-size fixed anchor at the cell's rect. `pointer-events-none` so
        * it can never intercept a click meant for the cell underneath it.
        */}
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={
            target
              ? { left: target.rect.left, top: target.rect.top, width: target.rect.width, height: target.rect.height }
              : { left: 0, top: 0 }
          }
        />
      </PopoverAnchor>

      {target && cell && (
        <PopoverContent
          side="top"
          align="center"
          sideOffset={6}
          // Radix would otherwise pull focus into the card on open, which steals
          // it from the cell the user is arrowing through.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={onCancelClose}
          onMouseLeave={onClose}
          className="w-72 p-0 text-sm"
        >
          <div className="border-b border-border px-3 py-2">
            {target.employeeName && (
              <p className="truncate font-medium text-foreground">{target.employeeName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(`${target.date}T00:00:00`).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>

          <div className="flex flex-col gap-2 px-3 py-2.5">
            <div>
              <p className="font-medium text-foreground">{statusLabel(cell.status)}</p>
              {/* One sentence on what the word means. "Absent" and "No roster"
                  are different answers and the difference is the point. */}
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {statusHelp(cell.status)}
              </p>
            </div>

            {(cell.in || cell.out) && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">Punched</dt>
                <dd className="tabular-nums text-foreground">
                  {cell.in ?? '--:--'} &ndash; {cell.out ?? '--:--'}
                </dd>
                {cell.duration && (
                  <>
                    <dt className="text-muted-foreground">Worked</dt>
                    <dd className="tabular-nums text-foreground">{cell.duration.slice(0, 5)}</dd>
                  </>
                )}
                {cell.work_mode && (
                  <>
                    <dt className="text-muted-foreground">From</dt>
                    <dd className="capitalize text-foreground">{cell.work_mode}</dd>
                  </>
                )}
              </dl>
            )}

            {/* The rostered hours, or the honest absence of them. */}
            <p className="text-xs text-muted-foreground">
              {cell.shift_in && cell.shift_out ? (
                <>
                  Expected <span className="tabular-nums text-foreground">{cell.shift_in}&ndash;{cell.shift_out}</span>
                </>
              ) : cell.shift_in ? (
                <>
                  Expected from <span className="tabular-nums text-foreground">{cell.shift_in}</span>
                </>
              ) : (
                <span className="text-violet-700 dark:text-violet-300">
                  No rostered hours for this day, so lateness cannot be calculated.
                </span>
              )}
            </p>

            {delta !== null && delta !== 0 && (
              <p className={delta > 0 ? 'text-xs text-rose-700 dark:text-rose-300' : 'text-xs text-emerald-700 dark:text-emerald-300'}>
                {delta > 0 ? `${delta} minutes late` : `${Math.abs(delta)} minutes early`}
              </p>
            )}

            {cell.leave_type && (
              <p className="text-xs text-muted-foreground">
                Leave: <span className="text-foreground">{cell.leave_type}</span>
                {cell.leave_reason ? ` — ${cell.leave_reason}` : ''}
              </p>
            )}

            {cell.holiday_name && (
              <p className="text-xs text-muted-foreground">{cell.holiday_name}</p>
            )}

            {cell.edited && (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Pencil className="size-3" aria-hidden="true" />
                Changed by HR
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1 border-t border-border px-2 py-1.5">
            {onCorrect && target.canCorrect && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onCorrect(target)}>
                <Clock className="mr-1.5 size-3" />
                {cell.in || cell.out ? 'Correct this day' : 'Add this day'}
              </Button>
            )}
            {/* Only offered where there is something to show - the grid's own
                `edited` flag is what says a change record exists. */}
            {onOpenHistory && cell.edited && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenHistory(target)}>
                <History className="mr-1.5 size-3" />
                See what changed
              </Button>
            )}
            {onOpenEmployee && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenEmployee(target)}>
                <CalendarClock className="mr-1.5 size-3" />
                Open month
              </Button>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}
