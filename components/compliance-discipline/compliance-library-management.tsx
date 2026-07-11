'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Edit3,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { format } from 'date-fns'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Frequency = 'One-Time' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom'

type ComplianceRecord = {
  id: string
  name: string
  description: string
  department: string
  assignedTo: string
  dueDate: string
  frequency: Frequency
  customDate?: string
  attachmentName?: string
}

type ComplianceFormState = {
  name: string
  description: string
  department: string
  assignedTo: string
  dueDate: string
  frequency: Frequency | ''
  customDate: string
  attachmentName: string
}

type SearchKey = 'name' | 'description' | 'department' | 'assignedTo' | 'dueDate' | 'frequency' | 'attachmentName'

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

const frequencyOptions: Frequency[] = ['One-Time', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom']

const initialForm: ComplianceFormState = {
  name: '',
  description: '',
  department: '',
  assignedTo: '',
  dueDate: '',
  frequency: '',
  customDate: '',
  attachmentName: '',
}

const initialRecords: ComplianceRecord[] = [
  {
    id: 'cmp-1',
    name: 'POSH Policy Acknowledgement',
    description: 'Annual policy acknowledgement and workforce confirmation.',
    department: 'Human Resources',
    assignedTo: 'Priya Sharma',
    dueDate: '2026-07-31',
    frequency: 'Yearly',
    attachmentName: 'posh-policy.pdf',
  },
  {
    id: 'cmp-2',
    name: 'GST Filing Review',
    description: 'Monthly compliance evidence review before statutory filing.',
    department: 'Finance',
    assignedTo: 'Meera Iyer',
    dueDate: '2026-07-20',
    frequency: 'Monthly',
    attachmentName: 'gst-checklist.xlsx',
  },
  {
    id: 'cmp-3',
    name: 'Data Access Audit',
    description: 'Quarterly verification of privileged access and control owners.',
    department: 'Information Technology',
    assignedTo: 'Kabir Sethi',
    dueDate: '2026-08-15',
    frequency: 'Quarterly',
    attachmentName: 'access-audit-template.docx',
  },
]

const departmentOptions = departments.map(({ label, value }) => ({ label, value }))
const frequencySelectOptions = frequencyOptions.map((frequency) => ({ label: frequency, value: frequency }))
const pageSizeOptions = [5, 10, 15].map((size) => ({ label: `${size} / page`, value: String(size) }))

function toIsoDate(value?: Date | string) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return format(date, 'yyyy-MM-dd')
}

function displayDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, 'dd MMM yyyy')
}

