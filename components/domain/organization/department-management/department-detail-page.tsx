'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  Building2,
  CalendarDays,
  Folder,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { DEPT_MANAGEMENT_ACCESS_LINK } from '@/lib/gtg-navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { organizationService } from '@/services/organization'
import { HodPickerDialog, ParentPickerDialog } from './department-pickers'
import { EditDepartmentDialog } from './edit-department-dialog'
import { DepartmentCreateWizard } from './department-create-wizard'
import { DepartmentDeleteMergeDialog } from './department-delete-merge-dialog'
import { DepartmentEmployeesPanel } from './department-employees-panel'
import { DepartmentJobRolesPanel } from './department-job-roles-panel'
import { ProcessTab } from './process-tab'
import { SignalsHub } from './signals-hub'
import { DepartmentDocumentsTab } from '@/domain/documents/department-documents-tab'

/**
 * The full-page department detail view - what used to be a side drawer
 * (department-details-panel.tsx, now retired) is now a real,
 * bookmarkable page at /organization/departments/[id], modeled on
 * project-command-bar.tsx + project-detail-view.tsx: an identity/actions
 * band, one inline "vitals" row instead of stacked fact rows, and
 * hand-rolled top tabs instead of the plain shared `Tabs` underline.
 *
 * Unlike the old drawer (which only triggered dialogs a parent owned), this
 * component owns Edit / Add Sub-department / Assign HOD / Change Parent /
 * Delete itself - it has no parent screen to delegate them to anymore.
 * `onSaved` tells the page to re-fetch (so the vitals/header reflect a
 * change); `onRemoved` fires after a delete or merge, since the department
 * this page is showing no longer exists.
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

function formatDate(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employees' },
  { id: 'jobroles', label: 'Job Roles' },
  { id: 'process', label: 'Process' },
  { id: 'signals', label: 'Signals' },
  { id: 'documents', label: 'Documents' },
]

function Vital({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </span>
  )
}

/** One labeled fact in the Overview tab's full details grid. */
function DetailField({
  icon: Icon,
  label,
  value,
  action,
  onAction,
}: {
  icon: React.ElementType
  label: string
  value: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-0.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {action}
          </button>
        )}
      </div>
    </div>
  )
}

