'use client'

import type { ReactNode } from 'react'
import {
  Building2,
  CalendarDays,
  FileText,
  Folder,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './gtg-ui'
import { departmentCode, formatDate } from './department-utils'
import type { Department } from '@/lib/gtg-org-data'
import { ORG_PROFILE } from '@/lib/gtg-org-data'

export function DepartmentDetails({
  department,
  canManage,
}: {
  department: Department
  canManage: boolean
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Department Details</h2>
        <Button variant="ghost" size="icon-sm">
          <X className="size-4" />
          <span className="sr-only">Close details</span>
        </Button>
      </div>

      <div className="g2g-scrollbar flex-1 overflow-auto p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Building2 className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold leading-tight text-foreground">
                {department.name}
              </h3>
              <StatusBadge status={department.status} size="sm" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {departmentCode(department)} <span className="mx-1">-</span>{' '}
              {department.parent ?? ORG_PROFILE.name}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-9 justify-center text-primary">
              <Pencil className="size-4" />
              Edit Department
            </Button>
            <Button variant="outline" className="h-9 justify-center text-primary">
              <Plus className="size-4" />
              Add Sub Department
            </Button>
            <Button variant="outline" className="col-span-2 h-9 justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4" />
              Remove Department
            </Button>
          </div>
        )}

        <div className="my-5 h-px bg-border" />

        <div className="space-y-5">
          <DetailItem
            icon={<Users className="size-4" />}
            label="Department Head"
            value={department.hod ?? 'Unassigned'}
            action="Change HOD"
          />
          <DetailItem
            icon={<Folder className="size-4" />}
            label="Parent Department"
            value={department.parent ?? ORG_PROFILE.name}
            action="Change Parent"
          />
          <DetailItem
            icon={<Users className="size-4" />}
            label="Total Employees"
            value={String(department.employees)}
          />
          <DetailItem
            icon={<FileText className="size-4" />}
            label="Open Positions"
            value={String(Math.max(2, Math.round(department.employees / 12)))}
          />
          <DetailItem
            icon={<CalendarDays className="size-4" />}
            label="Created On"
            value={formatDate(department.created)}
          />
          <DetailItem
            icon={<RefreshCw className="size-4" />}
            label="Last Updated"
            value="30 May 2025"
          />
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-foreground">Description</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Handles {department.name.toLowerCase()} functions including planning,
            operations, governance, and team support across {ORG_PROFILE.name}.
          </p>
        </div>
      </div>
    </aside>
  )
}

function DetailItem({
  icon,
  label,
  value,
  action,
}: {
  icon: ReactNode
  label: string
  value: string
  action?: string
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] gap-3">
      <div className="pt-1 text-foreground">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      </div>
      {action && (
        <button type="button" className="pt-7 text-xs font-semibold text-primary">
          {action}
        </button>
      )}
    </div>
  )
}