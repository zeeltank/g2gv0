'use client'

import { useMemo, useState } from 'react'
import { Download, RefreshCw, Save, Search, Users, Wallet } from 'lucide-react'
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
import { usePayrollDepartments } from '@/hooks/use-payroll-shared'
import { salaryStructureNet, useSalaryStructure } from '@/hooks/use-salary-structure'
import {
  PayrollMessages,
  PayrollPageShell,
  PayrollTableSkeleton,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'

const statusOptions = [
  { label: 'Active employees', value: '1' },
  { label: 'Inactive employees', value: '0' },
  { label: 'All employees', value: '' },
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 7 }, (_, index) => {
  const year = String(currentYear - 3 + index)
  return { label: year, value: year }
})

/**
 * Employee Salary Structure.
 *
 * One row per employee, one column per active payroll type. Amounts are the
 * monthly figure Laravel stores in employee_salary_structures.employee_salary_data;
 * PF and PT are re-derived server side on save from the payroll type config and
 * the employee's pf_deduction / pt_deduction flags, so the values posted for
 * those heads may come back adjusted.
 */
export default function SalaryStructurePage() {
  const {
    loading,
    processing,
    error,
    actionMessage,
    searched,
    rows,
    payrollTypes,
    employeeOptions,
    year,
    search,
    setValue,
    retry,
    clearMessages,
    save,
    rollover,
  } = useSalaryStructure()
  const { departments } = usePayrollDepartments()

  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [employeeStatus, setEmployeeStatus] = useState('1')
  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [isRolloverOpen, setIsRolloverOpen] = useState(false)

  const departmentOptions = useMemo(
    () => [{ label: 'All departments', value: '' }, ...departments],
    [departments],
  )

  const employeeSelectOptions = useMemo(
    () => [{ label: 'All employees', value: '' }, ...employeeOptions],
    [employeeOptions],
  )

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
    const configured = rows.filter((row) =>
      Object.values(row.values).some((amount) => Number(amount) > 0),
    ).length
    const totalNet = rows.reduce((sum, row) => sum + salaryStructureNet(row, payrollTypes), 0)

    return {
      employees: rows.length,
      configured,
      pending: rows.length - configured,
      monthlyOutlay: totalNet,
    }
  }, [payrollTypes, rows])

  const runSearch = () => {
    search({
      year: selectedYear,
      employeeStatus,
      employeeIds: employeeId ? [employeeId] : [],
      departmentIds: departmentId ? [departmentId] : [],
    })
  }

  const handleExport = () => {
    downloadCsv(
      `salary-structure-${year}.csv`,
      ['Sr. No', 'Employee No', 'Employee', 'Department', 'Status', ...payrollTypes.map((type) => type.payroll_name ?? ''), 'Net Monthly'],
      visibleRows.map((row, index) => [
        index + 1,
        row.employeeNo,
        row.name,
        row.department,
        row.status,
        ...payrollTypes.map((type) => row.values[String(type.id)] ?? 0),
        salaryStructureNet(row, payrollTypes),
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
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setIsRolloverOpen(true)}
        disabled={processing || rows.length === 0}
      >
        <RefreshCw className="size-4" />
        Roll Over to {Number(year) + 1}
      </Button>
      <Button className="gap-2" onClick={() => save(rows)} disabled={processing || rows.length === 0}>
        <Save className="size-4" />
        {processing ? 'Saving...' : 'Save Structure'}
      </Button>
    </>
  )

  return (
    <PayrollPageShell
      title="Salary Structure"
      description="Set each employee's monthly earning and deduction heads for the payroll year."
      actions={actions}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Employees"
          value={loading ? '-' : summary.employees}
          description={`Payroll year ${year}`}
          icon={<Users className="size-5" />}
        />
        <KPICard
          label="Structures Set"
          value={loading ? '-' : summary.configured}
          variant="success"
          description="At least one head with an amount"
        />
        <KPICard
          label="Awaiting Setup"
          value={loading ? '-' : summary.pending}
          variant="warning"
          description="No amounts captured yet"
        />
        <KPICard
          label="Monthly Net Outlay"
          value={loading ? '-' : summary.monthlyOutlay.toLocaleString()}
          variant="primary"
          description="Earnings less deductions"
          icon={<Wallet className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Structures are stored per payroll year, so the year drives both what loads and what saves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-2">
              <Label htmlFor="structureYear">Payroll Year</Label>
              <Select
                id="structureYear"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureStatus">Employee Status</Label>
              <Select
                id="structureStatus"
                value={employeeStatus}
                onChange={setEmployeeStatus}
                options={statusOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureDepartment">Department</Label>
              <Select
                id="structureDepartment"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value)
                  setEmployeeId('')
                }}
                options={departmentOptions}
                placeholder="All departments"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="structureEmployee">Employee</Label>
              <Select
                id="structureEmployee"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeSelectOptions}
                placeholder="All employees"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full gap-2" onClick={runSearch} disabled={loading}>
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
        <ErrorState title="Unable to load salary structures" description={error} retry={retry} />
      ) : payrollTypes.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Wallet className="size-10" />}
              title="No active payroll types"
              description="Add earning and deduction components under Payroll Type before building salary structures."
            />
          </CardContent>
        </Card>
      ) : rows.length === 0 && searched ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Users className="size-10" />}
              title="No employees match these filters"
              description="Widen the department, employee or status filter and search again."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">Salary Grid — {year}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {visibleRows.length} of {rows.length} employees · {payrollTypes.length} payroll heads
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
                    <TableHead className="font-semibold">Status</TableHead>
                    {payrollTypes.map((payrollType) => (
                      <TableHead key={payrollType.id} className="whitespace-nowrap font-semibold">
                        <span className="flex flex-col">
                          <span>{payrollType.payroll_name}</span>
                          <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                            {String(payrollType.payroll_type) === '1' ? 'Earning' : 'Deduction'}
                          </span>
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold">Net Monthly</TableHead>
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
                        <StatusBadge status={row.status} />
                      </TableCell>
                      {payrollTypes.map((payrollType) => (
                        <TableCell key={payrollType.id}>
                          <Input
                            type="number"
                            min="0"
                            size="sm"
                            className="w-24 tabular-nums"
                            aria-label={`${payrollType.payroll_name} for ${row.name}`}
                            value={row.values[String(payrollType.id)] ?? 0}
                            onChange={(event) =>
                              setValue(
                                row.employeeId,
                                String(payrollType.id),
                                Number(event.target.value) || 0,
                              )
                            }
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                        {salaryStructureNet(row, payrollTypes).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isRolloverOpen} onOpenChange={setIsRolloverOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Roll Over Salary Structures</AlertDialogTitle>
            <AlertDialogDescription>
              Each structure in the current filter for {year} will be copied into {Number(year) + 1}.
              Employees who already have a {Number(year) + 1} structure are overwritten with the {year}{' '}
              amounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsRolloverOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={processing}
              onClick={async () => {
                const result = await rollover()
                if (result?.ok) setIsRolloverOpen(false)
              }}
            >
              {processing ? 'Rolling over...' : 'Roll Over'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PayrollPageShell>
  )
}
