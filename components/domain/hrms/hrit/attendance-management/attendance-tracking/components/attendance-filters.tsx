'use client'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface AttendanceFiltersProps {
  dateRange: { from: string; to: string }
  department: string
  employee: string
  departments: { value: string; label: string }[]
  employees: { value: string; label: string }[]
  onDateRangeChange: (range: { from: string; to: string }) => void
  onDepartmentChange: (value: string) => void
  onEmployeeChange: (value: string) => void
  onSavedReportChange: (value: string) => void
  onExport: () => void
  onPrint: () => void
  onSearch: () => void
  savedReports: { value: string; label: string }[]
  showEmployee?: boolean
}

export function AttendanceFilters({
  dateRange,
  department,
  employee,
  departments,
  employees,
  onDateRangeChange,
  onDepartmentChange,
  onEmployeeChange,
  onSavedReportChange,
  onExport,
  onPrint,
  onSearch,
  savedReports,
  showEmployee = true,
}: AttendanceFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Date Range</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Department</label>
          <Select
            value={department}
            onChange={onDepartmentChange}
            className="w-40"
            options={[
              { label: 'All', value: '' },
              ...departments.map((d) => ({ label: d.label, value: d.value })),
            ]}
          />
        </div>

        {showEmployee && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Employee</label>
            <Select
              value={employee}
              onChange={onEmployeeChange}
              className="w-48"
              options={[
                { label: 'All', value: '' },
                ...employees.map((e) => ({ label: e.label, value: e.value })),
              ]}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Saved Reports</label>
          <Select
            value=""
            onChange={onSavedReportChange}
            className="w-40"
            options={savedReports.map((r) => ({ label: r.label, value: r.value }))}
          />
        </div>

        <div className="flex items-end gap-2">
        
          <Button variant="outline" size="sm" onClick={onExport}>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            Print
          </Button>
        </div>
      </div>
    </div>
  )
}