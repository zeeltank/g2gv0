'use client'

import { Button } from '@/components/ui/button'
import { Save, Download, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AttendanceReportHeaderProps {
  title?: string
  description?: string
  onSave?: () => void
  onExport?: () => void
  onPrint?: () => void
  className?: string
}

export function AttendanceReportHeader({
  title = 'Attendance Report',
  description = 'View and analyze attendance data with detailed reports.',
  onSave,
  onExport,
  onPrint,
  className,
}: AttendanceReportHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSave} className="gap-1.5">
          <Save className="size-4" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="size-4" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
          <Printer className="size-4" />
          Print
        </Button>
      </div>
    </div>
  )
}
