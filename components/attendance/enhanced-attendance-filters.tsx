'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ArrowDownUp, RotateCcw, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EnhancedAttendanceFiltersProps {
  dateRange: { from: string; to: string }
  groupBy: string
  department: string
  employee: string
  quickFilter: string
  departments: { value: string; label: string }[]
  employees: { value: string; label: string }[]
  savedReports: { value: string; label: string }[]
  onDateRangeChange: (range: { from: string; to: string }) => void
  onGroupByChange: (value: string) => void
  onDepartmentChange: (value: string) => void
  onEmployeeChange: (value: string) => void
  onQuickFilterChange: (value: string) => void
  onSavedReportChange: (value: string) => void
  onReset: () => void
  onSearch?: () => void
  className?: string
}

export function EnhancedAttendanceFilters({
  dateRange,
  groupBy,
  department,
  employee,
  quickFilter,
  departments,
  employees,
  savedReports,
  onDateRangeChange,
  onGroupByChange,
  onDepartmentChange,
  onEmployeeChange,
  onQuickFilterChange,
  onSavedReportChange,
  onReset,
  onSearch,
  className,
}: EnhancedAttendanceFiltersProps) {
  const handleReset = () => {
    onReset()
    onGroupByChange('organization')
    onQuickFilterChange('custom')
  }

  return (
    <div className={cn('flex flex-col gap-4 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Date Range</label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
                className="h-8 rounded-lg border border-input bg-background px-2.5 pr-8 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {/* <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /> */}
            </div>
            <span className="text-xs text-muted-foreground">to</span>
            <div className="relative">
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
                className="h-8 rounded-lg border border-input bg-background px-2.5 pr-8 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {/* <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /> */}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Group By</label>
          <Select
            value={groupBy}
            onChange={onGroupByChange}
            className="w-40"
            options={[
              { label: 'Organization', value: 'organization' },
              { label: 'Department', value: 'department' },
              { label: 'Employee', value: 'employee' },
              { label: 'Date', value: 'date' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Department</label>
          <Select
            value={department}
            onChange={onDepartmentChange}
            className="w-40"
            options={[
              { label: 'All Departments', value: 'all' },
              ...departments.map((d) => ({ label: d.label, value: d.value })),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Employee</label>
          <Select
            value={employee}
            onChange={onEmployeeChange}
            className="w-56"
            options={[
              { label: 'All Employees', value: 'all' },
              ...employees.map((e) => ({ label: e.label, value: e.value })),
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Quick Filters</label>
          <div className="flex items-center gap-2">
            {[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'custom', label: 'Custom' },
            ].map((qf) => (
              <button
                key={qf.value}
                type="button"
                onClick={() => onQuickFilterChange(qf.value)}
                className={cn(
                  'h-7 rounded-md px-3 text-xs font-medium transition-colors cursor-pointer',
                  quickFilter === qf.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {qf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onSearch} className="gap-1.5">
            <ArrowDownUp className="size-3.5" />
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="size-3.5" />
            Reset Filter
          </Button>
        </div>
      </div>
    </div>
  )
}
