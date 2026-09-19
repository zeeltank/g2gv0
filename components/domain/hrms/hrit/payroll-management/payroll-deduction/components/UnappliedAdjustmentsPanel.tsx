'use client'

import * as React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  HEAD_PROBLEM_LABELS,
  useDeductionOrphans,
  type OrphanRow,
} from '@/hooks/use-deduction-orphans'

/**
 * Q9 / F-173. The adjustments payroll has never applied.
 *
 * These rows were entered on THIS screen, which reported success, and every
 * payroll run since has skipped them because their month is stored as "8" or
 * "3" instead of "Aug" or "Mar". On this deployment that is 343,001 across
 * eleven rows.
 *
 * Three deliberate choices:
 *
 *  - The stored month is shown VERBATIM. "8" is the evidence; rendering it as
 *    "August" would be the guess this whole finding exists to avoid.
 *  - There is no "fix all". No rule can derive the right month from "3", so a
 *    bulk button would be a guess wearing a label. One row, one decision.
 *  - The pay head's own problem is shown next to the month's, because all
 *    eleven point at a soft-deleted head: re-dating alone would not make them
 *    apply, and finding that out afterwards would waste the HR user's time.
 */
export function UnappliedAdjustmentsPanel() {
  const {
    loading,
    processing,
    error,
    actionMessage,
    rows,
    months,
    total,
    loaded,
    resolve,
    retry,
    clearMessages,
  } = useDeductionOrphans()

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [],
  )

  // Per-row month choice. Never pre-filled: an empty select is honest about
  // the fact that nothing here knows which month was meant.
  const [chosen, setChosen] = React.useState<Record<string, string>>({})
  const [confirmingDelete, setConfirmingDelete] = React.useState<string | null>(null)

  // Nothing to show, and nothing went wrong: stay out of the way entirely.
  if (loaded && rows.length === 0 && !error) return null

  // A failed check is not "no problems found". Say which it is.
  if (error && !loaded) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {error} This is a failure to check, not a clean result &mdash; there may still be
            adjustments payroll is skipping.
          </span>
          <Button variant="outline" size="sm" onClick={retry} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Check again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!loaded && loading) return null

  return (
    <section className="rounded-xl border border-destructive/40 bg-destructive/5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-destructive/30 p-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            {rows.length} {rows.length === 1 ? 'adjustment has' : 'adjustments have'} never been
            applied
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Payroll matches the month exactly. These were saved with a month it cannot read &mdash;
            the value is shown below as it is stored &mdash; so every payroll run since has skipped
            them, worth{' '}
            <span className="font-semibold text-foreground">{money.format(total)}</span> in total.
            Nothing here guesses what was meant; choose the month or remove the row.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={retry} disabled={loading || processing}>
          <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {(error || actionMessage) && (
        <div className="px-4 pt-4">
          <Alert variant={error ? 'destructive' : undefined}>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error ?? actionMessage}</span>
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-3 py-2 font-semibold">Employee</th>
              <th scope="col" className="px-3 py-2 font-semibold">Pay Head</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
              <th scope="col" className="px-3 py-2 font-semibold">Stored as</th>
              <th scope="col" className="px-3 py-2 font-semibold">Entered on</th>
              <th scope="col" className="px-3 py-2 font-semibold">File under</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <OrphanRowView
                key={row.id}
                row={row}
                months={months}
                money={money}
                processing={processing}
                chosenMonth={chosen[String(row.id)] ?? ''}
                onChooseMonth={(value) =>
                  setChosen((prev) => ({ ...prev, [String(row.id)]: value }))
                }
                confirmingDelete={confirmingDelete === String(row.id)}
                onAskDelete={() => setConfirmingDelete(String(row.id))}
                onCancelDelete={() => setConfirmingDelete(null)}
                onResolve={async (action, month) => {
                  const result = await resolve(row.id, action, month)
                  if (result.ok) {
                    setConfirmingDelete(null)
                    setChosen((prev) => {
                      const next = { ...prev }
                      delete next[String(row.id)]
                      return next
                    })
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function OrphanRowView({
  row,
  months,
  money,
  processing,
  chosenMonth,
  onChooseMonth,
  confirmingDelete,
  onAskDelete,
  onCancelDelete,
  onResolve,
}: {
  row: OrphanRow
  months: string[]
  money: Intl.NumberFormat
  processing: boolean
  chosenMonth: string
  onChooseMonth: (value: string) => void
  confirmingDelete: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onResolve: (action: 'set-month' | 'delete', month?: string) => void
}) {
  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-3 py-3">
        <div className="font-medium text-foreground">{row.employeeName}</div>
        {row.employeeNo && <div className="text-xs text-muted-foreground">{row.employeeNo}</div>}
      </td>
      <td className="px-3 py-3">
        <div className="text-foreground">{row.headName}</div>
        {row.headProblem && (
          <div className="mt-0.5 text-xs font-medium text-destructive">
            {HEAD_PROBLEM_LABELS[row.headProblem]}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">{money.format(row.amount)}</td>
      <td className="px-3 py-3">
        {/* Verbatim. Rendering "8" as "August" would be the guess. */}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {row.storedMonth || '(blank)'}
        </code>
        <span className="ml-1 text-xs text-muted-foreground">{row.year}</span>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">
        {/*
          The evidence that usually settles it. A row stored as month "8" but
          entered in December, or year 2020 entered in 2025, says more about
          what happened than the month field does - and neither this screen nor
          anyone reading it should guess from the month alone.
        */}
        {row.enteredOn || '—'}
      </td>
      <td className="px-3 py-3">
        <Select
          value={chosenMonth}
          onChange={onChooseMonth}
          options={months.map((month) => ({ value: month, label: `${month} ${row.year}` }))}
          placeholder="Choose a month"
          size="sm"
          disabled={processing}
          aria-label={`Month for the ${row.headName} adjustment against ${row.employeeName}`}
        />
      </td>
      <td className="px-3 py-3">
        {confirmingDelete ? (
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-muted-foreground">
              Remove {money.format(row.amount)}?
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onCancelDelete} disabled={processing}>
                Keep
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={processing}
                onClick={() => onResolve('delete')}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={processing || !chosenMonth}
              onClick={() => onResolve('set-month', chosenMonth)}
              title={chosenMonth ? undefined : 'Choose a month first'}
            >
              File it
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={processing}
              onClick={onAskDelete}
            >
              Remove
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}
