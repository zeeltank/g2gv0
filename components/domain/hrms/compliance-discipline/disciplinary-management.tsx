'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Edit3,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { IncidentFormState, MisconductType, ActionTaken } from './disciplinary-management-form'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelDepartment, type LaravelDepartmentEmployee, type LaravelDisciplinaryRecord, type LaravelEmployee } from '@/services/organization'

const LazyIncidentForm = lazy(() =>
  import('./disciplinary-management-form').then((module) => ({ default: module.IncidentForm })),
)

type IncidentRecord = {
  id: string
  department: string
  employee: string
  incidentDateTime: string
  location: string
  misconductType: MisconductType
  description: string
  witness: string
  actionTaken: ActionTaken
  remarks: string
  reportedBy: string
  reportDate: string
}

type SearchKey =
  | 'department'
  | 'employee'
  | 'incidentDateTime'
  | 'location'
  | 'misconductType'
  | 'description'
  | 'witness'
  | 'actionTaken'
  | 'remarks'
  | 'reportedBy'
  | 'reportDate'

const initialForm: IncidentFormState = {
  department: '',
  employee: '',
  incidentDateTime: '',
  location: '',
  misconductType: '',
  description: '',
  witness: '',
  actionTaken: '',
  remarks: '',
}

const pageSizeOptions = [5, 10, 15].map((size) => ({ label: `${size} / page`, value: String(size) }))

