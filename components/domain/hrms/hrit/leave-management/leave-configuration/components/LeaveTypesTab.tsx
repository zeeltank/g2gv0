'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useLeaveOptions, useLeaveTypes } from '@/hooks/use-leave'
import type { LeaveTypeConfig } from '@/services/hrms'

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
]

interface LeaveTypeFormState {
  name: string
  annualQuota: string
  departmentId: string
  carryForward: boolean
  status: 'Active' | 'Inactive'
}

const emptyForm: LeaveTypeFormState = {
  name: '',
  annualQuota: '',
  departmentId: '',
  carryForward: false,
  status: 'Active',
}

/**
 * The annual quota lives in hrms_leave_allocation (per department, per leave
 * year), so it can legitimately differ between departments - the API flags that
 * with annual_quota_varies and returns the per-department breakdown.
 */
function quotaLabel(leaveType: LeaveTypeConfig) {
  if (leaveType.annual_quota_varies) return 'Varies by department'
  if (leaveType.annual_quota === null) return 'Not allocated'
  return String(leaveType.annual_quota)
}

export default function LeaveTypesTab({ isLoading }: { isLoading: boolean }) {
  const {
    loading,
    processing,
    error,
    actionMessage,
    leaveTypes,
    retry,
    clearMessages,
    save,
    toggleStatus,
    remove,
  } = useLeaveTypes()
  const { options } = useLeaveOptions()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [leaveTypeToDelete, setLeaveTypeToDelete] = useState<number | null>(null)
  const [editing, setEditing] = useState<LeaveTypeConfig | null>(null)
  const [form, setForm] = useState<LeaveTypeFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const closeDialog = () => {
    setIsDialogOpen(false)
    setForm(emptyForm)
    setEditing(null)
    setFormError(null)
  }

  const departmentOptions = [
    { label: 'All departments', value: '' },
    ...(options?.departments ?? []).map((department) => ({
      label: department.label,
      value: department.value,
    })),
  ]

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (leaveType: LeaveTypeConfig) => {
    setEditing(leaveType)
    setForm({
      name: leaveType.leave_type,
      annualQuota: leaveType.annual_quota === null ? '' : String(leaveType.annual_quota),
      departmentId: '',
      carryForward: leaveType.carry_forward,
      status: leaveType.status === 1 ? 'Active' : 'Inactive',
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Leave type name is required')
      return
    }

    if (form.annualQuota.trim() && !Number.isFinite(Number(form.annualQuota))) {
      setFormError('Annual quota must be a number of days')
      return
    }

    const result = await save({
      id: editing?.id,
      leaveType: form.name.trim(),
      sortOrder: editing?.sort_order ?? leaveTypes.length + 1,
      status: form.status === 'Active',
      carryForward: form.carryForward,
      annualQuota: form.annualQuota.trim() || null,
      departmentId: form.departmentId || undefined,
    })

    if (result.ok) {
      closeDialog()
    } else {
      setFormError(result.message)
    }
  }

  const handleDelete = async () => {
    if (!leaveTypeToDelete) return
    await remove(leaveTypeToDelete)
    setLeaveTypeToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  const columns: Column<LeaveTypeConfig>[] = [
    {
      id: 'leave_type',
      header: 'Leave Type',
      render: (value) => <span className="text-sm font-medium text-foreground">{String(value)}</span>,
    },
    {
      id: 'annual_quota',
      header: 'Annual Quota',
      render: (_, row) => <span className="text-sm text-muted-foreground">{quotaLabel(row)}</span>,
    },
    {
      id: 'carry_forward',
      header: 'Carry Forward',
      render: (value) => <span className="text-sm text-muted-foreground">{value ? 'Yes' : 'No'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status === 1 ? 'Active' : 'Inactive'} />,
    },
    {
      id: 'actions' as keyof LeaveTypeConfig,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={processing}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => openEdit(row)}>Edit Leave Type</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleStatus(row.id, row.status !== 1)}>
                {row.status === 1 ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setLeaveTypeToDelete(row.id)
                  setIsDeleteDialogOpen(true)
                }}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const leaveTypeDialog = (
    <Dialog open={isDialogOpen} onOpenChange={(next) => (next ? setIsDialogOpen(true) : closeDialog())}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
          <DialogDescription>Configure leave type settings for your organization.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="leaveTypeName" required>Leave Type Name</Label>
            <Input
              id="leaveTypeName"
              placeholder="Enter leave type name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="annualQuota">Annual Quota</Label>
            <Input
              id="annualQuota"
              placeholder="Enter number of days"
              value={form.annualQuota}
              onChange={(event) => setForm((prev) => ({ ...prev, annualQuota: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Saved as this leave year&apos;s allocation. Leave blank to keep the existing allocation.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quotaDepartment">Apply Quota To</Label>
            <Select
              value={form.departmentId}
              onChange={(value) => setForm((prev) => ({ ...prev, departmentId: value }))}
              options={departmentOptions}
              placeholder="All departments"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="carryForward">Carry Forward</Label>
            <Switch
              id="carryForward"
              checked={form.carryForward}
              onChange={(event) => setForm((prev) => ({ ...prev, carryForward: event.target.checked }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value as 'Active' | 'Inactive' }))}
              options={statusOptions}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={closeDialog}>
            Cancel
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={processing}>
            {processing ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (isLoading || loading) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error && leaveTypes.length === 0) {
    return <ErrorState title="Unable to load leave types" description={error} retry={retry} />
  }

  if (leaveTypes.length === 0) {
    return (
      <>
        <Card>
          <CardContent>
            <EmptyState
              icon={<Calendar className="size-10" />}
              title="No leave types configured"
              description="Get started by adding your first leave type to the organization."
              action={
                <Button onClick={openCreate}>
                  <Plus className="size-4 mr-2" />
                  Add Leave Type
                </Button>
              }
            />
          </CardContent>
        </Card>
        {leaveTypeDialog}
      </>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Leave Types</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage all organization leave categories</CardDescription>
        </div>
        <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto" onClick={openCreate}>
          <Plus className="size-4" />
          Add Leave Type
        </Button>
      </CardHeader>

      {(actionMessage || error) && (
        <CardContent className="pt-0">
          <Alert variant={error ? 'destructive' : undefined}>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error ?? actionMessage}</span>
              <Button variant="ghost" size="sm" onClick={clearMessages}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={leaveTypes} density="compact" striped />
        </div>
      </CardContent>

      {leaveTypeDialog}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? Leave types already used by a request cannot be
              deleted - disable them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDelete} disabled={processing}>
              {processing ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
