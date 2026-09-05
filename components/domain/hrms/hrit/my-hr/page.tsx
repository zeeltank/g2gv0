'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarDays, Clock, Download, FileText, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { myHrService, type MyHrSummary, type MyPayslip } from '@/services/hrms/my-hr'

/**
 * My HR — the employee's own view of themselves. F-130.
 *
 * The audit's Part D gap, and the plainest one in the module: an employee could
 * not see their own payslip. Not "it was hard to find" — there was no route
 * that served it. The payslip generator lives behind the HR console's role
 * gate, so somebody asking about last month's pay had to ask a person.
 *
 * EVERY NUMBER HERE IS THE EMPLOYEE'S OWN, decided by the server from their
 * token. This screen sends no employee id because the endpoints do not accept
 * one — so there is no filter to get wrong and no id to tamper with.
 */

function money(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MyHrPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [summary, setSummary] = React.useState<MyHrSummary | null>(null)
  const [payslips, setPayslips] = React.useState<MyPayslip[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const context = getLaravelContext(user)
      // allSettled, not all: a missing payslip list must not blank the leave
      // balance beside it. Each half of this screen fails on its own.
      const [summaryResult, payslipResult] = await Promise.allSettled([
        myHrService.getSummary(context),
        myHrService.getPayslips(context),
      ])

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value.data)
      } else {
        setError('Could not load your summary.')
      }

      setPayslips(payslipResult.status === 'fulfilled' ? (payslipResult.value.data ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    if (!authLoading) void load()
  }, [authLoading, load])

  if (loading || authLoading) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="p-6">
        <ErrorState title="Unable to load My HR" description={error} retry={load} />
      </div>
    )
  }

  const totalRemaining = (summary?.leave_balances ?? []).reduce(
    (sum, balance) => sum + Number(balance.remaining ?? 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My HR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your leave, your attendance and your payslips — for the {summary?.year}–
          {(summary?.year ?? 0) + 1} leave year.
        </p>
      </header>

      {/* The three numbers somebody opens this page to see. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </span>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Leave remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">{totalRemaining}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              across {summary?.leave_balances.length ?? 0} leave types
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="grid size-9 place-items-center rounded-lg bg-warning/10 text-warning">
              <Clock className="size-4" />
            </span>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Waiting on someone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {summary?.pending_leave ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary?.pending_leave ? 'leave requests not yet decided' : 'nothing outstanding'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <span className="grid size-9 place-items-center rounded-lg bg-success/10 text-success">
              <Wallet className="size-4" />
            </span>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last payslip
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.latest_payslip ? (
              <>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  ₹{money(summary.latest_payslip.net)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.latest_payslip.month} {summary.latest_payslip.year}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-muted-foreground">—</p>
                <p className="mt-1 text-sm text-muted-foreground">no payslip issued yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        WHO each request is actually sitting with. "Pending" is one word for
        two very different situations — nobody has looked at it, and your
        manager approved it but the department head has not — and until the
        approval chain existed the product could not tell them apart.
      */}
      {summary && summary.awaiting.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">Where your requests have got to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {summary.awaiting.map((item) => (
              <div
                key={item.leave_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(item.from_date)}
                    {item.to_date && item.to_date !== item.from_date
                      ? ` – ${formatDate(item.to_date)}`
                      : ''}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Step {item.step} · waiting on{' '}
                    <span className="font-medium text-foreground">{item.waiting_on}</span>
                  </p>
                </div>
                {item.overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3" />
                    Overdue — escalated
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Leave balances, per type, from the same service HR reads. */}
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-lg font-bold">My leave balance</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.push('/module/hrit-solutions/leave-management/leave-requests?apply=1')
            }
          >
            Apply for leave
          </Button>
        </CardHeader>
        <CardContent>
          {(summary?.leave_balances ?? []).length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-10" />}
              title="No leave types configured"
              description="Your organisation has not set up leave types yet. HR configures these under Leave Configuration."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-semibold">Leave type</th>
                    <th className="pb-2 text-right font-semibold">Entitled</th>
                    <th className="pb-2 text-right font-semibold">Used</th>
                    <th className="pb-2 text-right font-semibold">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.leave_balances.map((balance) => (
                    <tr key={balance.leave_type} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{balance.leave_type}</td>
                      <td className="py-2.5 text-right tabular-nums">{balance.total}</td>
                      <td className="py-2.5 text-right tabular-nums">{balance.used}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {balance.remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* THE ONE AN EMPLOYEE COULD NOT REACH AT ALL BEFORE THIS SPRINT. */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">My payslips</CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-10" />}
              title="No payslips yet"
              description="Payslips appear here once your organisation has run payroll for a month you were employed in."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {payslips.map((payslip) => (
                <div
                  key={payslip.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {payslip.month} {payslip.year}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                      Gross ₹{money(payslip.gross)} · Deductions ₹{money(payslip.deductions)} ·{' '}
                      <span className="font-semibold text-foreground">
                        Net ₹{money(payslip.net)}
                      </span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    {/* A plain link to the server-built URL. The browser never
                        assembles one, so it cannot assemble somebody else's. */}
                    <a href={payslip.pdf_url} target="_blank" rel="noreferrer">
                      <Download className="mr-2 size-4" />
                      Payslip
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/*
        Say WHY the certificate is unavailable rather than offering a button
        that refuses. A salary certificate is built from the salary structure,
        and for two years an employee without one got a stack trace (F-110).
      */}
      {summary && summary.salary_structure_years.length === 0 && (
        <Alert>
          <AlertDescription>
            A salary certificate can only be issued for a year you have a salary structure on
            record for, and you have none yet. Ask HR to add one under Salary Structure.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
