'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'

interface Role {
  id: string
  name: string
  scope: string
  permissions: {
    approveLeave: boolean
    viewReports: boolean
    configureSettings: boolean
    bulkOperations: boolean
    escalationRights: boolean
    userManagement: boolean
  }
  status: 'Active' | 'Inactive'
}

const initialRoles: Role[] = [
  { id: '1', name: 'Employee', scope: 'Self', permissions: { approveLeave: false, viewReports: true, configureSettings: false, bulkOperations: false, escalationRights: false, userManagement: false }, status: 'Active' },
  { id: '2', name: 'Reporting Manager', scope: 'Team', permissions: { approveLeave: true, viewReports: true, configureSettings: false, bulkOperations: false, escalationRights: false, userManagement: false }, status: 'Active' },
  { id: '3', name: 'Department Head', scope: 'Department', permissions: { approveLeave: true, viewReports: true, configureSettings: true, bulkOperations: false, escalationRights: false, userManagement: false }, status: 'Active' },
  { id: '4', name: 'HR Executive', scope: 'Department', permissions: { approveLeave: true, viewReports: true, configureSettings: true, bulkOperations: false, escalationRights: false, userManagement: false }, status: 'Active' },
  { id: '5', name: 'HR Manager', scope: 'Organization', permissions: { approveLeave: true, viewReports: true, configureSettings: true, bulkOperations: true, escalationRights: true, userManagement: true }, status: 'Active' },
  { id: '6', name: 'Administrator', scope: 'Organization', permissions: { approveLeave: true, viewReports: true, configureSettings: true, bulkOperations: true, escalationRights: true, userManagement: true }, status: 'Active' },
  { id: '7', name: 'Executive', scope: 'Organization', permissions: { approveLeave: true, viewReports: true, configureSettings: true, bulkOperations: true, escalationRights: true, userManagement: false }, status: 'Active' },
]

const scopeOptions = [
  { label: 'Self', value: 'Self' },
  { label: 'Team', value: 'Team' },
  { label: 'Department', value: 'Department' },
  { label: 'Organization', value: 'Organization' },
]

