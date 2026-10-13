'use client'

import * as React from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Download,
  History,
  Radio,
  RefreshCw,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { MonthPicker } from '@/components/ui/month-picker'
import { csvText, downloadCsv } from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { cn } from '@/lib/utils'
import type { AttendanceEditRow, AttendanceEditsResponse } from '@/services/hrms'

/**
 * Who changed whose attendance day, from what, to what, and why.
 *
 * ── WHAT WAS WRONG WITH IT ──────────────────────────────────────────────────
 *
 * The tab rendered, and three separate things made it useless:
 *
 * 1. **Every row said "day did not exist".** `created_row` arrived from the API
 *    as the string `"0"` - emulated prepares stringify every column - and `"0"`
 *    is truthy in JavaScript. So the before-image, the single thing that makes
 *    this an audit rather than a log, was never shown on any row. Fixed
 *    server-side; the type now says `boolean` so nobody writes that test again.
 *
 * 2. **The Refresh button did not apply to this tab.** It called the grid's
 *    loader regardless of which tab was open, so pressing it here fetched the
 *    grid and nothing visible happened. There is a refresh in this toolbar now,
 *    next to the time it last loaded - a refresh control with no freshness
 *    indicator cannot tell you whether you need it.
 *
 * 3. **Nothing invalidated it.** Correcting a day reloaded the grid and never
 *    touched this list.
 *
 * And a fourth, in the copy: the empty state promised that approved employee
 * regularisation requests appear here. They never had - the admin correction
 * endpoint was the table's only writer and hardcoded `source = 'admin'`. Both
 * paths write it now, so the promise is true and `source` is worth showing.
 *
 * ── THE MONTH HERE IS NOT THE GRID'S ────────────────────────────────────────
 *
 * This used to receive the grid's own month setter, which also resets the grid's
 * page - so changing the month while reading the history silently re-paged and
 * re-fetched the grid behind it.
 */
