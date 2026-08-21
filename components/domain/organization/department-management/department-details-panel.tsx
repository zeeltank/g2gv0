'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import type { Department } from '@/lib/gtg-org-data'
import { ORG_PROFILE } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import { Tabs } from '../components'
import { DepartmentEmployeesPanel } from './department-employees-panel'
import { DepartmentJobRolesPanel } from './department-job-roles-panel'
import { SopsTab } from './sops-tab'
import { PoliciesTab } from './policies-tab'
import { RulesTab } from './rules-tab'

/**
 * Display code for a department.
 *
 * This was the second of three copies of a hardcoded twelve-entry name-to-code
 * lookup table. `code` is a real column now, so the table is gone and only the
 * initials fallback remains, for a department whose code is genuinely blank.
 */
function departmentCode(department: Department) {
  if (department.code) return department.code

  return department.name
    .split(/\s|&/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

/** Renders '-' rather than "Invalid Date" for a missing or unparseable value. */
function formatDate(value?: string | null) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * `action` was typed as `string` and rendered into a <button> that took no
 * onClick - so "Change HOD" and "Change Parent" looked like links, highlighted
 * on hover, and did nothing at all. It now carries its handler with it.
 */
function DetailItem({
  icon,
  label,
  value,
  action,
  onAction,
}: {
  icon: ReactNode
  label: string
  value: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] gap-3">
      <div className="pt-1 text-foreground">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      </div>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="pt-7 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {action}
        </button>
      )}
    </div>
  )
}

/*
 * Employees and Job Roles are tabs, not sections buried in Overview.
 *
 * Employee management existed but was reachable only by scrolling past the
 * Overview details, which is why "remove employee" and "change HOD" read as
 * missing. Job Roles is new - it is the middle link of
 * department -> job role -> employee, and Department Management had no view of
 * it at all.
 */
const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employees' },
  { id: 'jobroles', label: 'Job Roles' },
  { id: 'sops', label: 'SOPs' },
  { id: 'policies', label: 'Policies' },
  { id: 'rules', label: 'Rules' },
]


function DepartmentHeader({ department }: { department: Department }) {
  return (
    // pr-12 keeps the status badge clear of the drawer's close button, which
    // SheetContent positions absolutely at right-4 top-4.
    <div className="flex items-start gap-4 border-b border-border p-4 pr-12">
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
  departments,
  canManage,
  context,
  onEdit,
  onAddSubDepartment,
  onDelete,
  onAssignHod,
  onChangeParent,
  onSaved,
}: {
  department: Department
  /** Every department in the tenant, for the "transfer from" selector. */
  departments: Department[]
  canManage: boolean
  context: LaravelContext
  onEdit?: (department: Department) => void
  onAddSubDepartment?: (department: Department) => void
  onDelete?: (department: Department) => void
  onAssignHod?: (department: Department) => void
  onChangeParent?: (department: Department) => void
  /** Called after an inline save, so the list reloads with the new value. */
  onSaved?: () => void
}) {
  const [activeTab, setActiveTab] = useState('overview')

  /*
   * `sops` used to be seeded here with MOCK_SOPS and held in this component's
   * state, which is why every SOP edit vanished the moment the panel closed and
   * why every department showed the same five records. SopsTab now owns its own
   * data and loads it from the API for the department it is given.
   */

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState('')

  // Reset the inline editor when the panel switches department, otherwise a
  // draft typed for one department would appear under the next one.
  useEffect(() => {
    setIsEditingDescription(false)
    setDescriptionDraft(department.description ?? '')
    setDescriptionError('')
  }, [department.id, department.description])

  async function saveDescription() {
    setIsSavingDescription(true)
    setDescriptionError('')
    try {
      await organizationService.updateDepartment(context, department.id, {
        description: descriptionDraft.trim(),
      })
      setIsEditingDescription(false)
      onSaved?.()
    } catch (error) {
      setDescriptionError(error instanceof Error ? error.message : 'Failed to save description.')
    } finally {
      setIsSavingDescription(false)
    }
  }

  /*
   * Rendered inside a Sheet, so no card chrome of its own.
   *
   * The rounded border, shadow and background belonged to a panel sitting in
   * the page grid. Inside a drawer they draw a second card edge just inside
   * the drawer's own, and the drawer already supplies a close button - the
   * "Department Details" title row here duplicated it.
   */
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
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
                action={canManage ? (department.hod ? 'Change HOD' : 'Assign HOD') : undefined}
                onAction={canManage ? () => onAssignHod?.(department) : undefined}
              />
              <DetailItem
                icon={<Folder className="size-4" />}
                label="Parent Department"
                value={department.parent ?? ORG_PROFILE.name}
                action={canManage ? 'Change Parent' : undefined}
                onAction={canManage ? () => onChangeParent?.(department) : undefined}
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
                // Was the literal string "30 May 2025" - the same date on every
                // department, in every tenant, for all time.
                value={formatDate(department.updated)}
              />
            </div>

            {/*
              * Employees moved out of Overview into their own tab. Sitting
              * here, below the detail rows, is why "remove employee" and
              * "change HOD" read as missing - they were present but had to be
              * scrolled to.
              */}

            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">Description</h4>
                {canManage && !isEditingDescription && (
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(department.description ?? '')
                      setIsEditingDescription(true)
                    }}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {department.description ? 'Edit' : 'Add description'}
                  </button>
                )}
              </div>

              {isEditingDescription ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    rows={4}
                    disabled={isSavingDescription}
                    placeholder="What this department is responsible for"
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {descriptionError && <p className="text-xs text-destructive">{descriptionError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSavingDescription}
                      onClick={() => {
                        setIsEditingDescription(false)
                        setDescriptionError('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" disabled={isSavingDescription} onClick={() => void saveDescription()}>
                      {isSavingDescription ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                /*
                 * Was a generated sentence: "Handles {name} functions including
                 * planning, operations, governance, and team support across
                 * {org}." It read as a real description while being assembled
                 * from the department's own name, so every department had one
                 * and none of them said anything.
                 */
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {department.description || 'No description has been added for this department yet.'}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="p-4">
            <DepartmentEmployeesPanel
              department={department}
              departments={departments}
              context={context}
              canManage={canManage}
              onChanged={onSaved}
            />
          </div>
        )}

        {activeTab === 'jobroles' && (
          <DepartmentJobRolesPanel
            department={department}
            context={context}
            canManage={canManage}
          />
        )}

        {activeTab === 'sops' && (
          <SopsTab department={department} context={context} canManage={canManage} />
        )}

        {activeTab === 'policies' && (
          <PoliciesTab department={department} context={context} canManage={canManage} />
        )}

        {activeTab === 'rules' && (
          <RulesTab department={department} context={context} canManage={canManage} />
        )}
      </div>
    </aside>
  )
}
