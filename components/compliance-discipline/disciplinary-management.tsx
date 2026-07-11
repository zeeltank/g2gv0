'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type MisconductType = 'Attendance Issue' | 'Policy Violation' | 'Harassment' | 'Misuse of Assets' | 'Safety Violation' | 'Insubordination'
type ActionTaken = 'Verbal Warning' | 'Written Warning' | 'Suspension' | 'Training Assigned' | 'Final Warning' | 'Escalated to HR'

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

type IncidentFormState = {
  department: string
  employee: string
  incidentDateTime: string
  location: string
  misconductType: MisconductType | ''
  description: string
  witness: string
  actionTaken: ActionTaken | ''
  remarks: string
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

const departments = [
  {
    label: 'Human Resources',
    value: 'Human Resources',
    employees: ['Aarav Mehta', 'Priya Sharma', 'Neha Kapoor'],
  },
  {
    label: 'Finance',
    value: 'Finance',
    employees: ['Rohan Das', 'Meera Iyer', 'Vikram Rao'],
  },
  {
    label: 'Operations',
    value: 'Operations',
    employees: ['Karan Malhotra', 'Ananya Sen', 'Dev Patel'],
  },
  {
    label: 'Legal',
    value: 'Legal',
    employees: ['Nisha Verma', 'Arjun Khanna', 'Sara Ali'],
  },
  {
    label: 'Information Technology',
    value: 'Information Technology',
    employees: ['Kabir Sethi', 'Isha Nair', 'Rhea Thomas'],
  },
]

const misconductTypes: MisconductType[] = [
  'Attendance Issue',
  'Policy Violation',
  'Harassment',
  'Misuse of Assets',
  'Safety Violation',
  'Insubordination',
]

const actionTakenOptions: ActionTaken[] = [
  'Verbal Warning',
  'Written Warning',
  'Suspension',
  'Training Assigned',
  'Final Warning',
  'Escalated to HR',
]

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

const initialRecords: IncidentRecord[] = [
  {
    id: 'inc-1',
    department: 'Operations',
    employee: 'Karan Malhotra',
    incidentDateTime: '2026-07-01T10:30',
    location: 'Warehouse Floor 2',
    misconductType: 'Safety Violation',
    description: 'Employee entered a restricted loading area without mandatory safety gear.',
    witness: 'Ananya Sen',
    actionTaken: 'Written Warning',
    remarks: 'Safety refresher training assigned for this week.',
    reportedBy: 'Meera Iyer',
    reportDate: '2026-07-01',
  },
  {
    id: 'inc-2',
    department: 'Information Technology',
    employee: 'Kabir Sethi',
    incidentDateTime: '2026-06-28T15:15',
    location: 'IT Service Desk',
    misconductType: 'Policy Violation',
    description: 'Shared a temporary system access code through an unapproved channel.',
    witness: 'Isha Nair',
    actionTaken: 'Training Assigned',
    remarks: 'Follow-up review scheduled after policy training completion.',
    reportedBy: 'Priya Sharma',
    reportDate: '2026-06-29',
  },
  {
    id: 'inc-3',
    department: 'Finance',
    employee: 'Rohan Das',
    incidentDateTime: '2026-06-24T09:45',
    location: 'Finance Bay',
    misconductType: 'Attendance Issue',
    description: 'Repeated late arrival without prior manager approval.',
    witness: 'Meera Iyer',
    actionTaken: 'Verbal Warning',
    remarks: 'Attendance will be monitored for the next 30 days.',
    reportedBy: 'Aarav Mehta',
    reportDate: '2026-06-24',
  },
]

const departmentOptions = departments.map(({ label, value }) => ({ label, value }))
const misconductOptions = misconductTypes.map((type) => ({ label: type, value: type }))
const actionOptions = actionTakenOptions.map((action) => ({ label: action, value: action }))
const pageSizeOptions = [5, 10, 15].map((size) => ({ label: `${size} / page`, value: String(size) }))

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
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

function IncidentForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  submitIcon,
}: {
  form: IncidentFormState
  onChange: (next: Partial<IncidentFormState>) => void
  onSubmit: () => void
  submitLabel: string
  submitIcon?: ReactNode
}) {
  const employeeOptions = departments
    .find((department) => department.value === form.department)
    ?.employees.map((employee) => ({ label: employee, value: employee })) ?? []

  const witnessOptions = departments
    .flatMap((department) => department.employees)
    .filter((employee) => employee !== form.employee)
    .map((employee) => ({ label: employee, value: employee }))

  const handleDepartmentChange = (department: string) => {
    onChange({ department, employee: '' })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Department" required>
          <Select
            value={form.department}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Select department"
          />
        </Field>

        <Field label="Employee" required>
          <Select
            value={form.employee}
            onChange={(employee) => onChange({ employee })}
            options={employeeOptions}
            placeholder={form.department ? 'Select employee' : 'Select department first'}
          />
        </Field>

        <Field label="Incident Date & Time" required>
          <Input
            aria-label="Incident Date and Time"
            type="datetime-local"
            value={form.incidentDateTime}
            onChange={(event) => onChange({ incidentDateTime: event.target.value })}
          />
        </Field>

        <Field label="Location" required>
          <Input
            aria-label="Location"
            placeholder="Enter incident location"
            value={form.location}
            onChange={(event) => onChange({ location: event.target.value })}
          />
        </Field>

        <Field label="Type of Misconduct" required>
          <Select
            value={form.misconductType}
            onChange={(misconductType) => onChange({ misconductType: misconductType as MisconductType })}
            options={misconductOptions}
            placeholder="Select misconduct type"
          />
        </Field>

        <Field label="Witness">
          <Select
            value={form.witness}
            onChange={(witness) => onChange({ witness })}
            options={witnessOptions}
            placeholder="Select witness"
          />
        </Field>

        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Description of Incident" required>
            <Textarea
              aria-label="Description of Incident"
              placeholder="Record the incident details, context, and immediate observations"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Action Taken" required>
          <Select
            value={form.actionTaken}
            onChange={(actionTaken) => onChange({ actionTaken: actionTaken as ActionTaken })}
            options={actionOptions}
            placeholder="Select action taken"
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Remarks">
            <Textarea
              aria-label="Remarks"
              placeholder="Add optional notes, follow-up expectations, or closure remarks"
              value={form.remarks}
              onChange={(event) => onChange({ remarks: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" className="w-full gap-2 sm:w-auto" onClick={onSubmit}>
          {submitIcon}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
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

export function DisciplinaryManagement() {
  const [records, setRecords] = useState<IncidentRecord[]>(initialRecords)
  const [form, setForm] = useState<IncidentFormState>(initialForm)
  const [editForm, setEditForm] = useState<IncidentFormState>(initialForm)
  const [editingRecord, setEditingRecord] = useState<IncidentRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<IncidentRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 500)
    return () => window.clearTimeout(timer)
  }, [])

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
    const escalated = records.filter((record) => record.actionTaken === 'Escalated to HR' || record.actionTaken === 'Suspension').length
    const departmentsCovered = new Set(records.map((record) => record.department)).size

    return [
      { label: 'Total Incidents', value: records.length, helper: 'Registered disciplinary records' },
      { label: 'Departments', value: departmentsCovered, helper: 'Business units represented' },
      { label: 'Escalated Cases', value: escalated, helper: 'Requires stronger follow-up' },
    ]
  }, [records])

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

  const handleSubmit = () => {
    if (!validateForm(form)) {
      setNotice('Department, employee, incident date, location, misconduct type, description, and action taken are required.')
      return
    }

    const nextRecord: IncidentRecord = {
      id: `inc-${Date.now()}`,
      department: form.department,
      employee: form.employee,
      incidentDateTime: form.incidentDateTime,
      location: form.location.trim(),
      misconductType: form.misconductType as MisconductType,
      description: form.description.trim(),
      witness: form.witness || '-',
      actionTaken: form.actionTaken as ActionTaken,
      remarks: form.remarks.trim() || '-',
      reportedBy: 'HR Administrator',
      reportDate: todayIsoDate(),
    }

    setRecords((current) => [nextRecord, ...current])
    setForm(initialForm)
    setNotice('Disciplinary incident submitted successfully.')
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
  }

  const handleUpdate = () => {
    if (!editingRecord || !validateForm(editForm)) {
      setNotice('Department, employee, incident date, location, misconduct type, description, and action taken are required.')
      return
    }

    setRecords((current) => current.map((record) => (
      record.id === editingRecord.id
        ? {
            ...record,
            department: editForm.department,
            employee: editForm.employee,
            incidentDateTime: editForm.incidentDateTime,
            location: editForm.location.trim(),
            misconductType: editForm.misconductType as MisconductType,
            description: editForm.description.trim(),
            witness: editForm.witness || '-',
            actionTaken: editForm.actionTaken as ActionTaken,
            remarks: editForm.remarks.trim() || '-',
          }
        : record
    )))
    setEditingRecord(null)
    setNotice('Disciplinary incident updated successfully.')
  }

  const handleDelete = () => {
    if (!deleteRecord) return
    setRecords((current) => current.filter((record) => record.id !== deleteRecord.id))
    setDeleteRecord(null)
    setNotice('Disciplinary incident deleted successfully.')
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
          <IncidentForm
            form={form}
            onChange={(next) => setForm((current) => ({ ...current, ...next }))}
            onSubmit={handleSubmit}
            submitLabel="Submit Incident"
            submitIcon={<Plus className="size-4" />}
          />
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
                          <TableCell>{record.department}</TableCell>
                          <TableCell className="font-medium text-foreground">{record.employee}</TableCell>
                          <TableCell>{formatDateTime(record.incidentDateTime)}</TableCell>
                          <TableCell>{record.location}</TableCell>
                          <TableCell>
                            <Badge variant="muted">{record.misconductType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <p className="line-clamp-2 text-muted-foreground">{record.description}</p>
                          </TableCell>
                          <TableCell>{record.witness}</TableCell>
                          <TableCell>
                            <StatusBadge status={record.actionTaken} />
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <p className="line-clamp-2 text-muted-foreground">{record.remarks}</p>
                          </TableCell>
                          <TableCell>{record.reportedBy}</TableCell>
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
          <IncidentForm
            form={editForm}
            onChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
            onSubmit={handleUpdate}
            submitLabel="Update"
            submitIcon={<Edit3 className="size-4" />}
          />
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
