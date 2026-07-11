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
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

interface LeaveType {
  id: string
  name: string
  annualQuota: string
  carryForward: boolean
  status: 'Active' | 'Inactive'
}

const initialLeaveTypes: LeaveType[] = [
  { id: '1', name: 'Casual Leave', annualQuota: '12', carryForward: true, status: 'Active' },
  { id: '2', name: 'Sick Leave', annualQuota: '10', carryForward: false, status: 'Active' },
  { id: '3', name: 'Earned Leave', annualQuota: '18', carryForward: true, status: 'Active' },
  { id: '4', name: 'Maternity Leave', annualQuota: '180', carryForward: false, status: 'Active' },
  { id: '5', name: 'Paternity Leave', annualQuota: '15', carryForward: false, status: 'Active' },
  { id: '6', name: 'Work From Home', annualQuota: 'Unlimited', carryForward: false, status: 'Active' },
  { id: '7', name: 'Compensatory Off', annualQuota: '10', carryForward: true, status: 'Active' },
  { id: '8', name: 'Unpaid Leave', annualQuota: 'Unlimited', carryForward: false, status: 'Active' },
]

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
]

export default function LeaveTypesTab({ isLoading }: { isLoading: boolean }) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(initialLeaveTypes)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [leaveTypeToDelete, setLeaveTypeToDelete] = useState<string | null>(null)
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null)
  const [newLeaveTypeName, setNewLeaveTypeName] = useState('')
  const [newAnnualQuota, setNewAnnualQuota] = useState('')
  const [newCarryForward, setNewCarryForward] = useState(false)
  const [newStatus, setNewStatus] = useState<'Active' | 'Inactive'>('Active')

  const resetLeaveTypeForm = () => {
    setNewLeaveTypeName('')
    setNewAnnualQuota('')
    setNewCarryForward(false)
    setNewStatus('Active')
    setEditingLeaveType(null)
  }

  const handleAddLeaveType = () => {
    if (!newLeaveTypeName || !newAnnualQuota) return
    const newLeaveType: LeaveType = {
      id: String(Date.now()),
      name: newLeaveTypeName,
      annualQuota: newAnnualQuota,
      carryForward: newCarryForward,
      status: newStatus,
    }
    setLeaveTypes([...leaveTypes, newLeaveType])
    resetLeaveTypeForm()
    setIsAddDialogOpen(false)
  }

  const handleEditLeaveType = (leaveType: LeaveType) => {
    setEditingLeaveType(leaveType)
    setNewLeaveTypeName(leaveType.name)
    setNewAnnualQuota(leaveType.annualQuota)
    setNewCarryForward(leaveType.carryForward)
    setNewStatus(leaveType.status)
    setIsAddDialogOpen(true)
  }

  const handleUpdateLeaveType = () => {
    if (!editingLeaveType || !newLeaveTypeName || !newAnnualQuota) return
    setLeaveTypes(leaveTypes.map(lt =>
      lt.id === editingLeaveType.id
        ? { ...lt, name: newLeaveTypeName, annualQuota: newAnnualQuota, carryForward: newCarryForward, status: newStatus }
        : lt
    ))
    resetLeaveTypeForm()
    setIsAddDialogOpen(false)
  }

  const handleDeleteLeaveType = () => {
    if (!leaveTypeToDelete) return
    setLeaveTypes(leaveTypes.filter(lt => lt.id !== leaveTypeToDelete))
    setLeaveTypeToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  const handleToggleStatus = (leaveType: LeaveType) => {
    setLeaveTypes(leaveTypes.map(lt =>
      lt.id === leaveType.id
        ? { ...lt, status: lt.status === 'Active' ? 'Inactive' : 'Active' }
        : lt
    ))
  }

  const leaveTypeColumns: Column<LeaveType>[] = [
    {
      id: 'name',
      header: 'Leave Type',
      render: (value) => (
        <span className="text-sm font-medium text-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'annualQuota',
      header: 'Annual Quota',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'carryForward',
      header: 'Carry Forward',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{value ? 'Yes' : 'No'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <StatusBadge status={row.status} />
      ),
    },
    {
      id: 'actions' as keyof LeaveType,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleEditLeaveType(row)}>Edit Leave Type</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleStatus(row)}>
                {row.status === 'Active' ? 'Disable' : 'Enable'}
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

  const LeaveTypeDialog = () => (
    <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
      setIsAddDialogOpen(open)
      if (!open) resetLeaveTypeForm()
    }}>
      <DialogTrigger asChild>
        <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto">
          <Plus className="size-4" />
          Add Leave Type
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
          <DialogDescription>Configure leave type settings for your organization.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="leaveTypeName">Leave Type Name</Label>
            <Input
              id="leaveTypeName"
              placeholder="Enter leave type name"
              value={newLeaveTypeName}
              onChange={(e) => setNewLeaveTypeName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="annualQuota">Annual Quota</Label>
            <Input
              id="annualQuota"
              placeholder="Enter number of days"
              value={newAnnualQuota}
              onChange={(e) => setNewAnnualQuota(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="carryForward">Carry Forward</Label>
            <Switch
              id="carryForward"
              checked={newCarryForward}
              onChange={(e) => setNewCarryForward(e.target.checked)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={newStatus}
              onChange={(val) => setNewStatus(val as 'Active' | 'Inactive')}
              options={statusOptions}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
            setIsAddDialogOpen(false)
            resetLeaveTypeForm()
          }}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={editingLeaveType ? handleUpdateLeaveType : handleAddLeaveType}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (leaveTypes.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<Calendar className="size-10" />}
            title="No leave types configured"
            description="Get started by adding your first leave type to the organization."
            action={
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="size-4 mr-2" />
                Add Leave Type
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Leave Types</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage all organization leave categories</CardDescription>
        </div>
        <LeaveTypeDialog />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable columns={leaveTypeColumns} data={leaveTypes} density="compact" striped />
        </div>
      </CardContent>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this item? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDeleteLeaveType}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
