'use client'

import { useRef, useState } from 'react'
import { Download, UploadCloud, Search, ChevronLeft, ChevronRight, Edit2, Trash2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export interface EmployeeRow {
  id: string
  employeeId: string
  name: string
  email: string
  department: string
  designation: string
  joiningDate: string
  status: 'Ready' | 'Needs Review'
}

export const sampleEmployees: EmployeeRow[] = [
  {
    id: '1',
    employeeId: 'EMP-001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@abctech.com',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    joiningDate: '2024-04-15',
    status: 'Ready',
  },
  {
    id: '2',
    employeeId: 'EMP-002',
    name: 'Nisha Shah',
    email: 'nisha.shah@abctech.com',
    department: 'Human Resources',
    designation: 'HR Manager',
    joiningDate: '2023-11-01',
    status: 'Ready',
  },
  {
    id: '3',
    employeeId: 'EMP-003',
    name: 'Rohan Iyer',
    email: '',
    department: 'Quality Assurance',
    designation: 'QA Analyst',
    joiningDate: '2025-01-20',
    status: 'Needs Review',
  },
]

interface EmployeeImportStepProps {
  employees: EmployeeRow[]
  setEmployees: (employees: EmployeeRow[]) => void
  employeeSearch: string
  setEmployeeSearch: (value: string) => void
  page: number
  setPage: (page: number | ((prev: number) => number)) => void
  importEmployees: () => void
  saveEmployees: () => void
  markEmployeeReady: (id: string) => void
  deleteEmployee: (id: string) => void
  downloadTemplate: () => void
}

export function EmployeeImportStep({
  employees,
  setEmployees,
  employeeSearch,
  setEmployeeSearch,
  page,
  setPage,
  importEmployees,
  saveEmployees,
  markEmployeeReady,
  deleteEmployee,
  downloadTemplate,
}: EmployeeImportStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const filteredEmployees = employees.filter((employee) => {
    const search = employeeSearch.toLowerCase()
    return [
      employee.employeeId,
      employee.name,
      employee.email,
      employee.department,
      employee.designation,
      employee.status,
    ].some((value) => value.toLowerCase().includes(search))
  })

  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / pageSize))
  const visibleEmployees = filteredEmployees.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )
  const invalidEmployees = employees.filter(
    (employee) => employee.status === 'Needs Review',
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => setIsDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    importEmployees()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              Bulk Employee Import
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload CSV or Excel files and review employee records
              before saving.
            </p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" />
            Download Sample Template
          </Button>
        </div>

        <div
          className={cn(
            'mt-5 flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-primary/40 bg-primary/5',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadCloud className="size-10 text-primary" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Drag & drop employee file here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV, XLS, or XLSX up to 10 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={importEmployees}
          />
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="size-4" />
            Upload File
          </Button>
        </div>
      </div>

      {employees.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Imported Employees
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {employees.length} records imported.{' '}
                {invalidEmployees.length} records need review.
              </p>
            </div>
            <SearchInput
              value={employeeSearch}
              onChange={(event) => {
                setEmployeeSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search employees"
              icon={<Search className="size-4" />}
            />
          </div>

          {invalidEmployees.length > 0 && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              Validation errors found: missing email addresses must be
              fixed before final import.
            </div>
          )}

          {filteredEmployees.length === 0 ? (
            <EmptyState
              title="No employees found"
              description="No employees match your search criteria. Try adjusting your search or import new records."
              className="my-6"
            />
          ) : (
            <div className="mt-4 rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Employee ID
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Employee Name
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Email
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Department
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Designation
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Joining Date
                    </TableHead>
                    <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                      Status
                    </TableHead>
                    <TableHead className="h-10 text-center text-[11px] normal-case text-foreground" scope="col">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="p-3 font-medium">
                        {employee.employeeId}
                      </TableCell>
                      <TableCell className="p-3">{employee.name}</TableCell>
                      <TableCell className="p-3">
                        {employee.email || 'Missing email'}
                      </TableCell>
                      <TableCell className="p-3">{employee.department}</TableCell>
                      <TableCell className="p-3">{employee.designation}</TableCell>
                      <TableCell className="p-3">{employee.joiningDate}</TableCell>
                      <TableCell className="p-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-xs font-semibold',
                            employee.status === 'Ready'
                              ? 'bg-success/10 text-success'
                              : 'bg-warning/10 text-warning',
                          )}
                        >
                          {employee.status}
                        </span>
                      </TableCell>
                      <TableCell className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Edit row"
                            onClick={() =>
                              markEmployeeReady(employee.id)
                            }
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Delete row"
                            onClick={() => deleteEmployee(employee.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === 1}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page === pageCount}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pageCount, current + 1),
                  )
                }
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={
            employees.length === 0 || invalidEmployees.length > 0
          }
          onClick={saveEmployees}
        >
          Save & Continue
        </Button>
      </div>
    </div>
  )
}