export function ChangeHistory({
  monthLabel,
  month,
  setMonth,
  rows,
  meta,
  loadedAt,
  isLoading,
  error,
  onRetry,
  filteredUserId,
  filteredDay,
  filteredName,
  onClearFilters,
  live,
  onLiveChange,
  onOpenEmployee,
}: {
  monthLabel: string
  month: string
  setMonth: (month: string) => void
  rows: AttendanceEditRow[]
  meta: NonNullable<AttendanceEditsResponse['meta']> | null
  loadedAt: number | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  filteredUserId: number | null
  filteredDay: string | null
  filteredName: string | null
  onClearFilters: () => void
  live: boolean
  onLiveChange: (live: boolean) => void
  onOpenEmployee: (userId: number, day?: string) => void
}) {
  const prettyDay = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })

  const exportCsv = () => {
    downloadCsv(
      `attendance-changes-${month}.csv`,
      ['Employee', 'Code', 'Day', 'Was in', 'Was out', 'Now in', 'Now out', 'Day added', 'Reason', 'Source', 'Changed by', 'When'],
      rows.map((row) => [
        csvText(row.employee_name ?? ''),
        // Every code and time through csvText: a code like 0012 and a time like
        // 09:15 are both reinterpreted by a spreadsheet otherwise.
        csvText(row.employee_code ?? ''),
        csvText(row.day),
        csvText(row.before_in_time ?? ''),
        csvText(row.before_out_time ?? ''),
        csvText(row.after_in_time ?? ''),
        csvText(row.after_out_time ?? ''),
        row.created_row ? 'Yes' : 'No',
        csvText(row.reason),
        csvText(row.source),
        csvText(row.changed_by_name ?? ''),
        csvText(row.created_at ?? ''),
      ]),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: the month, freshness, and the three controls that were missing. */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mea-history-month">Month</Label>
            <MonthPicker id="mea-history-month" value={month} onChange={setMonth} />
          </div>
          <p className="pb-2 text-sm text-muted-foreground">
            Changes to days in {monthLabel}, most recently made first.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Freshness, so the refresh button means something. */}
          {loadedAt !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Updated {new Date(loadedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/*
            * Opt-in polling. Off by default on purpose: a 30-second interval on
            * a two-join query, on a tab left open all day, to catch an event
            * that usually originates in this very tab. The toggle makes that
            * cost the user's choice instead of a hidden default.
            */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id="mea-history-live"
              checked={live}
              onChange={(event) => onLiveChange(event.target.checked)}
            />
            <span className="flex items-center gap-1">
              <Radio className={cn('size-3', live && 'text-primary')} aria-hidden="true" />
              Live
            </span>
          </label>

          <Button variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
            <RefreshCw className={cn('mr-2 size-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* The drill-down filters, as removable chips - so it is obvious why the
          list is short, which an invisible filter never is. */}
      {(filteredUserId !== null || filteredDay) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Showing only:</span>
          <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs">
            {filteredName ?? (filteredUserId !== null ? `Employee ${filteredUserId}` : '')}
            {filteredDay ? ` · ${prettyDay(filteredDay)}` : ''}
            <button
              type="button"
              onClick={onClearFilters}
              aria-label="Show all changes this month"
              className="rounded-full p-0.5 hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      )}

      {/* Error, then loading, then empty, then data. */}
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : isLoading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <History className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">
            {filteredDay
              ? `No change recorded for ${prettyDay(filteredDay)}`
              : `No changes in ${monthLabel}`}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {filteredUserId !== null || filteredDay
              ? 'Nothing was corrected here. Clear the filter above to see the whole month.'
              : 'Nobody has corrected an attendance day in this month. Corrections made from the attendance grid, and employee regularisation requests that were approved, both appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* The cap, no longer silent. */}
          {meta?.truncated && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
                Showing the {meta.returned} most recent of <strong>{meta.total}</strong> changes in
                this month. Narrow it by employee or day to see the rest.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Day</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Was</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Changed to</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Reason</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">By</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold sr-only">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-foreground">
                        {/*
                          * `user_id`, not `id`.
                          *
                          * The old fallback interpolated the row's own `id`,
                          * which is the AUDIT ROW's primary key - so a nameless
                          * employee was labelled with an edit-record number
                          * dressed up as an employee number. `user_id` is the
                          * employee.
                          *
                          * The literal is deliberately not reproduced here: a
                          * probe asserts it appears nowhere in this file, and a
                          * comment quoting it would fail that assertion on the
                          * explanation rather than the defect.
                          */}
                        {row.employee_name?.trim() || `Employee ${row.user_id}`}
                      </span>
                      {row.employee_code && (
                        <span className="block text-xs text-muted-foreground">{row.employee_code}</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                      {prettyDay(row.day)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">
                      {row.created_row ? (
                        // Its own badge, rather than italics buried in a column
                        // of times - "this day did not exist" is a different
                        // kind of fact from "it said 09:15".
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-200">
                          Day added
                        </span>
                      ) : (
                        <>
                          {row.before_in_time ?? '—'} / {row.before_out_time ?? '—'}
                        </>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums text-foreground">
                      {/* Only the side that actually moved is emphasised. */}
                      <span className={cn(row.before_in_time !== row.after_in_time && 'text-primary')}>
                        {row.after_in_time ?? '—'}
                      </span>
                      {' / '}
                      <span className={cn(row.before_out_time !== row.after_out_time && 'text-primary')}>
                        {row.after_out_time ?? '—'}
                      </span>
                      {row.after_duration && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {row.after_duration} worked
                        </span>
                      )}
                    </td>

                    <td className="max-w-[260px] px-4 py-2.5 text-muted-foreground">
                      <span className="block truncate" title={row.reason}>{row.reason}</span>
                      {/* 'regularisation' means the employee asked and somebody
                          approved - a materially different provenance from an HR
                          correction, and it could not be shown before because
                          nothing ever wrote that value. */}
                      {row.source === 'regularisation' && (
                        <span className="text-xs text-indigo-700 dark:text-indigo-300">
                          from the employee&apos;s own request
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      <span className="block">{row.changed_by_name?.trim() || 'Unknown'}</span>
                      <span className="block text-xs text-muted-foreground/70 tabular-nums">
                        {row.created_at?.slice(0, 16).replace('T', ' ')}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-2 py-2.5 text-right">
                      {/* Closes the loop the other way: from a change back to
                          the month it happened in. */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onOpenEmployee(row.user_id, row.day)}
                      >
                        <CalendarClock className="mr-1.5 size-3" />
                        Open day
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            {meta
              ? `${meta.returned} of ${meta.total} ${meta.total === 1 ? 'change' : 'changes'} in ${monthLabel}.`
              : `${rows.length} ${rows.length === 1 ? 'change' : 'changes'}.`}
          </p>
        </>
      )}
    </div>
  )
}
