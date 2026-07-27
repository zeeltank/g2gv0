'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { useLeaveRoles } from '@/hooks/use-leave'
import type { LeaveRolePermission } from '@/services/hrms'

type PermissionKey =
  | 'approve_leave'
  | 'view_reports'
  | 'configure_settings'
  | 'bulk_operations'
  | 'escalation_rights'
  | 'user_management'

const permissionKeys: PermissionKey[] = [
  'approve_leave',
  'view_reports',
  'configure_settings',
  'bulk_operations',
  'escalation_rights',
  'user_management',
]

const permissionHeaders: Record<PermissionKey, string> = {
  approve_leave: 'Approve Leave',
  view_reports: 'View Reports',
  configure_settings: 'Configure Settings',
  bulk_operations: 'Bulk Operations',
  escalation_rights: 'Escalation Rights',
  user_management: 'User Management',
}

export default function RolesAccessTab({ isLoading }: { isLoading: boolean }) {
  const { loading, processing, error, actionMessage, roles, save, retry, clearMessages } = useLeaveRoles()
  const [draft, setDraft] = useState<LeaveRolePermission[]>(roles)
  const [syncedRoles, setSyncedRoles] = useState<LeaveRolePermission[]>(roles)

  // Adjust the editable draft during render when the server payload changes,
  // rather than in an effect - see https://react.dev/learn/you-might-not-need-an-effect
  if (roles !== syncedRoles) {
    setSyncedRoles(roles)
    setDraft(roles)
  }

  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(roles), [draft, roles])

  const handlePermissionChange = (roleId: number, permission: PermissionKey, value: boolean) => {
    setDraft((prev) => prev.map((role) => (role.id === roleId ? { ...role, [permission]: value } : role)))
  }

  const handleToggleRolePermissions = (role: LeaveRolePermission) => {
    const shouldSelectAll = permissionKeys.some((permission) => !role[permission])

    setDraft((prev) =>
      prev.map((current) =>
        current.id === role.id
          ? permissionKeys.reduce<LeaveRolePermission>(
              (next, permission) => ({ ...next, [permission]: shouldSelectAll }),
              { ...current },
            )
          : current,
      ),
    )
  }

  const permissionColumns: Column<LeaveRolePermission>[] = permissionKeys.map((permission) => ({
    id: permission as keyof LeaveRolePermission,
    header: permissionHeaders[permission],
    render: (_, row) => (
      <div className="flex justify-center">
        <Checkbox
          checked={row[permission]}
          onCheckedChange={(checked) => handlePermissionChange(row.id, permission, !!checked)}
        />
      </div>
    ),
  }))

  const roleColumns: Column<LeaveRolePermission>[] = [
    {
      id: 'role_name',
      header: 'Role',
      render: (value) => <span className="text-sm font-medium text-foreground">{String(value)}</span>,
    },
    {
      id: 'scope',
      header: 'Scope of Access',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value)}</span>,
    },
    ...permissionColumns,
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status ? 'Active' : 'Inactive'} />,
    },
    {
      id: 'quickSelect' as keyof LeaveRolePermission,
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

  if (error && draft.length === 0) {
    return <ErrorState title="Unable to load role permissions" description={error} retry={retry} />
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Roles &amp; Access</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Manage role-based permissions and access levels across the Leave Management System.
          </CardDescription>
        </div>
        {hasChanges && (
          <Button
            className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto"
            onClick={() => save(draft)}
            disabled={processing}
          >
            {processing ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
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
          <DataTable columns={roleColumns} data={draft} density="compact" striped />
        </div>
      </CardContent>
    </Card>
  )
}
