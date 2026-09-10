'use client'

import * as React from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { payrollService, type PayrollMonthLockResponse } from '@/services/hrms/payroll'

/**
 * Declare a payroll month finished, or reopen it with a reason. F-129.
 *
 * Sprint 6 stopped a re-save DUPLICATING a month (live data held 17 payslips for
 * one employee-month). It did not stop a re-save happening — and once salaries
 * are paid, silently rewriting the figures behind them is its own defect.
 *
 * THE SERVER ENFORCES THIS, NOT THIS COMPONENT. `monthlyPayrollStore` checks the
 * lock before it writes and returns the refusal. This card reads the same
 * endpoint that enforces it, so the two cannot disagree — and if this file were
 * deleted the lock would still hold. That ordering is the lesson from F-91,
 * where payroll's only gate was a React component.
 *
 * REOPENING NEEDS A REASON, and the field is required by the server too. A lock
 * that can be lifted silently is not a lock; "why were March's figures changed
 * after we paid them?" should be answerable from the data rather than from
 * somebody's memory.
 */
export function MonthLockCard({
  month,
  year,
  onChange,
  className,
}: {
  month: string
  year: number
  /** Told after a successful lock or reopen, so the register can refresh. */
  onChange?: (locked: boolean) => void
  className?: string
}) {
  const { user } = useAuth()

  const [state, setState] = React.useState<PayrollMonthLockResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [reopening, setReopening] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!month || !year) return
    setLoading(true)
    setError(null)
    try {
      const next = await payrollService.getMonthLock(getLaravelContext(user), { month, year })
      setState(next)
      /*
       * Report the lock state on LOAD, not only after a lock/reopen action.
       *
       * onChange used to fire only from act(), so the page never learned that
       * the month it was showing was already locked - and "Generate Payroll"
       * stayed enabled on a month the server was going to refuse. The person
       * reads that refusal as a bug in the button, not as the lock working.
       */
      onChange?.(Boolean(next?.locked))
    } catch {
      // A month whose lock state cannot be read is NOT reported as open — that
      // would invite a save the server is about to refuse, and the person would
      // reasonably read the refusal as a bug.
      setState(null)
      setError('Could not read this month’s lock state.')
    } finally {
      setLoading(false)
    }
  }, [month, year, user, onChange])

  React.useEffect(() => {
    void load()
  }, [load])

  const act = async (action: 'lock' | 'reopen') => {
    setBusy(true)
    setError(null)
    try {
      const response = await payrollService.setMonthLock(getLaravelContext(user), {
        month,
        year,
        action,
        ...(action === 'reopen' ? { reason: reason.trim() } : {}),
      })

      if (String(response.status ?? response.status_code) === '0') {
        setError(response.message || 'That did not work.')
        return
      }

      setState(response)
      setReopening(false)
      setReason('')
      onChange?.(Boolean(response.locked))
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !state) {
    return error ? (
      <Alert variant="destructive" className={className}>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null
  }

  const locked = Boolean(state.locked)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between',
        locked ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/30',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            locked ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
          )}
        >
          {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {month} {year} is {locked ? 'locked' : 'open'}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {locked
              ? `Saving it again is refused${state.locked_by ? ` — locked by ${state.locked_by}` : ''}${
                  state.locked_at ? ` on ${state.locked_at}` : ''
                }.`
              : 'Saving it again replaces this month’s figures. Lock it once the salaries are paid.'}
          </p>
          {/* The reopen is part of the record, so it stays visible afterwards. */}
          {!locked && state.reopen_reason && (
            <p className="mt-1 text-xs text-muted-foreground">
              Reopened{state.reopened_at ? ` on ${state.reopened_at}` : ''}: “{state.reopen_reason}”
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-80">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!locked && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act('lock')}>
            <Lock className="mr-2 size-4" />
            Lock {month} {year}
          </Button>
        )}

        {locked && !reopening && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setReopening(true)}>
            <LockOpen className="mr-2 size-4" />
            Reopen this month
          </Button>
        )}

        {locked && reopening && (
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Why is it being reopened?"
              aria-label="Reason for reopening the month"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy || reason.trim().length === 0}
                onClick={() => act('reopen')}
              >
                Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setReopening(false)
                  setReason('')
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The reason is stored against the month, with your name and the time.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
