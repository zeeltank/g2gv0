'use client'

import * as React from 'react'
import { AlertTriangle, ChevronDown, Download, FileText, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { myHrService, type MyPayslip, type PayMonth } from '@/services/hrms/my-hr'
import type { LaravelContext } from '@/lib/laravel-context'

/**
 * What the employee was actually paid, and what it was made of. F-209.
 *
 * My HR used to list a month, a gross and a net, with a Download button that
 * answered 302 to /login. Three separate gaps in one card:
 *
 *   - the download did not work, because the route is auth:sanctum and the
 *     control was a plain <a href> carrying no Authorization header;
 *   - the components behind the figure existed only on the HR console, so
 *     "why is this month lower" had nowhere to be answered;
 *   - and nothing said whether the parts add up to the whole.
 *
 * THE LAST ONE IS NOT DECORATION. Eleven adjustments on this deployment were
 * filed against a month payroll never matched (F-173), worth 343,001. An
 * employee holding a payslip next to a bank statement is the person most
 * likely to notice, and the screen should not quietly present a reconciled
 * total it has no grounds to claim.
 */
export function MyPayBreakdown({
  context,
  payslips,
  payslipError,
  onRetry,
}: {
  context: LaravelContext
  /** From /my-hr/payslips - carries the server-built pdf_url per month. */
  payslips: MyPayslip[]
  payslipError: string | null
  onRetry: () => void
}) {
  const [months, setMonths] = React.useState<PayMonth[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<number | null>(null)
  const [downloading, setDownloading] = React.useState<number | null>(null)
  const [downloadError, setDownloadError] = React.useState<string | null>(null)

  const money = React.useMemo(
    () => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }),
    [],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await myHrService.getPayBreakdown(context)
      setMonths(response.data?.months ?? [])
      // The newest month open by default: it is the one being asked about.
      setOpen(response.data?.months?.[0]?.id ?? null)
    } catch (caught) {
      // A failed fetch is never rendered as "you have not been paid". F-188.
      setMonths([])
      setError(
        caught instanceof Error
          ? caught.message
          : 'Your pay breakdown could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.token, context.subInstituteId, context.userId])

  React.useEffect(() => {
    void load()
  }, [load])

  /**
   * The PDF is fetched with the token rather than navigated to, and the URL
   * comes from the server - the browser assembles nothing, so it cannot name a
   * month, or a person, it was not given.
   */
  const download = async (month: PayMonth) => {
    const payslip = payslips.find((row) => row.month === month.month && row.year === month.year)
    if (!payslip) {
      setDownloadError(
        `The ${month.month} ${month.year} payslip is not available to download yet.`,
      )
      return
    }

    setDownloading(month.id)
    setDownloadError(null)
    try {
      saveBlob(
        `payslip-${month.month}-${month.year}.pdf`,
        await myHrService.downloadPayslip(payslip),
      )
    } catch (caught) {
      setDownloadError(
        caught instanceof Error
          ? caught.message
          : `Your ${month.month} ${month.year} payslip could not be downloaded.`,
      )
    } finally {
      setDownloading(null)
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-lg font-bold">My pay</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every month you have been paid for, and what each figure is made of.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void load(); onRetry() }} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {downloadError && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{downloadError}</span>
              <Button variant="ghost" size="sm" onClick={() => setDownloadError(null)}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/*
          The payslip list and the breakdown are separate requests, so one can
          fail while the other succeeds. Saying which failed beats a single
          message that could mean either.
        */}
        {payslipError && !error && (
          <Alert variant="destructive">
            <AlertDescription>
              {payslipError} Downloads may be unavailable until this loads &mdash; the figures below
              are unaffected.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load your pay"
            description={`${error} This is a problem fetching it, not a sign that you have not been paid.`}
            retry={load}
          />
        ) : months.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-10" />}
            title="No pay recorded yet"
            description="Months appear here once your organisation has run payroll for a period you were employed in."
          />
        ) : (
          months.map((month) => {
            const expanded = open === month.id
            const earnings = month.components.filter((c) => c.kind === 'earning')
            const deductions = month.components.filter((c) => c.kind === 'deduction')

            return (
              <div key={month.id} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : month.id)}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                        expanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">
                        {month.month} {month.year}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground tabular-nums">
                        Gross ₹{money.format(month.gross)} · Deductions ₹
                        {money.format(month.deductions)} ·{' '}
                        <span className="font-semibold text-foreground">
                          Net ₹{money.format(month.net)}
                        </span>
                      </span>
                    </span>
                  </button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloading !== null}
                    onClick={() => download(month)}
                    aria-label={`Download your ${month.month} ${month.year} payslip`}
                  >
                    <Download className="mr-2 size-4" />
                    {downloading === month.id ? 'Preparing…' : 'Payslip'}
                  </Button>
                </div>

                {expanded && (
                  <div className="border-t border-border p-3">
                    {month.components.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This payslip was filed without a component breakdown, so only the totals
                        above are on record.
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <ComponentList title="Earnings" rows={earnings} money={money} />
                        <ComponentList title="Deductions" rows={deductions} money={money} />
                      </div>
                    )}

                    <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                      {month.days} days paid
                      {month.issued_at ? ` · issued ${month.issued_at.slice(0, 10)}` : ''}
                    </p>

                    {/*
                      Said plainly, and only when it is true. The employee cannot
                      fix it; naming it is what lets them ask the right question.
                    */}
                    {!month.reconciles && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertDescription className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          <span>
                            These components add up to ₹{money.format(month.component_sum)}, but ₹
                            {money.format(month.net)} was filed as your net pay with ₹
                            {money.format(month.deductions)} deducted. Ask HR about this month
                            &mdash; the two figures on record disagree.
                          </span>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function ComponentList({
  title,
  rows,
  money,
}: {
  title: string
  rows: Array<{ head_id: number; name: string; amount: number }>
  money: Intl.NumberFormat
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None on this payslip.</p>
      ) : (
        <dl className="mt-2 flex flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.head_id} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 truncate text-sm text-foreground">{row.name}</dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                ₹{money.format(row.amount)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
