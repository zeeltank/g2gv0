'use client'

import * as React from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { hrmsService, type RegularisationRow } from '@/services/hrms'

/**
 * The approver's queue for attendance corrections. F-107.
 *
 * WHO SEES THIS IS DECIDED BY THE SERVER, NOT BY THIS COMPONENT.
 *
 * It asks for `scope=team`. The API answers 403 unless the caller holds
 * `approve_leave` in `hrms_leave_role_permissions`, and narrows the rows to
 * their configured scope — Self, Team, Department or Organization. On a 403
 * this renders nothing at all.
 *
 * That ordering is the point. Hiding a card is not access control; deciding
 * what to render *from what the endpoint allowed* means the two can never
 * disagree. Payroll was reachable by everyone precisely because a React
 * component was the only thing saying no (F-91).
 */
export function RegularisationQueue({ onDecided }: { onDecided?: () => void }) {
  const { user } = useAuth()

  const [rows, setRows] = React.useState<RegularisationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [permitted, setPermitted] = React.useState(false)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [comments, setComments] = React.useState<Record<number, string>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await hrmsService.getRegularisations(getLaravelContext(user), {
        scope: 'team',
        status: 'pending',
      })
      setPermitted(true)
      setRows(response.data ?? [])
    } catch {
      // 403 is the normal case for most people: this employee is not an
      // approver, so the card simply does not exist for them.
      setPermitted(false)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    load()
  }, [load])

  const decide = async (id: number, status: 'approved' | 'rejected') => {
    setBusyId(id)
    setError(null)
    setMessage(null)
    try {
      const response = await hrmsService.decideRegularisation(
        getLaravelContext(user),
        id,
        status,
        comments[id]?.trim() || undefined,
      )

      if (String(response.status) === '0') {
        setError(response.message || 'Could not record the decision.')
        return
      }

      setMessage(response.message || 'Decision recorded.')
      await load()
      onDecided?.()
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : 'Could not record the decision.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return <Skeleton className="min-h-[140px] rounded-2xl" />
  }

  // Not an approver, or nothing waiting: no empty card taking up the screen.
  if (!permitted || rows.length === 0) {
    return null
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center gap-3 space-y-0 px-6 pb-3 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
          <ClipboardCheck className="size-5" />
        </span>
        <div>
          <CardTitle className="text-lg font-bold">Attendance corrections to review</CardTitle>
          <p className="text-sm text-muted-foreground">
            {rows.length} request{rows.length === 1 ? '' : 's'} waiting for your decision
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-6 pb-6">
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

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border border-border p-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {row.employee_name || `Employee #${row.employee_id}`}
                </span>
                {row.employee_no && (
                  <span className="text-xs text-muted-foreground">{row.employee_no}</span>
                )}
                {row.department && (
                  <span className="text-xs text-muted-foreground">· {row.department}</span>
                )}
                <StatusBadge status={row.status} size="sm">
                  {row.status}
                </StatusBadge>
              </div>

              <p className="mt-1 text-sm font-medium text-foreground">{row.day}</p>

              {/* The before and after, so the decision is made on evidence. */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recorded {row.original_in_time ?? '--'} / {row.original_out_time ?? '--'}
                {'  →  requested '}
                {row.requested_in_time ?? '--'} / {row.requested_out_time ?? '--'}
              </p>

              <p className="mt-1.5 text-sm text-muted-foreground">{row.reason}</p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 lg:w-72">
              <Input
                placeholder="Comment (optional)"
                aria-label={`Comment on ${row.employee_name ?? 'this request'}`}
                value={comments[row.id] ?? ''}
                onChange={(event) =>
                  setComments((prev) => ({ ...prev, [row.id]: event.target.value }))
                }
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={busyId === row.id}
                  onClick={() => decide(row.id, 'approved')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={busyId === row.id}
                  onClick={() => decide(row.id, 'rejected')}
                >
                  Reject
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Approving corrects the attendance record immediately.
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