function createCsv(records: ComplianceRecord[]) {
  const headers = ['Sr No.', 'Name', 'Description', 'Department', 'Assigned To', 'Due Date', 'Frequency', 'Attachment']
  const rows = records.map((record, index) => [
    String(index + 1),
    record.name,
    record.description,
    record.department,
    record.assignedTo,
    displayDate(record.dueDate),
    record.frequency,
    record.attachmentName || 'No attachment',
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

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

function ComplianceForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  uploadKey,
  currentAttachment,
}: {
  form: ComplianceFormState
  onChange: (next: Partial<ComplianceFormState>) => void
  onSubmit: () => void
  submitLabel: string
  uploadKey: string | number
  currentAttachment?: string
}) {
  const employeeOptions = departments
    .find((department) => department.value === form.department)
    ?.employees.map((employee) => ({ label: employee, value: employee })) ?? []

  const handleDepartmentChange = (department: string) => {
    onChange({ department, assignedTo: '' })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Compliance Name" required>
          <Input
            aria-label="Compliance Name"
            placeholder="Enter compliance name"
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        <Field label="Department">
          <Select
            value={form.department}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Select department"
          />
        </Field>

        <div className="lg:col-span-2">
          <Field label="Description" required>
            <Textarea
              aria-label="Description"
              placeholder="Summarize compliance requirement, controls, and evidence needed"
              value={form.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Assigned Employee">
          <Select
            value={form.assignedTo}
            onChange={(assignedTo) => onChange({ assignedTo })}
            options={employeeOptions}
            placeholder={form.department ? 'Select employee' : 'Select department first'}
          />
        </Field>

        <Field label="Due Date">
          <DatePicker
            value={form.dueDate}
            onChange={(date) => onChange({ dueDate: toIsoDate(date) })}
            placeholder="Select due date"
          />
        </Field>

        <Field label="Frequency">
          <Select
            value={form.frequency}
            onChange={(frequency) => onChange({ frequency: frequency as Frequency, customDate: frequency === 'Custom' ? form.customDate : '' })}
            options={frequencySelectOptions}
            placeholder="Select frequency"
          />
        </Field>

        {form.frequency === 'Custom' && (
          <Field label="Custom Date">
            <DatePicker
              value={form.customDate}
              onChange={(date) => onChange({ customDate: toIsoDate(date) })}
              placeholder="Select custom date"
            />
          </Field>
        )}
      </div>

      <div className="grid gap-3">
        <FileUpload
          key={uploadKey}
          label="Attachment Upload"
          hint="PDF, DOCX, XLSX, PNG up to 10MB"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onFileSelect={(file) => onChange({ attachmentName: file?.name ?? '' })}
        />
        {currentAttachment && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Paperclip className="size-4" />
            <span className="truncate">Current attachment: {currentAttachment}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" className="w-full gap-2 sm:w-auto" onClick={onSubmit}>
          <Plus className="size-4" />
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

export function ComplianceLibraryManagement() {
  const [records, setRecords] = useState<ComplianceRecord[]>(initialRecords)
  const [form, setForm] = useState<ComplianceFormState>(initialForm)
  const [editForm, setEditForm] = useState<ComplianceFormState>(initialForm)
  const [editingRecord, setEditingRecord] = useState<ComplianceRecord | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<ComplianceRecord | null>(null)
  const [search, setSearch] = useState<Record<SearchKey, string>>({
    name: '',
    description: '',
    department: '',
    assignedTo: '',
    dueDate: '',
    frequency: '',
    attachmentName: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [uploadKey, setUploadKey] = useState(0)
  const [editUploadKey, setEditUploadKey] = useState(0)
  
  // Use a key to force page reset when search changes
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      return (Object.keys(search) as SearchKey[]).every((key) => {
        const needle = search[key].trim().toLowerCase()
        if (!needle) return true
        const value = key === 'dueDate' ? displayDate(record.dueDate) : record[key] ?? ''
        return String(value).toLowerCase().includes(needle)
      })
    })
  }, [records, search])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  // Reset page to 1 when search changes by using resetKey
  const displayPage = (() => {
    if (page > totalPages) return 1;
    return page;
  })()
  const pagedRecords = filteredRecords.slice((displayPage - 1) * pageSize, displayPage * pageSize)
  
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  useEffect(() => {
    setPage(1)
  }, [search, pageSize])
  /* eslint-enable react-hooks/set-state-in-effect */
  
  // Handle page change with bounds checking
  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }

  const stats = useMemo(() => {
    const dueThisMonth = records.filter((record) => {
      const date = new Date(record.dueDate)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    return [
      { label: 'Library Records', value: records.length, helper: 'Total configured compliances' },
      { label: 'Departments', value: new Set(records.map((record) => record.department)).size, helper: 'Covered business units' },
      { label: 'Due This Month', value: dueThisMonth, helper: 'Upcoming compliance actions' },
    ]
  }, [records])

  const validateForm = (state: ComplianceFormState) => {
    return state.name.trim() && state.description.trim()
  }

  const handleSubmit = () => {
    if (!validateForm(form)) {
      setNotice('Compliance Name and Description are required.')
      return
    }

    const nextRecord: ComplianceRecord = {
      id: `cmp-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      department: form.department || '-',
      assignedTo: form.assignedTo || '-',
      dueDate: form.dueDate,
      frequency: (form.frequency || 'One-Time') as Frequency,
      customDate: form.customDate,
      attachmentName: form.attachmentName,
    }

    setRecords((current) => [nextRecord, ...current])
    setForm(initialForm)
    setUploadKey((key) => key + 1)
    setNotice('Compliance record created successfully.')
  }

  const openEdit = (record: ComplianceRecord) => {
    setEditingRecord(record)
    setEditForm({
      name: record.name,
      description: record.description,
      department: record.department === '-' ? '' : record.department,
      assignedTo: record.assignedTo === '-' ? '' : record.assignedTo,
      dueDate: record.dueDate,
      frequency: record.frequency,
      customDate: record.customDate ?? '',
      attachmentName: record.attachmentName ?? '',
    })
    setEditUploadKey((key) => key + 1)
  }

  const handleSaveEdit = () => {
    if (!editingRecord || !validateForm(editForm)) {
      setNotice('Compliance Name and Description are required.')
      return
    }

    setRecords((current) => current.map((record) => (
      record.id === editingRecord.id
        ? {
            ...record,
            name: editForm.name.trim(),
            description: editForm.description.trim(),
            department: editForm.department || '-',
            assignedTo: editForm.assignedTo || '-',
            dueDate: editForm.dueDate,
            frequency: (editForm.frequency || 'One-Time') as Frequency,
            customDate: editForm.customDate,
            attachmentName: editForm.attachmentName || record.attachmentName,
          }
        : record
    )))
    setEditingRecord(null)
    setNotice('Compliance record updated successfully.')
  }

  const handleDelete = () => {
    if (!deleteRecord) return
    setRecords((current) => current.filter((record) => record.id !== deleteRecord.id))
    setDeleteRecord(null)
    setNotice('Compliance record deleted successfully.')
  }

  const handlePrint = () => {
    window.print()
    setNotice('Print dialog opened.')
  }

  const handleExcelExport = () => {
    downloadFile('compliance-library.csv', createCsv(filteredRecords), 'text/csv;charset=utf-8')
    setNotice('Excel export downloaded.')
  }

  const handlePdfExport = () => {
    window.print()
    setNotice('Use the print dialog to save this report as PDF.')
  }

  const searchCell = (key: SearchKey, placeholder: string) => (
    <div className="relative min-w-[130px]">
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
              <ShieldCheck className="size-6" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-2xl font-semibold">Compliance Library</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                Create, assign, track, and maintain recurring compliance obligations with evidence ownership and export-ready records.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="size-4" />
              Print
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExcelExport}>
              <FileSpreadsheet className="size-4" />
              Excel Export
            </Button>
            <Button variant="outline" className="gap-2" onClick={handlePdfExport}>
              <FileText className="size-4" />
              PDF Export
            </Button>
          </div>
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
            <UploadCloud className="size-5 text-primary" />
            Compliance Creation Form
          </CardTitle>
          <CardDescription>
            Register a compliance item, set ownership, attach evidence templates, and define its review cadence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceForm
            form={form}
            onChange={(next) => setForm((current) => ({ ...current, ...next }))}
            onSubmit={handleSubmit}
            submitLabel="Submit Compliance"
            uploadKey={uploadKey}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg">Compliance Records</CardTitle>
            <CardDescription>
              Search by column, review assigned owners, and maintain the live compliance library.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="navy">{filteredRecords.length} visible</Badge>
            <Select
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value))}
              options={pageSizeOptions}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <>
              <div className="max-h-[560px] overflow-auto">
                <Table className="min-w-[1050px]">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16">Sr No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                    <TableRow className="bg-surface-muted/80 hover:bg-surface-muted/80">
                      <TableHead />
                      <TableHead>{searchCell('name', 'Name')}</TableHead>
                      <TableHead>{searchCell('description', 'Description')}</TableHead>
                      <TableHead>{searchCell('department', 'Department')}</TableHead>
                      <TableHead>{searchCell('assignedTo', 'Assigned to')}</TableHead>
                      <TableHead>{searchCell('dueDate', 'Due date')}</TableHead>
                      <TableHead>{searchCell('frequency', 'Frequency')}</TableHead>
                      <TableHead>{searchCell('attachmentName', 'Attachment')}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-14 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
                              <FileText className="size-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">No compliance records found</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Create a new record or adjust column search filters.
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
                          <TableCell className="max-w-[180px]">
                            <p className="font-medium text-foreground">{record.name}</p>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <p className="line-clamp-2 text-muted-foreground">{record.description}</p>
                          </TableCell>
                          <TableCell>{record.department}</TableCell>
                          <TableCell>{record.assignedTo}</TableCell>
                          <TableCell>{displayDate(record.dueDate)}</TableCell>
                          <TableCell>
                            <Badge variant={record.frequency === 'Custom' ? 'warning' : 'navy'}>
                              {record.frequency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.attachmentName ? (
                              <span className="inline-flex max-w-[170px] items-center gap-2 text-primary">
                                <Paperclip className="size-4 shrink-0" />
                                <span className="truncate">{record.attachmentName}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No attachment</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${record.name}`}
                                onClick={() => openEdit(record)}
                              >
                                <Edit3 className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon-sm"
                                aria-label={`Delete ${record.name}`}
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compliance Record</DialogTitle>
            <DialogDescription>
              Update ownership, due date, frequency, and attachment details for this compliance item.
            </DialogDescription>
          </DialogHeader>
          <ComplianceForm
            form={editForm}
            onChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
            onSubmit={handleSaveEdit}
            submitLabel="Save Changes"
            uploadKey={editUploadKey}
            currentAttachment={editingRecord?.attachmentName}
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
            <AlertDialogTitle>Delete compliance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove {deleteRecord?.name ? `"${deleteRecord.name}"` : 'this record'} from the compliance library.
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


