'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePayrollDepartments, useDepartmentEmployees } from '@/hooks/use-payroll-shared'
import { usePayrollTypes } from '@/hooks/use-payroll'
import { useForm16 } from '@/hooks/use-form16'
import {
  PayrollMessages,
  PayrollPageShell,
  downloadCsv,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/**
 * Form 16.
 *
 * Built from POST /form16-report, which returns the employee's saved salary
 * structure for the year plus the organization and employee master data. The
 * allowance and deduction pickers read GET /payroll-type: the Form 16 index
 * action (GET /form16) calls an undefined `jwtToken()` helper server side and
 * fatals under type=API, so it cannot be used.
 */
export default function Form16Page() {
  const { departments, loading: departmentsLoading } = usePayrollDepartments()
  const { payrollTypes, loading: payrollTypesLoading } = usePayrollTypes()
  const { loading, error, form16, generate } = useForm16()

  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [allowanceIds, setAllowanceIds] = useState<string[]>([])
  const [deductionIds, setDeductionIds] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const { employees, loading: employeesLoading } = useDepartmentEmployees(departmentId)

  const allowanceHeads = useMemo(
    () => payrollTypes.filter((type) => type.kind === 'Earning' && type.status === 'Active'),
    [payrollTypes],
  )
  const deductionHeads = useMemo(
    () => payrollTypes.filter((type) => type.kind === 'Deduction' && type.status === 'Active'),
    [payrollTypes],
  )

  // Default to every head selected, matching the legacy screen's full breakdown.
  useEffect(() => {
    if (allowanceHeads.length > 0 && allowanceIds.length === 0) {
      setAllowanceIds(allowanceHeads.map((head) => String(head.id)))
    }
    if (deductionHeads.length > 0 && deductionIds.length === 0) {
      setDeductionIds(deductionHeads.map((head) => String(head.id)))
    }
    // Only seeds the initial selection - later clearing is the user's choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowanceHeads, deductionHeads])

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const value = String(new Date().getFullYear() - 3 + index)
        return { value, label: `${value}-${Number(value) + 1}` }
      }),
    [],
  )

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  const handleGenerate = async () => {
    if (!departmentId) return setFormError('Select a department')
    if (!employeeId) return setFormError('Select an employee')
    if (allowanceIds.length === 0 && deductionIds.length === 0) {
      return setFormError('Select at least one allowance or deduction head')
    }

    setFormError(null)
    await generate({ departmentId, employeeId, year, allowanceIds, deductionIds })
  }

  const handleExport = () => {
    if (!form16) return
    downloadCsv(
      `form-16-${form16.employeeNo || form16.employeeName}-${form16.year}.csv`,
      ['Section', 'Head', 'Annual Amount'],
      [
        ...form16.allowances.map((line) => ['Gross Salary', line.name, line.amount]),
        ['Gross Salary', 'Total', form16.grossSalary],
        ...form16.deductions.map((line) => ['Deductions', line.name, line.amount]),
        ['Deductions', 'Total', form16.totalDeductions],
        ['Net', 'Taxable Income', form16.netSalary],
      ],
    )
  }

  return (
    <PayrollPageShell
      title="Form 16"
      description="Generate an employee's annual salary and deduction statement for the selected financial year."
    >
      <PayrollMessages
        error={formError ?? error}
        actionMessage={null}
        onDismiss={() => setFormError(null)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Statement Filters</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Amounts are the employee&apos;s monthly salary structure annualised over twelve months.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="form16Department" required>
                Department
              </Label>
              <Select
                id="form16Department"
                value={departmentId}
                onChange={(value) => {
                  setDepartmentId(value)
                  setEmployeeId('')
                }}
                options={departments}
                placeholder={departmentsLoading ? 'Loading...' : 'Select department'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="form16Employee" required>
                Employee
              </Label>
              <Select
                id="form16Employee"
                value={employeeId}
                onChange={setEmployeeId}
                options={employees}
                placeholder={
                  !departmentId
                    ? 'Select a department first'
                    : employeesLoading
                      ? 'Loading...'
                      : 'Select employee'
                }
                disabled={!departmentId || employeesLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="form16Year" required>
                Financial Year
              </Label>
              <Select id="form16Year" value={year} onChange={setYear} options={yearOptions} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <Label>Allowances</Label>
              {payrollTypesLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : allowanceHeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active earning heads configured.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {allowanceHeads.map((head) => (
                    <label
                      key={head.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={allowanceIds.includes(String(head.id))}
                        onChange={() => toggle(allowanceIds, setAllowanceIds, String(head.id))}
                        aria-label={head.name}
                      />
                      <span className="truncate">{head.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <Label>Deductions</Label>
              {payrollTypesLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : deductionHeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active deduction heads configured.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {deductionHeads.map((head) => (
                    <label
                      key={head.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={deductionIds.includes(String(head.id))}
                        onChange={() => toggle(deductionIds, setDeductionIds, String(head.id))}
                        aria-label={head.name}
                      />
                      <span className="truncate">{head.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2" onClick={handleGenerate} disabled={loading}>
              <FileSpreadsheet className="size-4" />
              {loading ? 'Generating...' : 'Generate Form 16'}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={!form16}>
              <Printer className="size-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {!form16 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<FileSpreadsheet className="size-10" />}
              title="No statement generated yet"
              description="Choose an employee and financial year, then generate the Form 16 statement."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Form 16 — {form16.employeeName} ({form16.year}-{Number(form16.year) + 1})
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Period {form16.fromDate} to {form16.toDate}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Employer" value={form16.organizationName} />
              <ReadOnlyField label="Employer PAN" value={form16.organizationPan} />
              <ReadOnlyField label="Employer TAN" value={form16.organizationTan} />
              <ReadOnlyField label="Department" value={form16.department} />
              <ReadOnlyField label="Employee Code" value={form16.employeeNo} />
              <ReadOnlyField label="Employee PAN" value={form16.panNo} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Form16Section
                title="Gross Salary"
                lines={form16.allowances}
                total={form16.grossSalary}
                totalLabel="Gross Salary"
              />
              <Form16Section
                title="Deductions"
                lines={form16.deductions}
                total={form16.totalDeductions}
                totalLabel="Total Deductions"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Net Taxable Income</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {form16.netSalary.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </PayrollPageShell>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

function Form16Section({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string
  lines: Array<{ id: string; name: string; amount: number }>
  total: number
  totalLabel: string
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-foreground">
        {title}
      </div>
      <Table className="[&_td]:p-2 [&_th]:p-2">
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Head</TableHead>
            <TableHead className="text-right font-semibold">Annual Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                No heads selected
              </TableCell>
            </TableRow>
          ) : (
            lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-sm text-foreground">{line.name}</TableCell>
                <TableCell className="text-right text-sm tabular-nums text-foreground">
                  {line.amount.toLocaleString()}
                </TableCell>
              </TableRow>
            ))
          )}
          <TableRow>
            <TableCell className="text-sm font-semibold text-foreground">{totalLabel}</TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums text-foreground">
              {total.toLocaleString()}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
