'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Building2,
  CalendarDays,
  Folder,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Department } from '@/lib/gtg-org-data'
import { ORG_PROFILE } from '@/lib/gtg-org-data'
  import { Tabs } from '../components'
  import { SopsTab, MOCK_SOPS, type Sop } from './sops-tab'
  import { PoliciesTab } from './policies-tab'
  import { RulesTab } from './rules-tab'

function departmentCode(department: Department) {
  const explicit: Record<string, string> = {
    'Executive Office': 'EXO',
    'Human Resources': 'HR',
    'Talent Acquisition': 'HR-TA',
    Engineering: 'ENG',
    'Platform Engineering': 'ENG-PLT',
    'Quality Assurance': 'ENG-QA',
    'Product Management': 'PRD',
    'Sales & Marketing': 'SM',
    'Customer Success': 'CS',
    'Finance & Accounts': 'FIN',
    'Legal & Compliance': 'LGL',
    'Information Security': 'SEC',
  }

  if (explicit[department.name]) return explicit[department.name]

  return department.name
    .split(/\s|&/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sops', label: 'SOPs' },
  { id: 'policies', label: 'Policies' },
  { id: 'rules', label: 'Rules' },
]

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
    </button>
  )
}

function DepartmentHeader({ department }: { department: Department }) {
  return (
    <div className="flex items-start gap-4 border-b border-border p-4">
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
  )
}

export function DepartmentDetailsPanel({
  department,
  canManage,
  onClose,
  onEdit,
  onAddSubDepartment,
  onDelete,
}: {
  department: Department
  canManage: boolean
  onClose?: () => void
  onEdit?: (department: Department) => void
  onAddSubDepartment?: (department: Department) => void
  onDelete?: (department: Department) => void
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [sops, setSops] = useState<Sop[]>(MOCK_SOPS)

  const handleAddSop = (sop: Sop) => {
    setSops((current) => [sop, ...current])
  }

  const handleUpdateSop = (updated: Sop) => {
    setSops((current) => current.map((sop) => (sop.id === updated.id ? updated : sop)))
  }

  const handleDeleteSop = (id: string) => {
    setSops((current) => current.filter((sop) => sop.id !== id))
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Department Details</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
          <span className="sr-only">Close details</span>
        </Button>
      </div>
      <DepartmentHeader department={department} />

      <Tabs tabs={DETAIL_TABS} active={activeTab} onChange={setActiveTab} />


      <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'overview' && (
          <div className="p-4">
            {canManage && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-9 justify-center text-primary"
                  onClick={() => onEdit?.(department)}
                >
                  <Pencil className="size-4" />
                  Edit {department.parent ? 'Sub Department' : 'Department'}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 justify-center text-primary"
                  onClick={() => onAddSubDepartment?.(department)}
                >
                  <Plus className="size-4" />
                  Add Sub Department
                </Button>
                <Button
                  variant="outline"
                  className="col-span-2 h-9 justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete?.(department)}
                >
                  <Trash2 className="size-4" />
                  Remove {department.parent ? 'Sub Department' : 'Department'}
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
        )}

        {activeTab === 'sops' && (
          <SopsTab
            department={department}
            sops={sops}
            onAddSop={handleAddSop}
            onUpdateSop={handleUpdateSop}
            onDeleteSop={handleDeleteSop}
          />
        )}

        {activeTab === 'policies' && <PoliciesTab department={department} />}

        {activeTab === 'rules' && <RulesTab department={department} />}
      </div>
    </aside>
  )
}
