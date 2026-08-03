'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Save, Search, SlidersHorizontal, Users } from 'lucide-react'
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
import { KPICard, Tabs } from '@/shared/business'
import {
  DEDUCTION_CATEGORY_LABELS,
  usePayrollDeduction,
  type DeductionCategory,
} from '@/hooks/use-payroll-deduction'
import {
  PayrollMessages,
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'

const categoryTabs = [
  { id: '1', label: DEDUCTION_CATEGORY_LABELS['1'] },
  { id: '2', label: DEDUCTION_CATEGORY_LABELS['2'] },
]

/**
 * Payroll Deduction.
 *
 * Captures a per-employee, per-month adjustment against one payroll head. The
 * amount is stored in hrms_emp_payroll_deduction keyed by the payroll type id,
 * and Monthly Payroll adds it to that head when it builds the payslip.
 */
export default function PayrollDeductionPage() {
  const {
    loading,
    optionsLoading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    months,
    years,
    headsByCategory,
    lastQuery,
    search,
    setAmount,
    retry,
    clearMessages,
    save,
  } = usePayrollDeduction()

  const [category, setCategory] = useState<DeductionCategory>('1')
  const [payrollTypeId, setPayrollTypeId] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [tableSearch, setTableSearch] = useState('')

  const headOptions = useMemo(
    () =>
      (headsByCategory[category] ?? []).map((head) => ({
        value: String(head.id),
        label: head.payroll_name,
      })),
    [category, headsByCategory],
  )

  const monthOptions = useMemo(
    () => months.map((value) => ({ value, label: value })),
    [months],
  )

  const yearOptions = useMemo(() => years.map((value) => ({ value, label: value })), [years])

  // Keep the head, month and year selections valid as the option lists arrive.
  useEffect(() => {
    if (headOptions.length === 0) {
      setPayrollTypeId('')
      return
    }
    if (!headOptions.some((option) => option.value === payrollTypeId)) {
      setPayrollTypeId(headOptions[0].value)
    }
  }, [headOptions, payrollTypeId])

  useEffect(() => {
    if (months.length > 0 && !months.includes(month)) {
      setMonth(months.includes(currentMonthAbbr()) ? currentMonthAbbr() : months[0])
    }
  }, [month, months])

  useEffect(() => {
    if (years.length > 0 && !years.includes(year)) setYear(years[years.length - 1])
  }, [year, years])

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
    const captured = rows.filter((row) => row.amount.trim() !== '' && Number(row.amount) !== 0)
    const unsaved = rows.filter((row) => row.amount !== row.savedAmount).length
    return {
      employees: rows.length,
      captured: captured.length,
      total: captured.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      unsaved,
    }
  }, [rows])

  const selectedHead = headOptions.find((option) => option.value === payrollTypeId)

  const runSearch = () => {
    if (!payrollTypeId || !month || !year) return
    search({ payrollTypeId, month, year })
  }

  const handleExport = () => {
    downloadCsv(
      `payroll-deduction-${selectedHead?.label ?? 'head'}-${lastQuery?.month}-${lastQuery?.year}.csv`,
      ['Sr. No', 'Employee No', 'Employee', 'Department', 'Amount'],
      visibleRows.map((row, index) => [
        index + 1,
        row.employeeNo,
        row.name,
        row.department,
        row.amount || 0,
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
      <Button className="gap-2" onClick={save} disabled={processing || rows.length === 0}>
        <Save className="size-4" />
        {processing ? 'Saving...' : 'Save Amounts'}
      </Button>
    </>
  )

  return (
    <PayrollPageShell
      title="Payroll Deduction"
      description="Record one-off monthly allowances and deductions on top of the salary structure."
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Employees Listed"
          value={loading ? '-' : summary.employees}
          description={selectedHead ? selectedHead.label : 'Select a payroll head'}
          icon={<Users className="size-5" />}
        />
        <KPICard
          label="Amounts Captured"
          value={loading ? '-' : summary.captured}
          variant="success"
          description="Employees with a non-zero amount"
        />
        <KPICard
          label="Total Amount"
          value={loading ? '-' : summary.total.toLocaleString()}
          variant="primary"
          description={lastQuery ? `${lastQuery.month} ${lastQuery.year}` : 'No period selected'}
        />
        <KPICard
          label="Unsaved Changes"
          value={loading ? '-' : summary.unsaved}
          variant={summary.unsaved > 0 ? 'warning' : 'default'}
          description="Rows edited since the last save"
          icon={<SlidersHorizontal className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Select Payroll Head</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Amounts are stored per payroll head, month and year — switching any of the three loads a
            different set of saved values.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs
            tabs={categoryTabs}
            active={category}
            onChange={(id) => setCategory(id as DeductionCategory)}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="deductionHead" required>
                Payroll Name
              </Label>
              <Select
                id="deductionHead"
                value={payrollTypeId}
                onChange={setPayrollTypeId}
                options={headOptions}
                placeholder={optionsLoading ? 'Loading...' : 'Select payroll head'}
                disabled={headOptions.length === 0}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deductionMonth" required>
                Month
              </Label>
              <Select
                id="deductionMonth"
                value={month}
                onChange={setMonth}
                options={monthOptions}
                placeholder="Select month"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deductionYear" required>
                Year
              </Label>
              <Select
                id="deductionYear"
                value={year}
                onChange={setYear}
                options={yearOptions}
                placeholder="Select year"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full gap-2"
                onClick={runSearch}
                disabled={loading || !payrollTypeId || !month || !year}
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
      ) : error && rows.length === 0 && searched ? (
        <ErrorState title="Unable to load employees" description={error} retry={retry} />
      ) : !searched ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<SlidersHorizontal className="size-10" />}
              title="Choose a payroll head to begin"
              description="Pick an allowance or deduction, a month and a year, then search to list employees."
            />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users className="size-10" />}
              title="No employees found"
              description="This organization has no active employees to apply the adjustment to."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                {selectedHead?.label} — {lastQuery?.month} {lastQuery?.year}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {visibleRows.length} of {rows.length} employees
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
                    <TableHead className="font-semibold">Employee Code</TableHead>
                    <TableHead className="font-semibold">Employee Name</TableHead>
                    <TableHead className="font-semibold">Department</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, index) => (
                    <TableRow key={String(row.employeeId)}>
                      <TableCell className="text-sm text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.employeeNo || '-'}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">{row.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.department}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          size="sm"
                          className="w-32 tabular-nums"
                          placeholder="0"
                          aria-label={`Amount for ${row.name}`}
                          value={row.amount}
                          onChange={(event) => setAmount(row.employeeId, event.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        {row.amount !== row.savedAmount ? (
                          <StatusBadge variant="warning" label="Unsaved" />
                        ) : row.savedAmount ? (
                          <StatusBadge variant="active" label="Saved" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </PayrollPageShell>
  )
}

/** Laravel's month lists use three-letter abbreviations ('Apr', 'May', ...). */
function currentMonthAbbr() {
  return new Date().toLocaleString('en-US', { month: 'short' })
}
