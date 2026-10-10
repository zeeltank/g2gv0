'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  latenessMinutes,
  statusClass,
  statusGlyph,
  statusLabel,
  type AttendanceDayCell,
} from './attendance-day-status'

/**
 * One attendance day, drawn once and rendered by both screens.
 *
 * The employees-down matrix and the per-employee calendar used to be different
 * components with different vocabularies, and a day could therefore look like
 * two different things depending on where you were standing. This is the one
 * place a day gets drawn.
 *
 * ── WHAT A CELL SHOWS, AND WHAT IT DOES NOT ─────────────────────────────────
 *
 * A compact cell is 28px square - 31 of them plus a 240px name column is about
 * as wide as a laptop screen - so it cannot show status, both punch times,
 * worked hours and the expected shift at once. Trying to is how it became
 * unreadable at 46px. Two facts live in the tile; everything else lives in the
 * hover/focus reveal the caller supplies.
 *
 * The two facts are the FILL (status) and the CENTRE VALUE (worked duration,
 * which is what HR actually scans for and which previously existed only inside
 * a `title=` attribute nobody could reach by keyboard).
 *
 * ── THREE CHANNELS, NOT ONE ─────────────────────────────────────────────────
 *
 * Colour alone fails for a colour-blind reader and fails again on a greyscale
 * printer - and the print rules force backgrounds precisely because on this
 * screen the fills ARE the data. So:
 *
 *   fill          the status
 *   edge rail     whether the day is complete (both punches / one / none)
 *   base marker   early or late against the rostered start
 *
 * ── THE BASE MARKER IS DRAWN ONLY WHEN IT CAN BE ────────────────────────────
 *
 * `latenessMinutes()` returns null unless BOTH the punch and the rostered start
 * exist, and this component honours that rather than falling back to zero. Two
 * live endpoints compute lateness against `monday_in_date` for every day of the
 * week, which produces a confident number for the 2,008 employees who have no
 * roster at all. No marker is the honest rendering of "we cannot say".
 */

export type TileDensity =
  /** 28px. Fill, rail, duration or glyph. The matrix default. */
  | 'compact'
  /** 46px. Adds the base marker room and a larger glyph. */
  | 'comfortable'
  /** 46px. Shows the two punch times instead of the duration. */
  | 'times'
  /** Fills its container. For the calendar, where a cell is ~90px. */
  | 'roomy'

const DENSITY_CLASS: Record<TileDensity, string> = {
  compact: 'h-7 min-w-[28px] text-[9px]',
  comfortable: 'h-10 min-w-[46px] text-[10px]',
  times: 'h-10 min-w-[46px] text-[10px]',
  roomy: 'h-full min-h-[64px] w-full text-xs',
}

/**
 * The sentence a screen reader hears and the reveal repeats.
 *
 * Exported because the matrix needs it for `aria-label` on every cell. The
 * previous implementation put this in `title=`, which no keyboard user ever
 * saw - the single biggest accessibility gap on the screen.
 */
export function describeDay(
  cell: AttendanceDayCell,
  date: string,
  employeeName?: string,
): string {
  const parts: string[] = []

  if (employeeName) parts.push(employeeName)

  parts.push(
    new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    statusLabel(cell.status),
  )

  if (cell.in || cell.out) parts.push(`In ${cell.in ?? '--'}, out ${cell.out ?? '--'}`)
  if (cell.duration) parts.push(`Worked ${cell.duration}`)

  const delta = latenessMinutes(cell)
  if (delta !== null && delta !== 0) {
    parts.push(delta > 0 ? `${delta} minutes late` : `${Math.abs(delta)} minutes early`)
  }

  if (cell.shift_in && cell.shift_out) {
    parts.push(`Expected ${cell.shift_in}-${cell.shift_out}`)
  } else if (cell.shift_in) {
    parts.push(`Expected from ${cell.shift_in}`)
  } else if (cell.status !== 'upcoming') {
    parts.push('No rostered hours for this day')
  }

  if (cell.leave_type) parts.push(`Leave: ${cell.leave_type}`)
  if (cell.holiday_name) parts.push(cell.holiday_name)
  if (cell.work_mode && cell.work_mode !== 'office') parts.push(cell.work_mode)
  if (cell.edited) parts.push('Changed by HR')

  return parts.join(' · ')
}