export default function RolesAccessTab({ isLoading }: { isLoading: boolean }) {
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleScope, setRoleScope] = useState('Self')
  const [roleStatus, setRoleStatus] = useState<'Active' | 'Inactive'>('Active')
  const [permApproveLeave, setPermApproveLeave] = useState(false)
  const [permViewReports, setPermViewReports] = useState(false)
  const [permConfigureSettings, setPermConfigureSettings] = useState(false)
  const [permBulkOperations, setPermBulkOperations] = useState(false)
  const [permEscalationRights, setPermEscalationRights] = useState(false)
  const [permUserManagement, setPermUserManagement] = useState(false)

  const resetRoleForm = () => {
    setRoleScope('Self')
    setRoleStatus('Active')
    setPermApproveLeave(false)
    setPermViewReports(false)
    setPermConfigureSettings(false)
    setPermBulkOperations(false)
    setPermEscalationRights(false)
    setPermUserManagement(false)
    setEditingRole(null)
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setRoleScope(role.scope)
    setRoleStatus(role.status)
    setPermApproveLeave(role.permissions.approveLeave)
    setPermViewReports(role.permissions.viewReports)
    setPermConfigureSettings(role.permissions.configureSettings)
    setPermBulkOperations(role.permissions.bulkOperations)
    setPermEscalationRights(role.permissions.escalationRights)
    setPermUserManagement(role.permissions.userManagement)
    setIsRoleDialogOpen(true)
  }

  const handleUpdateRole = () => {
    if (!editingRole) return
    setRoles(roles.map(r =>
      r.id === editingRole.id
        ? { ...r, scope: roleScope, status: roleStatus, permissions: { approveLeave: permApproveLeave, viewReports: permViewReports, configureSettings: permConfigureSettings, bulkOperations: permBulkOperations, escalationRights: permEscalationRights, userManagement: permUserManagement } }
        : r
    ))
    resetRoleForm()
    setIsRoleDialogOpen(false)
  }

  const handleToggleRoleStatus = (role: Role) => {
    setRoles(roles.map(r =>
      r.id === role.id
        ? { ...r, status: r.status === 'Active' ? 'Inactive' : 'Active' }
        : r
    ))
  }

  const handleResetRolePermissions = (role: Role) => {
    const defaultPerms: typeof initialRoles[0]['permissions'] = {
      approveLeave: false, viewReports: true, configureSettings: false, bulkOperations: false, escalationRights: false, userManagement: false
    }
    if (role.name === 'Reporting Manager') {
      defaultPerms.approveLeave = true
      defaultPerms.viewReports = true
    } else if (role.name === 'Department Head' || role.name === 'HR Executive') {
      defaultPerms.approveLeave = true
      defaultPerms.viewReports = true
      defaultPerms.configureSettings = true
    } else if (role.name === 'HR Manager' || role.name === 'Administrator') {
      defaultPerms.approveLeave = true
      defaultPerms.viewReports = true
      defaultPerms.configureSettings = true
      defaultPerms.bulkOperations = true
      defaultPerms.escalationRights = true
      defaultPerms.userManagement = true
    } else if (role.name === 'Executive') {
      defaultPerms.approveLeave = true
      defaultPerms.viewReports = true
      defaultPerms.configureSettings = true
      defaultPerms.bulkOperations = true
      defaultPerms.escalationRights = true
    }
    setRoles(roles.map(r => r.id === role.id ? { ...r, permissions: defaultPerms } : r))
  }

  const roleColumns: Column<Role>[] = [
    {
      id: 'name',
      header: 'Role',
      render: (value) => (
        <span className="text-sm font-medium text-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'scope',
      header: 'Scope of Access',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      render: (_, row) => {
        const perms = Object.entries(row.permissions)
          .filter(([_, v]) => v)
          .map(([k]) => k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
        return (
          <div className="flex flex-wrap gap-1">
            {perms.length > 0 ? perms.map(p => (
              <Badge key={p} variant="muted" className="text-xs">{p}</Badge>
            )) : <span className="text-sm text-muted-foreground">—</span>}
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'muted'}>{row.status}</Badge>
      ),
    },
    {
      id: 'actions' as keyof Role,
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
              <DropdownMenuItem onClick={() => handleEditRole(row)}>Edit Permissions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleRoleStatus(row)}>
                {row.status === 'Active' ? 'Disable' : 'Enable'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleResetRolePermissions(row)}
                className="text-destructive"
              >
                Reset Permissions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const RoleEditDialog = () => (
    <Dialog open={isRoleDialogOpen} onOpenChange={(open) => {
      setIsRoleDialogOpen(open)
      if (!open) resetRoleForm()
    }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Role Permissions</DialogTitle>
          <DialogDescription>Configure permissions for the selected role.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Role Name</Label>
            <Input value={editingRole?.name || ''} disabled className="bg-muted" />
          </div>
          <div className="grid gap-3">
            <Label>Permissions</Label>
            <div className="flex items-center gap-2">
              <Checkbox id="approveLeave" checked={permApproveLeave} onCheckedChange={setPermApproveLeave} />
              <Label htmlFor="approveLeave" className="font-normal">Approve Leave</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="viewReports" checked={permViewReports} onCheckedChange={setPermViewReports} />
              <Label htmlFor="viewReports" className="font-normal">View Reports</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="configureSettings" checked={permConfigureSettings} onCheckedChange={setPermConfigureSettings} />
              <Label htmlFor="configureSettings" className="font-normal">Configure Settings</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bulkOperations" checked={permBulkOperations} onCheckedChange={setPermBulkOperations} />
              <Label htmlFor="bulkOperations" className="font-normal">Bulk Operations</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="escalationRights" checked={permEscalationRights} onCheckedChange={setPermEscalationRights} />
              <Label htmlFor="escalationRights" className="font-normal">Escalation Rights</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="userManagement" checked={permUserManagement} onCheckedChange={setPermUserManagement} />
              <Label htmlFor="userManagement" className="font-normal">User Management</Label>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="roleScope">Scope of Access</Label>
            <Select value={roleScope} onChange={setRoleScope} options={scopeOptions} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="roleStatus">Status</Label>
            <Switch id="roleStatus" checked={roleStatus === 'Active'} onChange={(e) => setRoleStatus(e.target.checked ? 'Active' : 'Inactive')} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
            setIsRoleDialogOpen(false)
            resetRoleForm()
          }}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={handleUpdateRole}>Save</Button>
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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Roles & Access</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage role-based permissions and access levels across the Leave Management System.</CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto" onClick={() => {
            if (roles.length > 0) handleEditRole(roles[0])
          }}>
            Edit Permissions
          </Button>
          <RoleEditDialog />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable columns={roleColumns} data={roles} density="compact" striped />
        </div>
      </CardContent>
    </Card>
  )
}