function employeeName(employee: LaravelEmployee) {
  return employee.name || employee.employee_name || employee.full_name || [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ') || String(employee.id)
}

function mapIncident(record: LaravelDisciplinaryRecord): IncidentRecord {
  return {
    id: String(record.id),
    department: String(record.department_id ?? record.department_name ?? ''),
    employee: String(record.employee_id ?? record.employee_name ?? ''),
    incidentDateTime: record.incident_datetime?.slice(0, 16).replace(' ', 'T') ?? '',
    location: record.location ?? '',
    misconductType: (record.misconduct_type || 'Others') as MisconductType,
    description: record.description ?? '',
    witness: String(record.witness_id ?? record.witness_name ?? ''),
    actionTaken: (record.action_taken || 'Others') as ActionTaken,
    remarks: record.remarks ?? '-',
    reportedBy: String(record.reported_by ?? record.reported_by_name ?? ''),
    reportDate: record.date_of_report ?? '',
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd MMM yyyy, hh:mm a')
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd MMM yyyy')
}

function todayIsoDate() {
  return format(new Date(), 'yyyy-MM-dd')
}

function createCsv(records: IncidentRecord[]) {
  const headers = [
    'Sr. No.',
    'Department',
    'Employee',
    'Incident Date & Time',
    'Location',
    'Misconduct Type',
    'Description',
    'Witness',
    'Action Taken',
    'Remarks',
    'Reported By',
    'Date of Report',
  ]

  const rows = records.map((record, index) => [
    String(index + 1),
    record.department,
    record.employee,
    formatDateTime(record.incidentDateTime),
    record.location,
    record.misconductType,
    record.description,
    record.witness,
    record.actionTaken,
    record.remarks,
    record.reportedBy,
    formatDate(record.reportDate),
  ])

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function IncidentFormSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className={index === 6 ? 'md:col-span-2 xl:col-span-3' : index === 7 ? 'md:col-span-2' : ''}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
    </div>
  )
}

export function DisciplinaryManagement() {
  const { user } = useAuth()
  const [records, setRecords] = useState<IncidentRecord[]>([])
  const [departments, setDepartments] = useState<LaravelDepartment[]>([])
  const [employees, setEmployees] = useState<LaravelEmployee[]>([])
  const [formEmployees, setFormEmployees] = useState<LaravelDepartmentEmployee[]>([])
  const [editEmployees, setEditEmployees] = useState<LaravelDepartmentEmployee[]>([])
  const [form, setForm] = useState<IncidentFormState>(initialForm)
  const [editForm, setEditForm] = useState<IncidentFormState>(initialForm)
  const [editingRecord, setEditingRecord] = useState<IncidentRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<IncidentRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFormEmployeesLoading, setIsFormEmployeesLoading] = useState(false)
  const [isEditEmployeesLoading, setIsEditEmployeesLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [search, setSearch] = useState<Record<SearchKey, string>>({
    department: '',
    employee: '',
    incidentDateTime: '',
    location: '',
    misconductType: '',
    description: '',
    witness: '',
    actionTaken: '',
    remarks: '',
    reportedBy: '',
    reportDate: '',
  })
  const context = useMemo(() => getLaravelContext(user), [user])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [disciplineResponse, complianceResponse, departmentsResponse] = await Promise.all([
        organizationService.getDisciplinaryRecords(context),
        organizationService.getComplianceRecords(context),
        organizationService.getDepartmentsManagement(context),
      ])
      setRecords((disciplineResponse.data ?? []).map(mapIncident))
      setEmployees(complianceResponse.userDetails ?? [])
      setDepartments([...departmentsResponse.main_departments, ...Object.values(departmentsResponse.sub_departments).flat()])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load disciplinary records.')
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => void loadData())
  }, [loadData])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  useEffect(() => {
    setPage(1)
  }, [search, pageSize])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      return (Object.keys(search) as SearchKey[]).every((key) => {
        const needle = search[key].trim().toLowerCase()
        if (!needle) return true
        const value = key === 'incidentDateTime'
          ? formatDateTime(record.incidentDateTime)
          : key === 'reportDate'
            ? formatDate(record.reportDate)
            : record[key]
        return String(value).toLowerCase().includes(needle)
      })
    })
  }, [records, search])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const stats = useMemo(() => {
    const escalated = records.filter((record) => record.actionTaken === 'Termination' || record.actionTaken === 'Suspension').length
    const departmentsCovered = new Set(records.map((record) => record.department)).size

    return [
      { label: 'Total Incidents', value: records.length, helper: 'Registered disciplinary records' },
      { label: 'Departments', value: departmentsCovered, helper: 'Business units represented' },
      { label: 'Escalated Cases', value: escalated, helper: 'Requires stronger follow-up' },
    ]
  }, [records])

  const departmentOptions = useMemo(
    () => departments.map((department) => ({ label: department.department, value: String(department.id) })),
    [departments],
  )
  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: employeeName(employee), value: String(employee.id) })),
    [employees],
  )
  const formEmployeeOptions = useMemo(
    () => formEmployees.map((employee) => ({ label: employeeName(employee), value: String(employee.id) })),
    [formEmployees],
  )
  const editEmployeeOptions = useMemo(
    () => editEmployees.map((employee) => ({ label: employeeName(employee), value: String(employee.id) })),
    [editEmployees],
  )
  const departmentNames = useMemo(() => new Map(departments.map((department) => [String(department.id), department.department])), [departments])
  const employeeNames = useMemo(() => new Map(employees.map((employee) => [String(employee.id), employeeName(employee)])), [employees])

  const loadEmployeesByDepartment = useCallback(async (
    departmentId: string,
    target: 'create' | 'edit',
    options?: { keepSelectedEmployee?: boolean },
  ) => {
    const setTargetEmployees = target === 'create' ? setFormEmployees : setEditEmployees
    const setTargetLoading = target === 'create' ? setIsFormEmployeesLoading : setIsEditEmployeesLoading

    if (!departmentId) {
      setTargetEmployees([])
      return
    }

    setTargetLoading(true)
    try {
      const departmentEmployees = await organizationService.getEmployeesByDepartment(context, departmentId)
      setTargetEmployees(departmentEmployees)
      setEmployees((current) => {
        const merged = new Map(current.map((employee) => [String(employee.id), employee]))
        departmentEmployees.forEach((employee) => merged.set(String(employee.id), employee))
        return Array.from(merged.values())
      })
      if (!options?.keepSelectedEmployee) {
        if (target === 'create') {
          setForm((current) => ({ ...current, employee: '' }))
        } else {
          setEditForm((current) => ({ ...current, employee: '' }))
        }
      }
    } catch (error) {
      setTargetEmployees([])
      if (!(error instanceof Error) || !error.message.includes('404')) {
        setNotice(error instanceof Error ? error.message : 'Failed to load employees for the selected department.')
      }
    } finally {
      setTargetLoading(false)
    }
  }, [context])

  const handleCreateDepartmentChange = (department: string) => {
    setForm((current) => ({ ...current, department, employee: '' }))
    void loadEmployeesByDepartment(department, 'create')
  }

  const handleEditDepartmentChange = (department: string) => {
    setEditForm((current) => ({ ...current, department, employee: '' }))
    void loadEmployeesByDepartment(department, 'edit')
  }

  const validateForm = (state: IncidentFormState) => {
    return Boolean(
      state.department &&
      state.employee &&
      state.incidentDateTime &&
      state.location.trim() &&
      state.misconductType &&
      state.description.trim() &&
      state.actionTaken,
    )
  }

  const handleSubmit = async () => {
    if (!validateForm(form)) {
      setNotice('Department, employee, incident date, location, misconduct type, description, and action taken are required.')
      return
    }

    try {
      await organizationService.createDisciplinaryRecord(context, {
        department_id: form.department,
        employee_id: form.employee,
        incident_datetime: form.incidentDateTime,
        location: form.location.trim(),
        misconduct_type: form.misconductType,
        description: form.description.trim(),
        witness_id: form.witness,
        action_taken: form.actionTaken,
        remarks: form.remarks.trim(),
        reported_by: context.userId,
        date_of_report: todayIsoDate(),
        sub_institute_id: context.subInstituteId,
      })
      setForm(initialForm)
      setNotice('Disciplinary incident submitted successfully.')
      await loadData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to submit disciplinary incident.')
    }
  }

  const openEdit = (record: IncidentRecord) => {
    setEditingRecord(record)
    setEditForm({
      department: record.department,
      employee: record.employee,
      incidentDateTime: record.incidentDateTime,
      location: record.location,
      misconductType: record.misconductType,
      description: record.description,
      witness: record.witness === '-' ? '' : record.witness,
      actionTaken: record.actionTaken,
      remarks: record.remarks === '-' ? '' : record.remarks,
    })
    void loadEmployeesByDepartment(record.department, 'edit', { keepSelectedEmployee: true })
  }

  const handleUpdate = async () => {
    if (!editingRecord || !validateForm(editForm)) {
      setNotice('Department, employee, incident date, location, misconduct type, description, and action taken are required.')
      return
    }

    try {
      await organizationService.updateDisciplinaryRecord(context, editingRecord.id, {
        department_id: editForm.department,
        employee_id: editForm.employee,
        incident_datetime: editForm.incidentDateTime,
        location: editForm.location.trim(),
        misconduct_type: editForm.misconductType,
        description: editForm.description.trim(),
        witness_id: editForm.witness,
        action_taken: editForm.actionTaken,
        remarks: editForm.remarks.trim(),
        reported_by: context.userId,
        date_of_report: editingRecord.reportDate || todayIsoDate(),
        sub_institute_id: context.subInstituteId,
      })
      setEditingRecord(null)
      setNotice('Disciplinary incident updated successfully.')
      await loadData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to update disciplinary incident.')
    }
  }

  const handleDelete = async () => {
    if (!deleteRecord) return
    try {
      await organizationService.deleteDisciplinaryRecord(context, deleteRecord.id, context.userId)
      setDeleteRecord(null)
      setNotice('Disciplinary incident deleted successfully.')
      await loadData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to delete disciplinary incident.')
    }
  }

  const handlePrint = () => {
    window.print()
    setNotice('Print dialog opened.')
  }

  const handleExcelExport = () => {
    downloadFile('disciplinary-management-report.csv', createCsv(filteredRecords), 'text/csv;charset=utf-8')
    setNotice('Excel export downloaded.')
  }

  const handlePdfExport = () => {
    window.print()
    setNotice('Use the print dialog to save this report as PDF.')
  }

  const searchCell = (key: SearchKey, placeholder: string) => (
    <div className="relative min-w-[140px]">
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={`Search ${placeholder}`}
        className="h-7 pl-7 text-xs normal-case"
        placeholder={placeholder}
        value={search[key]}
        onChange={(event) => setSearch((current) => ({ ...current, [key]: event.target.value }))}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/8 via-card to-card">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldAlert className="size-6" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-2xl font-semibold">Disciplinary Management</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                Register, monitor, update, and export employee disciplinary incident records for HR review and follow-up.
              </CardDescription>
            </div>
          </div>
          <Badge variant="navy">{filteredRecords.length} visible records</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {notice && (
        <div
          role="status"
          className={cn(
            'rounded-xl border px-4 py-3 text-sm shadow-sm',
            notice.includes('required')
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-success/20 bg-success/10 text-success',
          )}
        >
          {notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5 text-primary" />
            Incident Registration Form
          </CardTitle>
          <CardDescription>
            Capture employee, incident details, witnesses, actions taken, and optional closure remarks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<IncidentFormSkeleton />}>
            <LazyIncidentForm
              form={form}
              onChange={(next) => setForm((current) => ({ ...current, ...next }))}
              onSubmit={handleSubmit}
              submitLabel="Submit Incident"
              submitIcon={<Plus className="size-4" />}
              departmentOptions={departmentOptions}
              employeeOptions={formEmployeeOptions}
              witnessOptions={employeeOptions.filter((option) => option.value !== form.employee)}
              isEmployeeLoading={isFormEmployeesLoading}
              onDepartmentChange={handleCreateDepartmentChange}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg">Incident Report Data Table</CardTitle>
            <CardDescription>
              Search each column, maintain disciplinary records, and export the current filtered report.
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="size-4" />
              Print Report
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExcelExport}>
              <FileSpreadsheet className="size-4" />
              Export to Excel
            </Button>
            <Button variant="outline" className="gap-2" onClick={handlePdfExport}>
              <FileText className="size-4" />
              Export to PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-y border-border bg-surface-muted/60 px-4 py-3">
            <Badge variant="navy">{filteredRecords.length} visible</Badge>
            <Select
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value))}
              options={pageSizeOptions}
            />
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : (
            <>
              <div className="max-h-[620px] overflow-auto">
                <Table className="min-w-[1750px]">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16">Sr. No.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Incident Date & Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Misconduct Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Witness</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date of Report</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                    <TableRow className="bg-surface-muted/80 hover:bg-surface-muted/80">
                      <TableHead />
                      <TableHead>{searchCell('department', 'Department')}</TableHead>
                      <TableHead>{searchCell('employee', 'Employee')}</TableHead>
                      <TableHead>{searchCell('incidentDateTime', 'Incident date')}</TableHead>
                      <TableHead>{searchCell('location', 'Location')}</TableHead>
                      <TableHead>{searchCell('misconductType', 'Misconduct')}</TableHead>
                      <TableHead>{searchCell('description', 'Description')}</TableHead>
                      <TableHead>{searchCell('witness', 'Witness')}</TableHead>
                      <TableHead>{searchCell('actionTaken', 'Action')}</TableHead>
                      <TableHead>{searchCell('remarks', 'Remarks')}</TableHead>
                      <TableHead>{searchCell('reportedBy', 'Reported by')}</TableHead>
                      <TableHead>{searchCell('reportDate', 'Report date')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="py-14 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                              <FileText className="size-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">No disciplinary records found</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Submit a new incident or adjust the column filters.
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedRecords.map((record, index) => (
                        <TableRow key={record.id} className="group">
                          <TableCell className="font-medium text-muted-foreground">
                            {(currentPage - 1) * pageSize + index + 1}
                          </TableCell>
                          <TableCell>{departmentNames.get(record.department) ?? record.department}</TableCell>
                          <TableCell className="font-medium text-foreground">{employeeNames.get(record.employee) ?? record.employee}</TableCell>
                          <TableCell>{formatDateTime(record.incidentDateTime)}</TableCell>
                          <TableCell>{record.location}</TableCell>
                          <TableCell>
                            <Badge variant="muted">{record.misconductType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <p className="line-clamp-2 text-muted-foreground">{record.description}</p>
                          </TableCell>
                          <TableCell>{employeeNames.get(record.witness) ?? record.witness}</TableCell>
                          <TableCell>
                            <StatusBadge status={record.actionTaken} />
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="line-clamp-2 text-muted-foreground">{record.remarks}</p>
                          </TableCell>
                          <TableCell>{employeeNames.get(record.reportedBy) ?? record.reportedBy}</TableCell>
                          <TableCell>{formatDate(record.reportDate)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit incident for ${record.employee}`}
                                onClick={() => openEdit(record)}
                              >
                                <Edit3 className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-sm"
                                aria-label={`Delete incident for ${record.employee}`}
                                onClick={() => setDeleteRecord(record)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pagedRecords.length ? (currentPage - 1) * pageSize + 1 : 0}-
                  {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => value + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
            <DialogDescription>
              Update the disciplinary incident details before saving the revised record.
            </DialogDescription>
          </DialogHeader>
          <Suspense fallback={<IncidentFormSkeleton />}>
            <LazyIncidentForm
              form={editForm}
              onChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
              onSubmit={handleUpdate}
              submitLabel="Update"
              submitIcon={<Edit3 className="size-4" />}
              departmentOptions={departmentOptions}
              employeeOptions={editEmployeeOptions}
              witnessOptions={employeeOptions.filter((option) => option.value !== editForm.employee)}
              isEmployeeLoading={isEditEmployeesLoading}
              onDepartmentChange={handleEditDepartmentChange}
            />
          </Suspense>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle>Delete disciplinary record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the incident record for {deleteRecord?.employee ?? 'this employee'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteRecord(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
