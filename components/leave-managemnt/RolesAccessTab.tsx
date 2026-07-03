'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

const permissionKeys: Array<keyof Role['permissions']> = [
  'approveLeave',
  'viewReports',
  'configureSettings',
  'bulkOperations',
  'escalationRights',
  'userManagement',
]

export default function RolesAccessTab({ isLoading }: { isLoading: boolean }) {
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [originalRoles, setOriginalRoles] = useState<Role[]>(initialRoles)

  const hasChanges = JSON.stringify(roles) !== JSON.stringify(originalRoles)

  const handlePermissionChange = (roleId: string, permission: keyof Role['permissions'], value: boolean) => {
    setRoles(roles.map(r =>
      r.id === roleId
        ? { ...r, permissions: { ...r.permissions, [permission]: value } }
        : r
    ))
  }

  const handleToggleRolePermissions = (role: Role) => {
    const shouldSelectAll = permissionKeys.some((permission) => !role.permissions[permission])
    const permissions = permissionKeys.reduce<Role['permissions']>((nextPermissions, permission) => ({
      ...nextPermissions,
      [permission]: shouldSelectAll,
    }), { ...role.permissions })

    setRoles(roles.map(r =>
      r.id === role.id
        ? { ...r, permissions }
        : r
    ))
  }

  const handleSaveChanges = () => {
    console.log('Saving roles:', roles)
    setOriginalRoles(roles)
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
      id: 'approveLeave' as keyof Role,
      header: 'Approve Leave',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.approveLeave}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'approveLeave', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'viewReports' as keyof Role,
      header: 'View Reports',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.viewReports}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'viewReports', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'configureSettings' as keyof Role,
      header: 'Configure Settings',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.configureSettings}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'configureSettings', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'bulkOperations' as keyof Role,
      header: 'Bulk Operations',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.bulkOperations}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'bulkOperations', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'escalationRights' as keyof Role,
      header: 'Escalation Rights',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.escalationRights}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'escalationRights', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'userManagement' as keyof Role,
      header: 'User Management',
      render: (_, row) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.permissions.userManagement}
            onCheckedChange={(checked) => handlePermissionChange(row.id, 'userManagement', !!checked)}
          />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <Badge variant={row.status === 'Active' ? 'success' : 'muted'}>{row.status}</Badge>
      ),
    },
    {
      id: 'quickSelect' as keyof Role,
      header: 'QUICK SELECT',
      render: (_, row) => (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm font-medium text-primary"
          onClick={() => handleToggleRolePermissions(row)}
        >
          Select All
        </Button>
      ),
    },
  ]

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
        {hasChanges && (
          <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable
            columns={roleColumns}
            data={roles}
            density="compact"
            striped
          />
        </div>
      </CardContent>
    </Card>
  )
}
