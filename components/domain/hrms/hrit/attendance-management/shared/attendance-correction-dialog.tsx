'use client'

import * as React from 'react'
import { AlertTriangle, CalendarPlus, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { statusLabel, type AttendanceDayCell } from './attendance-day-status'

/**
 * Correct one employee's one day.
 *
 * ── EXTRACTED, SO THERE IS ONE OF IT ────────────────────────────────────────
 *
 * Lifted out of the Manage Employee Attendance page unchanged in behaviour,
 * because three surfaces now need it: the HR grid, the per-employee calendar
 * panel, and the Employee Directory attendance tab. Two copies of a dialog that
 * writes a payroll input would drift, and the half that drifted would be the one
 * without the explanation attached.
 *
 * It takes a plain `employeeName` and `hasRoster` rather than a grid row, so the
 * calendar and the directory - neither of which has an `AttendanceGridEmployee`
 * - can render it without inventing one.
 *
 * ── THE THREE GUARDS ARE NOT COSMETIC ───────────────────────────────────────
 *
 * Each one stops a write that the server would accept and then read back as
 * something the user did not mean:
 *
 *   both times empty      the server refuses it, so catching it here is just a
 *                         better message
 *   out <= in             the server stores a NULL duration rather than a
 *                         negative one, so this would save and then read as
 *                         "no hours worked" with nothing to explain why
 *   no reason             required server-side too; a correction nobody can
 *                         account for is a pay change nobody can account for
 *
 * ── AN EMPTY BOX MEANS "LEAVE THAT SIDE ALONE" ──────────────────────────────
 *
 * Which is the common case - filling in a missing punch-out without restating
 * the punch-in - and is said in words under the fields rather than left to be
 * inferred from an empty input.
 */
export function AttendanceCorrectionDialog({
  employeeName,
  hasRoster,
  date,
  cell,
  isSaving,
  onClose,
  onSubmit,
}: {
  employeeName: string
  /** False adds the "lateness cannot be calculated" note. Undefined omits it. */
  hasRoster?: boolean
  date: string
  cell: AttendanceDayCell
  isSaving: boolean
  onClose: () => void
  onSubmit: (payload: { inTime?: string; outTime?: string; reason: string }) => Promise<void>
}) {
  const [inTime, setInTime] = React.useState(cell.in ?? '')
  const [outTime, setOutTime] = React.useState(cell.out ?? '')
  const [reason, setReason] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)

  const isFuture = cell.status === 'upcoming'
  const creating = !cell.in && !cell.out

  const prettyDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const submit = async () => {
    setLocalError(null)

    if (!inTime && !outTime) {
      setLocalError('Give a punch in time, a punch out time, or both.')
      return
    }
    if (!reason.trim()) {
      setLocalError('A reason is required — it is what makes this change answerable later.')
      return
    }
    if (inTime && outTime && outTime <= inTime) {
      // The server stores a null duration rather than a negative one, so this
      // would save and then read as "no hours worked" with no explanation.
      setLocalError('The punch out time has to be after the punch in time.')
      return
    }

    await onSubmit({
      ...(inTime ? { inTime } : {}),
      ...(outTime ? { outTime } : {}),
      reason: reason.trim(),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {creating ? <CalendarPlus className="size-5" /> : <Pencil className="size-5" />}
            {creating ? 'Add a missing day' : 'Correct this day'}
          </DialogTitle>
          <DialogDescription>
            {employeeName} &middot; {prettyDate}
          </DialogDescription>
        </DialogHeader>

        {isFuture ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              This day has not happened yet, so there are no hours to record. The server refuses a
              future date for the same reason.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            {/* What is there now, so the change is made against something real
                rather than from memory. */}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">Currently: </span>
              {cell.in || cell.out ? (
                <span className="tabular-nums text-muted-foreground">
                  in {cell.in ?? '—'}, out {cell.out ?? '—'}
                  {cell.duration ? ` (${cell.duration.slice(0, 5)} worked)` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  nothing recorded — {statusLabel(cell.status).toLowerCase()}
                </span>
              )}
              {cell.shift_in && cell.shift_out && (
                <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                  Rostered hours for this day: {cell.shift_in}&ndash;{cell.shift_out}
                </span>
              )}
              {hasRoster === false && (
                <span className="mt-0.5 block text-xs text-violet-700 dark:text-violet-300">
                  This employee has no working days set, so lateness cannot be calculated for them.
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mea-in">Punch in</Label>
                <Input
                  id="mea-in"
                  type="time"
                  value={inTime}
                  onChange={(event) => setInTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mea-out">Punch out</Label>
                <Input
                  id="mea-out"
                  type="time"
                  value={outTime}
                  onChange={(event) => setOutTime(event.target.value)}
                />
              </div>
            </div>

            <p className="-mt-2 text-xs text-muted-foreground">
              Leave a box empty to keep what is already recorded on that side of the day.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mea-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="mea-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Forgot to punch out; badge reader was down; approved by manager…"
                rows={2}
                maxLength={255}
              />
            </div>

            {/* Said where it is true, not discovered at payroll. */}
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                Attendance feeds payroll. Changing these times changes the hours recorded for this
                day and can change this employee&apos;s payable days. The change is kept with your
                name, the original times and this reason.
              </AlertDescription>
            </Alert>

            {/*
              * Said once here, because the employee's own screen will now refuse
              * a re-punch on a day that has both times. Somebody correcting a
              * full day should know the employee cannot simply punch over it.
              */}
            {inTime && outTime && (
              <p className="text-xs text-muted-foreground">
                Setting both times closes the day. The employee&apos;s own Punch In and Punch Out
                will then refuse it and point them at a correction request, so the times you enter
                here are not overwritten by accident.
              </p>
            )}

            {localError && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving || isFuture}>
            {isSaving ? 'Saving…' : creating ? 'Add this day' : 'Save correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