export function AttendanceDayTile({
  cell,
  date,
  employeeName,
  density = 'compact',
  dayNumber,
  isToday,
  selected,
  onActivate,
  onPeek,
  onPeekEnd,
  className,
}: {
  cell: AttendanceDayCell
  date: string
  employeeName?: string
  density?: TileDensity
  /** Rendered in `roomy` only - the calendar draws its own date number. */
  dayNumber?: number
  isToday?: boolean
  selected?: boolean
  onActivate?: () => void
  /** Hover/focus in, with the tile's own rect so one shared popover can anchor to it. */
  onPeek?: (rect: DOMRect) => void
  onPeekEnd?: () => void
  className?: string
}) {
  const label = describeDay(cell, date, employeeName)
  const delta = latenessMinutes(cell)
  const hasPunch = Boolean(cell.in || cell.out)
  const complete = Boolean(cell.in && cell.out)

  const peek = (event: React.SyntheticEvent<HTMLElement>) => {
    onPeek?.(event.currentTarget.getBoundingClientRect())
  }

  const Element = onActivate ? 'button' : 'div'

  return (
    <Element
      {...(onActivate ? { type: 'button' as const, onClick: onActivate } : {})}
      onMouseEnter={onPeek ? peek : undefined}
      onFocus={onPeek ? peek : undefined}
      onMouseLeave={onPeekEnd}
      onBlur={onPeekEnd}
      aria-label={label}
      // `upcoming` stays clickable - the correction dialog explains why it
      // refuses a future day, which is more useful than an inert cell - but it
      // is announced as unavailable.
      aria-disabled={cell.status === 'upcoming' ? true : undefined}
      className={cn(
        'relative flex w-full flex-col items-center justify-center overflow-hidden rounded',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        DENSITY_CLASS[density],
        statusClass(cell.status),
        onActivate && 'hover:ring-2 hover:ring-primary/50',
        selected && 'ring-2 ring-primary',
        isToday && 'outline outline-1 outline-offset-[-1px] outline-foreground/40',
        className,
      )}
    >
      {/*
        * The edge rail - the second channel.
        *
        * Solid for a complete day, half-height for a day that was started and
        * never closed, nothing at all when there is no row. Survives both a
        * greyscale printer and a colour-blind reader, neither of which the fill
        * alone serves.
        */}
      {hasPunch && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 w-[2px] bg-current opacity-60',
            complete ? 'top-0 h-full' : 'top-0 h-1/2',
          )}
        />
      )}

      {density === 'roomy' && dayNumber !== undefined && (
        <span className="absolute left-1 top-0.5 text-[10px] font-medium tabular-nums opacity-70">
          {dayNumber}
        </span>
      )}

      {/* The centre value. */}
      {density === 'times' && hasPunch ? (
        <>
          <span className="font-medium leading-tight tabular-nums">{cell.in ?? '--:--'}</span>
          <span className="leading-tight tabular-nums opacity-80">{cell.out ?? '--:--'}</span>
        </>
      ) : cell.duration ? (
        <span className={cn('font-medium leading-tight tabular-nums', density === 'roomy' && 'text-sm')}>
          {/* HH:MM, never HH:MM:SS - the two server writers disagree about the
              seconds and a cell is no place to surface that. */}
          {cell.duration.slice(0, 5)}
        </span>
      ) : (
        <span className="font-medium leading-tight">{statusGlyph(cell.status)}</span>
      )}

      {density === 'roomy' && (cell.in || cell.out) && (
        <span className="leading-tight tabular-nums opacity-70">
          {cell.in ?? '--:--'} – {cell.out ?? '--:--'}
        </span>
      )}

      {density === 'roomy' && !cell.in && cell.status !== 'upcoming' && (
        <span className="px-1 text-center text-[10px] leading-tight opacity-80">
          {cell.holiday_name || cell.leave_type || statusLabel(cell.status)}
        </span>
      )}

      {/*
        * The base marker - early left of centre, late right of centre.
        *
        * Absent when `delta` is null, which is the case for every employee with
        * no roster. Showing nothing is the point: there is no start time to be
        * late against, and a marker at centre would read as "on time".
        */}
      {delta !== null && delta !== 0 && density !== 'compact' && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 h-[3px] rounded-full',
            delta > 0 ? 'left-1/2 bg-rose-500/70' : 'right-1/2 bg-emerald-500/70',
          )}
          // Up to half the tile, one pixel per two minutes, so a 40-minute
          // overrun is visibly worse than a 4-minute one without needing a
          // scale nobody would read.
          style={{ width: `${Math.min(50, Math.abs(delta) / 2)}%` }}
        />
      )}

      {/*
        * Changed by HR - a plain corner dot, not a pencil.
        *
        * A glyph at this scale (28px cell, originally a 12px square icon
        * tile) read as clutter rather than information - the metadata was
        * competing with the duration/status it sits on top of. The dot
        * carries the same fact with none of that: it is still its own
        * colour and still announced in `describeDay()`, just without a
        * shape fighting for attention in the corner of every edited cell.
        */}
      {cell.edited && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary ring-1 ring-card"
        />
      )}
    </Element>
  )
}