export function DepartmentDetailPage({
  department,
  departments,
  canManage,
  context,
  onSaved,
  onRemoved,
}: {
  department: Department
  /** Every department in the tenant, for the parent picker and the employees "transfer from" selector. */
  departments: Department[]
  canManage: boolean
  context: LaravelContext
  /** A field changed (HOD, parent, edit, description) - re-fetch so the header reflects it. */
  onSaved: () => void
  /** The department was deleted or merged away - it no longer exists. */
  onRemoved: () => void
}) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddSubOpen, setIsAddSubOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isHodOpen, setIsHodOpen] = useState(false)
  const [isParentOpen, setIsParentOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [descriptionError, setDescriptionError] = useState('')

  useEffect(() => {
    setIsEditingDescription(false)
    setDescriptionDraft(department.description ?? '')
    setDescriptionError('')
  }, [department.id, department.description])

  async function saveDescription() {
    setIsSavingDescription(true)
    setDescriptionError('')
    try {
      await organizationService.updateDepartment(context, department.id, { description: descriptionDraft.trim() })
      setIsEditingDescription(false)
      onSaved()
    } catch (cause) {
      setDescriptionError(cause instanceof Error ? cause.message : 'Failed to save description.')
    } finally {
      setIsSavingDescription(false)
    }
  }

  async function handleAssignHod(employeeId: string | null) {
    setIsSaving(true)
    try {
      await organizationService.setDepartmentHead(context, department.id, employeeId)
      setIsHodOpen(false)
      onSaved()
      setNotice(employeeId ? 'Head of department updated.' : 'Head of department cleared.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Failed to update department head.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChangeParent(parentId: string) {
    setIsSaving(true)
    try {
      await organizationService.setDepartmentParent(context, department.id, parentId)
      setIsParentOpen(false)
      onSaved()
      setNotice('Parent department updated.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Failed to change parent department.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    setIsSaving(true)
    try {
      await organizationService.deleteDepartment(context, department.id)
      onRemoved()
    } catch (cause) {
      setIsDeleteOpen(false)
      setNotice(cause instanceof Error ? cause.message : 'Failed to remove department.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmMerge(targetDepartmentId: string) {
    setIsSaving(true)
    try {
      await organizationService.mergeDepartment(context, department.id, targetDepartmentId)
      onRemoved()
    } catch (cause) {
      setIsDeleteOpen(false)
      setNotice(cause instanceof Error ? cause.message : 'Failed to merge department.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* identity + actions */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              {department.name}
              <StatusBadge status={department.status} size="sm" />
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {departmentCode(department)} <span className="mx-1">·</span>{' '}
              {department.parent ?? 'Top-level department'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canManage && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions <MoreVertical className="ml-1.5 size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit {department.parent ? 'Sub-Department' : 'Department'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddSubOpen(true)}>
                  <Plus className="size-3.5" />
                  Add Sub Department
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsHodOpen(true)}>
                  <UserPlus className="size-3.5" />
                  {department.hod ? 'Change HOD' : 'Assign HOD'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsParentOpen(true)}>
                  <Folder className="size-3.5" />
                  Change Parent
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  Remove {department.parent ? 'Sub-Department' : 'Department'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(resolveAccessLink(DEPT_MANAGEMENT_ACCESS_LINK))}
          >
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
            Back to Departments
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      {/* vitals: one inline row of figures, not stacked fact rows */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
        <Vital icon={Users} label="Head">{department.hod ?? 'Unassigned'}</Vital>
        <Vital icon={Folder} label="Parent">{department.parent ?? 'Top-level'}</Vital>
        <Vital icon={Users} label="Employees">{department.employees}</Vital>
        <Vital icon={CalendarDays} label="Created">{formatDate(department.created)}</Vital>
        <Vital icon={RefreshCw} label="Updated">{formatDate(department.updated)}</Vital>
      </div>

      {/* tabs */}
      <div role="tablist" className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative -mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.id === 'employees' && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {department.employees}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {activeTab === 'overview' && (
          <>
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">Department Details</h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField
                    icon={UserPlus}
                    label="Department Head"
                    value={department.hod ?? 'Unassigned'}
                    action={canManage ? (department.hod ? 'Change HOD' : 'Assign HOD') : undefined}
                    onAction={canManage ? () => setIsHodOpen(true) : undefined}
                  />
                  <DetailField
                    icon={Folder}
                    label="Parent Department"
                    value={department.parent ?? 'Top-level department'}
                    action={canManage ? 'Change Parent' : undefined}
                    onAction={canManage ? () => setIsParentOpen(true) : undefined}
                  />
                  <DetailField icon={Building2} label="Department Code" value={departmentCode(department)} />
                  <DetailField icon={Activity} label="Status" value={department.status} />
                  <DetailField icon={Users} label="Total Employees" value={String(department.employees)} />
                  <DetailField icon={CalendarDays} label="Created On" value={formatDate(department.created)} />
                  <DetailField icon={RefreshCw} label="Last Updated" value={formatDate(department.updated)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Description</h2>
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
                <div className="space-y-2">
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
                <p className="text-sm leading-6 text-muted-foreground">
                  {department.description || 'No description has been added for this department yet.'}
                </p>
              )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'employees' && (
          <DepartmentEmployeesPanel
            department={department}
            departments={departments}
            context={context}
            canManage={canManage}
            onChanged={onSaved}
          />
        )}

        {activeTab === 'jobroles' && (
          <DepartmentJobRolesPanel department={department} context={context} canManage={canManage} />
        )}

        {activeTab === 'process' && <ProcessTab department={department} context={context} canManage={canManage} />}

        {activeTab === 'signals' && (
          <SignalsHub key={department.id} department={department} context={context} canManage={canManage} />
        )}

        {activeTab === 'documents' && (
          <DepartmentDocumentsTab department={department} context={context} canManage={canManage} />
        )}
      </div>

      <EditDepartmentDialog
        department={isEditOpen ? department : null}
        departments={departments}
        context={context}
        onCancel={() => setIsEditOpen(false)}
        onSaved={(message) => {
          setIsEditOpen(false)
          onSaved()
          setNotice(message)
        }}
      />

      <DepartmentCreateWizard
        open={isAddSubOpen}
        context={context}
        departments={departments}
        initialParent={department}
        onCancel={() => {
          setIsAddSubOpen(false)
          onSaved()
        }}
        onCreated={onSaved}
        onFinished={() => {
          setIsAddSubOpen(false)
          onSaved()
          setNotice('Department created and activated.')
        }}
      />

      <HodPickerDialog
        department={isHodOpen ? department : null}
        context={context}
        isSaving={isSaving}
        onCancel={() => setIsHodOpen(false)}
        onSelect={(employeeId) => void handleAssignHod(employeeId)}
      />

      <ParentPickerDialog
        department={isParentOpen ? department : null}
        departments={departments}
        isSaving={isSaving}
        onCancel={() => setIsParentOpen(false)}
        onSelect={(parentId) => void handleChangeParent(parentId)}
      />

      <DepartmentDeleteMergeDialog
        department={isDeleteOpen ? department : null}
        departments={departments}
        context={context}
        isSaving={isSaving}
        onCancel={() => setIsDeleteOpen(false)}
        onDelete={() => void confirmDelete()}
        onMerge={(targetId) => void confirmMerge(targetId)}
      />
    </div>
  )
}
