'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, FileText, Search, Trash2, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SearchInput } from '@/components/ui/search-input'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { KPICard } from '@/shared/business'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'
import { usePayrollDepartments } from '@/hooks/use-payroll-shared'
import { useMonthlyPayroll, type MonthlyPayrollRow } from '@/hooks/use-monthly-payroll'
import { monthlyPayslipPdfUrl } from '@/services/hrms'
import {
  PayrollMessages,
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/**
 * Monthly Payroll.
 *
 * Each row starts from the employee's attendance-derived attended days. Editing
 * that number re-asks Laravel for the payslip lines (GET /getMonthlyData) rather
 * than recomputing locally, because the PF slab rules, PT rules and day-wise
 * pro-rating all live in the controller. Saving inserts the month's payslip and
 * files the generated PDF under the employee's staff documents.
 */
export default function MonthlyPayrollPage() {
  const {
    loading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    header,
    months,
    years,
    search,
    recalculate,
    setReceivedBy,
    retry,
    clearMessages,
    save,
    remove,
    lastQuery,
  } = useMonthlyPayroll()
  const { departments } = usePayrollDepartments()
  const { user, isLoading: authLoading } = useAuth()

  const [month, setMonth] = useState(currentMonthAbbr())
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [departmentId, setDepartmentId] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<MonthlyPayrollRow | null>(null)

  const departmentOptions = useMemo(
    () => [{ label: 'All departments', value: '' }, ...departments],
    [departments],
  )

  const monthOptions = useMemo(() => months.map((value) => ({ value, label: value })), [months])

  const yearOptions = useMemo(
    () =>
      years.length > 0
        ? years
        : Array.from({ length: 5 }, (_, index) => {
            const value = String(new Date().getFullYear() - 2 + index)
            return { value, label: value }
          }),
    [years],
  )

  // Load the current month once auth has resolved the tenant context. Firing
  // before that would only earn a 401 from the controller.
  useEffect(() => {
    if (authLoading || searched) return
    search({ month, year, departmentIds: [], employeeIds: [], userProfileName: user?.role ?? '' })
    // Intentionally a first-load effect: later loads go through the Search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, searched])

  useEffect(() => {
    if (months.length > 0 && !months.includes(month)) setMonth(months[0])
  }, [month, months])

  const visibleRows = useMemo(() => {
    const term = tableSearch.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.employeeNo.toLowerCase().includes(term) ||
        row.department.toLowerCase().includes(term),
    )
  }, [rows, tableSearch])

  const summary = useMemo(() => {
    const saved = rows.filter((row) => row.isSaved)
    return {
      employees: rows.length,
      saved: saved.length,
      pending: rows.length - saved.length,
      payout: rows.reduce((sum, row) => sum + row.totalPayment, 0),
    }
  }, [rows])

  const payslipUrl = (row: MonthlyPayrollRow) => {
    if (!lastQuery) return null
    const context = getLaravelContext(user)
    if (!isLaravelContextReady(context)) return null
    return monthlyPayslipPdfUrl(context, {
      employeeId: row.employeeId,
      month: lastQuery.month,
      year: lastQuery.year,
    })
  }

  const handleExport = () => {
    downloadCsv(
      `monthly-payroll-${lastQuery?.month}-${lastQuery?.year}.csv`,
      [
        'Sr. No',
        'Employee No',
        'Employee',
        'Department',
        'Total Days',
        ...header.map((column) => column.label),
        'Total Deduction',
        'Total Payment',
        'Received By',
        'Status',
      ],
      visibleRows.map((row, index) => [
        index + 1,
        row.employeeNo,
        row.name,
        row.department,
        row.totalDay,
        ...header.map((column) => row.values[column.id] ?? 0),
        row.totalDeduction,
        row.totalPayment,
        row.receivedBy,
        row.isSaved ? 'Saved' : 'Draft',
      ]),
    )
  }

  const actions = (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={handleExport}
        disabled={visibleRows.length === 0}
      >
        <Download className="size-4" />
        Export CSV
      </Button>
      <Button className="gap-2" onClick={save} disabled={processing || summary.pending === 0}>
        <Wallet className="size-4" />
        {processing ? 'Processing...' : `Generate Payroll (${summary.pending})`}
      </Button>
    </>
  )

  return (
    <PayrollPageShell
      title="Monthly Payroll"
      description="Run the month's payroll from attendance and the saved salary structures, then issue payslips."
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Employees"
          value={loading ? '-' : summary.employees}
          description={lastQuery ? `${lastQuery.month} ${lastQuery.year}` : 'No period selected'}
          icon={<Users className="size-5" />}
        />
        <KPICard
          label="Payslips Generated"
          value={loading ? '-' : summary.saved}
          variant="success"
          description="Saved to employee_monthly_salary_data"
          icon={<FileText className="size-5" />}
        />
        <KPICard
          label="Pending"
          value={loading ? '-' : summary.pending}
          variant="warning"
          description="Rows not yet generated"
        />
        <KPICard
          label="Net Payout"
          value={loading ? '-' : summary.payout.toLocaleString()}
          variant="primary"
          description="Sum of total payment"
          icon={<Wallet className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Payroll Period</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            January to March belong to the previous financial year, so Laravel stores them against
            year + 1 automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="payrollMonth" required>
                Month
              </Label>
              <Select
                id="payrollMonth"
                value={month}
                onChange={setMonth}
                options={monthOptions.length > 0 ? monthOptions : [{ value: month, label: month }]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payrollYear" required>
                Year
              </Label>
              <Select id="payrollYear" value={year} onChange={setYear} options={yearOptions} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payrollDepartment">Department</Label>
              <Select
                id="payrollDepartment"
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                placeholder="All departments"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full gap-2"
                disabled={loading}
                onClick={() =>
                  search({
                    month,
                    year,
                    departmentIds: departmentId ? [departmentId] : [],
                    employeeIds: [],
                    userProfileName: user?.role ?? '',
                  })
                }
              >
                <Search className="size-4" />
                {loading ? 'Loading...' : 'Search'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PayrollMessages error={error} actionMessage={actionMessage} onDismiss={clearMessages} />

      {loading ? (
        <PayrollTableSkeleton />
      ) : error && rows.length === 0 ? (
        <ErrorState title="Unable to load the monthly payroll" description={error} retry={retry} />
      ) : rows.length === 0 && searched ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<CalendarDays className="size-10" />}
              title="No employees for this period"
              description="Widen the department filter, or confirm that active employees exist for this organization."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                Payroll Register — {lastQuery?.month} {lastQuery?.year}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Change a row&apos;s attended days to re-derive its payslip lines. Saved rows are
                locked; delete one to regenerate it.
              </CardDescription>
            </div>
            <div className="w-full sm:max-w-xs">
              <SearchInput
                placeholder="Search employee, code or department"
                aria-label="Search employees"
                icon={<Search className="size-4" />}
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="[&_td]:p-2 [&_th]:p-2">
                <TableHeader className="bg-surface-muted">
                  <TableRow>
                    <TableHead className="font-semibold">Sr. No</TableHead>
                    <TableHead className="font-semibold">Employee</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Total Days</TableHead>
                    {header.map((column) => (
                      <TableHead key={column.id} className="whitespace-nowrap font-semibold">
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold">Total Deduction</TableHead>
                    <TableHead className="font-semibold">Total Payment</TableHead>
                    <TableHead className="font-semibold">Received By</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, index) => (
                    <TableRow key={String(row.employeeId)}>
                      <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{row.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.employeeNo || '-'}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.department}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="31"
                          size="sm"
                          className="w-20 tabular-nums"
                          aria-label={`Attended days for ${row.name}`}
                          value={row.totalDay}
                          disabled={row.isSaved || row.recalculating}
                          onChange={(event) => recalculate(row.employeeId, event.target.value)}
                        />
                      </TableCell>
                      {header.map((column) => (
                        <TableCell
                          key={column.id}
                          className="text-sm tabular-nums text-muted-foreground"
                        >
                          {(row.values[column.id] ?? 0).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm tabular-nums text-foreground">
                        {row.totalDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                        {row.totalPayment.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Input
                          size="sm"
                          className="w-28"
                          aria-label={`Received by for ${row.name}`}
                          value={row.receivedBy}
                          disabled={row.isSaved}
                          onChange={(event) => setReceivedBy(row.employeeId, event.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        {row.recalculating ? (
                          <StatusBadge variant="processing" label="Calculating" />
                        ) : row.isSaved ? (
                          <StatusBadge variant="active" label="Saved" />
                        ) : (
                          <StatusBadge variant="pending" label="Draft" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {row.isSaved && payslipUrl(row) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`Download payslip for ${row.name}`}
                              onClick={() => window.open(payslipUrl(row) as string, '_blank')}
                            >
                              <FileText className="size-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            aria-label={`Delete payroll for ${row.name}`}
                            disabled={!row.isSaved || processing}
                            onClick={() => setPendingDelete(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Record</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This removes ${pendingDelete.name}'s ${lastQuery?.month} ${lastQuery?.year} payslip and the filed PDF document. The row can then be regenerated.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPendingDelete(null)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={processing}
              onClick={async () => {
                if (!pendingDelete) return
                const result = await remove(pendingDelete)
                if (result.ok) setPendingDelete(null)
              }}
            >
              {processing ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}

/** Laravel's month lists use three-letter abbreviations ('Apr', 'May', ...). */
function currentMonthAbbr() {
  return new Date().toLocaleString('en-US', { month: 'short' })
}
