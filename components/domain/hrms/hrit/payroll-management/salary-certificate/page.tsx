'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileCheck2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePayrollDepartments, useDepartmentEmployees } from '@/hooks/use-payroll-shared'
import { useSalaryCertificate } from '@/hooks/use-salary-certificate'
import {
  PayrollMessages,
  PayrollPageShell,
} from '@/domain/hrms/hrit/payroll-management/shared/payroll-shell'

/**
 * Salary Certificate.
 *
 * POST /hrms-salary-certificate-report renders the certificate HTML server side
 * and upserts it into hrms_salary_certificate; the PDF is then streamed by
 * GET /salary-certificate-pdf-download. The earning heads come from the index
 * action rather than the hardcoded list the legacy screen shipped with, and the
 * generate call now targets the real endpoint instead of the
 * /generate-salary-certificate route that never existed in Laravel.
 */
export default function SalaryCertificatePage() {
  const {
    optionsLoading,
    processing,
    error,
    actionMessage,
    months,
    earningHeads,
    years,
    lastResult,
    clearMessages,
    generate,
    pdfUrl,
  } = useSalaryCertificate()
  const { departments, loading: departmentsLoading } = usePayrollDepartments()

  const [departmentId, setDepartmentId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [monthIds, setMonthIds] = useState<string[]>([])
  const [payrollTypeIds, setPayrollTypeIds] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { employees, loading: employeesLoading } = useDepartmentEmployees(departmentId)

  const yearOptions = useMemo(
    () =>
      (years.length > 0
        ? years
        : Array.from({ length: 5 }, (_, index) => String(new Date().getFullYear() - 2 + index))
      ).map((value) => ({ value, label: value })),
    [years],
  )

  useEffect(() => {
    if (yearOptions.length > 0 && !yearOptions.some((option) => option.value === year)) {
      setYear(yearOptions[yearOptions.length - 1].value)
    }
  }, [year, yearOptions])

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value])
  }

  const handleGenerate = async () => {
    if (!departmentId) return setFormError('Select a department')
    if (!employeeId) return setFormError('Select an employee')
    if (monthIds.length === 0) return setFormError('Select at least one month')
    if (payrollTypeIds.length === 0) return setFormError('Select at least one earning head')

    setFormError(null)
    await generate({
      departmentId,
      employeeId,
      year,
      monthIds,
      payrollTypeIds,
      reason: reason.trim(),
    })
  }

  const downloadUrl = pdfUrl()

  return (
    <PayrollPageShell
      title="Salary Certificate"
      description="Issue a signed salary certificate covering the selected months and earning heads."
    >
      <PayrollMessages
        error={formError ?? error}
        actionMessage={actionMessage}
        onDismiss={() => {
          setFormError(null)
          clearMessages()
        }}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Certificate Details</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              The certificate is built from the employee&apos;s saved salary structure for the selected
              year, so a structure must exist before it can be issued.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="certDepartment" required>
                  Department
                </Label>
                <Select
                  id="certDepartment"
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
                <Label htmlFor="certEmployee" required>
                  Employee
                </Label>
                <Select
                  id="certEmployee"
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
                <Label htmlFor="certYear" required>
                  Year
                </Label>
                <Select id="certYear" value={year} onChange={setYear} options={yearOptions} />
              </div>
            </div>

            <div className="grid gap-3">
              <Label required>Months Covered</Label>
              {optionsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {months.map((month) => (
                    <label
                      key={month.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={monthIds.includes(month.value)}
                        onChange={() => toggle(monthIds, setMonthIds, month.value)}
                        aria-label={month.label}
                      />
                      <span>{month.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <Label required>Earning Heads</Label>
              {optionsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : earningHeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active earning payroll types found. Add them under Payroll Type first.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {earningHeads.map((head) => (
                    <label
                      key={head.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={payrollTypeIds.includes(head.value)}
                        onChange={() => toggle(payrollTypeIds, setPayrollTypeIds, head.value)}
                        aria-label={head.label}
                      />
                      <span className="truncate">{head.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="certReason">Reason</Label>
              <Textarea
                id="certReason"
                rows={3}
                placeholder="Purpose of the certificate, e.g. bank loan application"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="gap-2" onClick={handleGenerate} disabled={processing}>
                <FileCheck2 className="size-4" />
                {processing ? 'Generating...' : 'Generate Certificate'}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!lastResult || !downloadUrl}
                onClick={() => downloadUrl && window.open(downloadUrl, '_blank')}
              >
                <Download className="size-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Last Generated</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Regenerating for the same employee and year replaces the stored certificate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!lastResult ? (
              <EmptyState
                icon={<FileText className="size-10" />}
                title="Nothing generated yet"
                description="Complete the form and generate a certificate to see its details here."
              />
            ) : (
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="text-right font-medium text-foreground">
                    {lastResult.department_name?.department_name ?? '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Year</dt>
                  <dd className="text-right font-medium text-foreground">{lastResult.year ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Months</dt>
                  <dd className="text-right font-medium text-foreground">
                    {(lastResult.selMonths ?? [])
                      .map((id) => lastResult.month_ids?.[String(id)] ?? id)
                      .join(', ') || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Heads</dt>
                  <dd className="text-right font-medium text-foreground">
                    {(lastResult.payroll_type_ids ?? [])
                      .map(
                        (id) =>
                          earningHeads.find((head) => head.value === String(id))?.label ?? String(id),
                      )
                      .join(', ') || '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">File</dt>
                  <dd className="text-right font-medium text-foreground">
                    {lastResult.pdfName ?? '-'}
                  </dd>
                </div>
                {lastResult.reason && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd className="text-foreground">{lastResult.reason}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </PayrollPageShell>
  )
}
