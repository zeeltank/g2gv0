'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldCheck } from 'lucide-react'
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

export default function RolesAccessTab({
  isLoading,
  onDirtyChange,
}: {
  isLoading: boolean
  /**
   * F-191. Reports whether this tab holds unsaved edits.
   *
   * The parent conditionally renders each tab, so switching UNMOUNTS this one and
   * the draft goes with it. The page uses this to confirm before discarding.
   */
  onDirtyChange?: (dirty: boolean) => void
}) {
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

  // F-191. Tell the page, so a tab switch can confirm before discarding.
  useEffect(() => {
    onDirtyChange?.(hasChanges)
  }, [hasChanges, onDirtyChange])


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
      /*
       * The label now says what the click will do.
       *
       * It was always "Select All" while the handler TOGGLED: shouldSelectAll
       * is false once every permission is already on, so on a fully-permitted
       * role a button reading "Select All" silently revoked every permission
       * that role had. On the leave permission matrix, which is the table that
       * decides who may approve leave.
       */
      render: (_, row) => {
        const willSelectAll = permissionKeys.some((permission) => !row[permission])

        return (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm font-medium text-primary"
            onClick={() => handleToggleRolePermissions(row)}
          >
            {willSelectAll ? 'Select All' : 'Clear All'}
          </Button>
        )
      },
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
        {/*
          F-198. This was `{hasChanges && ( ... )}` - the Save button did not exist
          until you had already changed something, and then appeared in the CARD
          HEADER, above where you were working.
          A screen full of editable controls with no visible Save leaves "does
          this save automatically?" unanswered, which is the question a Save
          button exists to answer. Every other editable screen in this module
          keeps it visible and disabled (ApprovalWorkflowTab, EntitlementsTab,
          salary-structure).
        */}
        <Button
          className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto"
          onClick={() => save(draft)}
          disabled={processing || !hasChanges}
        >
          {processing ? 'Saving...' : 'Save Changes'}
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
          {/*
            F-194. No emptyState was passed and no length check guarded it, so
            DataTable fell back to its own literal string "No data available" -
            a nine-column header above one grey sentence, with no hint that
            these rows come from hrms_leave_role_permissions or what would
            create them. Both sibling tabs already do this properly.
          */}
          {draft.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-10" />}
              title="No role permissions configured"
              description="Leave permissions are stored per role for this organisation. Until a row exists, every role falls back to the platform default - nobody can approve leave from here."
            />
          ) : (
            <DataTable columns={roleColumns} data={draft} density="compact" striped />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
