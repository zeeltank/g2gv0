'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, FileText, Paperclip, Search, Trash2, UploadCloud } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SearchKey } from './compliance-library-management-types'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelComplianceRecord, type LaravelEmployee } from '@/services/organization'
import {
  ComplianceForm,
  type ComplianceFormState,
  type ComplianceRecord,
  type Frequency,
  TableSkeleton,
  createCsv,
  departmentOptions,
  displayDate,
  downloadFile,
  frequencySelectOptions,
  initialForm,
  pageSizeOptions,
} from './compliance-library-management-shared'

const LazyComplianceLibraryToolbar = lazy(() =>
  import('./compliance-library-management-toolbar').then((module) => ({ default: module.ComplianceLibraryToolbar })),
)

const LazyComplianceDialogs = lazy(() =>
  import('./compliance-library-management-dialogs').then((module) => ({ default: module.ComplianceDialogs })),
)

function employeeName(employee: LaravelEmployee) {
  return employee.name || employee.employee_name || employee.full_name || [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' ') || String(employee.id)
}

function mapComplianceRecord(record: LaravelComplianceRecord): ComplianceRecord {
  return {
    id: String(record.id),
    name: record.name ?? '',
    description: record.description ?? '',
    department: record.standard_name ?? '-',
    assignedTo: record.assigned_user ?? String(record.assigned_to ?? '-'),
    dueDate: record.duedate ?? '',
    frequency: (record.frequency || 'One-Time') as Frequency,
    customDate: record.custom_frequency_details ?? '',
    attachmentName: record.attachment ?? '',
  }
}

export function ComplianceLibraryManagement() {
  const { user } = useAuth()
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [employees, setEmployees] = useState<LaravelEmployee[]>([])
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
  const context = useMemo(() => getLaravelContext(user), [user])

  const loadRecords = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await organizationService.getComplianceRecords(context)
      setRecords((response.complainceData ?? []).map(mapComplianceRecord))
      setEmployees(response.userDetails ?? [])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load compliance records.')
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => void loadRecords())
  }, [loadRecords])

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
  const displayPage = (() => {
    if (page > totalPages) return 1
    return page
  })()
  const pagedRecords = filteredRecords.slice((displayPage - 1) * pageSize, displayPage * pageSize)

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  useEffect(() => {
    setPage(1)
  }, [search, pageSize])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ label: employeeName(employee), value: String(employee.id) })),
    [employees],
  )

  const validateForm = (state: ComplianceFormState) => {
    return state.name.trim() && state.description.trim()
  }

  const handleSubmit = async () => {
    if (!validateForm(form)) {
      setNotice('Compliance Name and Description are required.')
      return
    }

    try {
      await organizationService.saveComplianceRecord(context, {
      name: form.name.trim(),
      description: form.description.trim(),
        standard_name: form.department,
        assigned_to: form.assignedTo,
        duedate: form.dueDate,
        frequency: form.frequency || 'One-Time',
        custom_frequency_details: form.customDate,
        attachment: form.attachmentFile,
      })
      setForm(initialForm)
      setUploadKey((key) => key + 1)
      setNotice('Compliance record created successfully.')
      await loadRecords()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to create compliance record.')
    }
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

  const handleSaveEdit = async () => {
    if (!editingRecord || !validateForm(editForm)) {
      setNotice('Compliance Name and Description are required.')
      return
    }

    try {
      await organizationService.updateComplianceRecord(context, editingRecord.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        standard_name: editForm.department,
        assigned_to: editForm.assignedTo,
        duedate: editForm.dueDate,
        frequency: editForm.frequency || 'One-Time',
        custom_frequency_details: editForm.customDate,
        oldAttachment: editingRecord.attachmentName,
        attachment: editForm.attachmentFile,
      })
      setEditingRecord(null)
      setNotice('Compliance record updated successfully.')
      await loadRecords()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to update compliance record.')
    }
  }

  const handleDelete = async () => {
    if (!deleteRecord) return
    try {
      await organizationService.deleteComplianceRecord(context, deleteRecord.id)
      setDeleteRecord(null)
      setNotice('Compliance record deleted successfully.')
      await loadRecords()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to delete compliance record.')
    }
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
      <Suspense fallback={<div className="h-36 animate-pulse rounded-xl border border-border/70 bg-muted/20" />}>
        <LazyComplianceLibraryToolbar
          visibleCount={filteredRecords.length}
          totalCount={records.length}
          onPrint={handlePrint}
          onExcelExport={handleExcelExport}
          onPdfExport={handlePdfExport}
        />
      </Suspense>

      <Card>
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
            employeeOptions={employeeOptions}
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
                            {(displayPage - 1) * pageSize + index + 1}
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
                  Showing {pagedRecords.length ? (displayPage - 1) * pageSize + 1 : 0}-
                  {Math.min(displayPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={displayPage <= 1} onClick={() => setPage((value) => value - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={displayPage >= totalPages} onClick={() => setPage((value) => value + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={null}>
        <LazyComplianceDialogs
          editingRecord={editingRecord}
          editForm={editForm}
          editUploadKey={editUploadKey}
          employeeOptions={employeeOptions}
          onEditChange={(next) => setEditForm((current) => ({ ...current, ...next }))}
          onEditSave={handleSaveEdit}
          onEditClose={() => setEditingRecord(null)}
          deleteRecord={deleteRecord}
          onDeleteConfirm={handleDelete}
          onDeleteClose={() => setDeleteRecord(null)}
        />
      </Suspense>
    </div>
  )
}


