'use client'

import * as React from 'react'
import { Clock, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type RegularisationRow } from '@/services/hrms'
import type { AttendanceRecord } from '@/domain/hrms/hrit/attendance-management/types'

/**
 * Ask for an attendance day to be corrected. F-107.
 *
 * The correction itself has existed on the backend all along
 * (POST update_user_att) with nothing calling it, while the Quick Action that
 * should have was `onClick: () => {}` and the alerts panel showed a hardcoded
 * "Regularization Pending (1)" for a feature that did not exist.
 *
 * Re-submitting the same day EDITS the pending request rather than adding a
 * second one — the API enforces that, and this says so, because an approver
 * seeing three versions of one morning is how the wrong one gets applied.
 */
interface RegularisationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects a day when opened from an alert. */
  initialDay?: string | null
  /** The caller's own recent punches, to show what is currently recorded. */
  records: AttendanceRecord[]
  onSubmitted?: () => void
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function RegularisationDrawer({
  open,
  onOpenChange,
  initialDay,
  records,
  onSubmitted,
}: RegularisationDrawerProps) {
  const { user } = useAuth()

  const [day, setDay] = React.useState(initialDay ?? todayIso())
  const [inTime, setInTime] = React.useState('')
  const [outTime, setOutTime] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [mine, setMine] = React.useState<RegularisationRow[]>([])
  const [loadingMine, setLoadingMine] = React.useState(false)

  // Re-seed the form each time the drawer opens, so an alert for a different
  // day does not land on the previous day's values.
  const [lastOpen, setLastOpen] = React.useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setDay(initialDay ?? todayIso())
      setInTime('')
      setOutTime('')
      setReason('')
      setError(null)
      setMessage(null)
    }
  }

  const loadMine = React.useCallback(async () => {
    if (!open) return
    setLoadingMine(true)
    try {
      const response = await hrmsService.getRegularisations(getLaravelContext(user), { scope: 'mine' })
      setMine(response.data ?? [])
    } catch {
      setMine([])
    } finally {
      setLoadingMine(false)
    }
  }, [open, user])

  React.useEffect(() => {
    loadMine()
  }, [loadMine])

  /** What the attendance row currently says for the chosen day. */
  const existing = React.useMemo(
    () => records.find((record) => record.date === day) ?? null,
    [records, day],
  )

  const hasPendingForDay = React.useMemo(
    () => mine.some((row) => row.day === day && row.status === 'pending'),
    [mine, day],
  )

  const handleSubmit = async () => {
    setError(null)
    setMessage(null)

    if (!inTime && !outTime) {
      setError('Give a corrected punch-in time, a punch-out time, or both.')
      return
    }
    if (!reason.trim()) {
      setError('A reason is required.')
      return
    }

    setSubmitting(true)
    try {
      const response = await hrmsService.submitRegularisation(getLaravelContext(user), {
        day,
        requestedInTime: inTime || undefined,
        requestedOutTime: outTime || undefined,
        reason: reason.trim(),
      })

      if (String(response.status) === '0') {
        setError(response.message || 'Could not submit the request.')
        return
      }

      setMessage(response.message || 'Request submitted.')
      setInTime('')
      setOutTime('')
      setReason('')
      await loadMine()
      onSubmitted?.()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the request.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async (id: number) => {
    try {
      await hrmsService.withdrawRegularisation(getLaravelContext(user), id)
      await loadMine()
      onSubmitted?.()
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Could not withdraw the request.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <Clock className="size-5 text-primary" />
            Regularise attendance
          </SheetTitle>
          <SheetDescription>
            Ask for a day to be corrected when a punch is missing or wrong. Your approver reviews it.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reg-day">Day</Label>
            <Input
              id="reg-day"
              type="date"
              value={day}
              max={todayIso()}
              onChange={(event) => setDay(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {existing
                ? `Currently recorded: in ${existing.punchIn ?? '--'}, out ${existing.punchOut ?? '--'}.`
                : 'Nothing is recorded for this day yet.'}
            </p>
            {hasPendingForDay && (
              <p className="text-xs font-medium text-warning">
                You already have a pending request for this day. Submitting will update it rather than
                create a second one.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="reg-in">Corrected punch-in</Label>
              <Input id="reg-in" type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reg-out">Corrected punch-out</Label>
              <Input id="reg-out" type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} />
            </div>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">
            Fill in only what needs changing — a missing punch-out needs just the out time.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="reg-reason">Reason</Label>
            <Textarea
              id="reg-reason"
              rows={3}
              maxLength={255}
              placeholder="Why does this day need correcting?"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full font-semibold">
            {submitting ? 'Submitting...' : hasPendingForDay ? 'Update my request' : 'Submit request'}
          </Button>

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="size-4 text-muted-foreground" />
              My requests
            </h3>

            {loadingMine ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : mine.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                You have not asked for any corrections yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {mine.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{row.day}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.original_in_time ?? '--'} / {row.original_out_time ?? '--'}
                        {' → '}
                        {row.requested_in_time ?? '--'} / {row.requested_out_time ?? '--'}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{row.reason}</p>
                      {row.reviewer_comment && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Reviewer: {row.reviewer_comment}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={row.status} size="sm">
                        {row.status}
                      </StatusBadge>
                      {row.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(row.id)}
                          className="text-xs font-medium text-destructive hover:underline"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
