'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { menuRightsService, type RoleProfile } from '@/services/navigation/menu-rights'
import {
  applyAction,
  applyModuleColumn,
  applyNodeAll,
  toPermissionTree,
  toRightsPayload,
  type ActionKey,
  type PermissionNode,
} from '@/lib/role-permissions'

export interface RolePermissionsResult {
  roles: RoleProfile[]
  rolesLoading: boolean
  activeRoleId: string
  activeRole: RoleProfile | undefined
  setActiveRoleId: (roleId: string) => void

  permissions: PermissionNode[]
  permissionsLoading: boolean
  error: string | null

  hasChanges: boolean
  saving: boolean
  /** Bumped whenever a fresh tree is loaded, so the matrix can replay its entry animation. */
  animateKey: number

  toggleAction: (nodeId: string, action: ActionKey, value: boolean) => void
  toggleNodeAll: (nodeId: string, value: boolean) => void
  toggleModuleColumn: (moduleId: string, action: ActionKey, value: boolean) => void
  save: () => void
  createRole: (role: { name: string; description?: string }) => Promise<RoleProfile | null>
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Drives the Role & Permissions screen off tblmenumaster_g2g /
 * tblgroupwise_rights_g2g: the roles list, the selected role's rights over
 * menu levels 1-3, the local edits, and the save that rewrites them.
 *
 * Saving invalidates the sidebar query as well - editing the role you are
 * signed in under changes your own menu, and a stale sidebar would keep
 * offering links the server has just revoked.
 */
export function useRolePermissions(): RolePermissionsResult {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)
  const queryClient = useQueryClient()

  const [activeRoleId, setActiveRoleId] = useState('')
  const [draft, setDraft] = useState<PermissionNode[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [animateKey, setAnimateKey] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['role-permissions', 'roles', context.token, context.subInstituteId],
    queryFn: () => menuRightsService.getRoles(context),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })

  const roles = useMemo(() => rolesQuery.data?.data ?? [], [rolesQuery.data])

  /* eslint-disable react-hooks/set-state-in-effect -- Selection follows the loaded roles list. */
  useEffect(() => {
    if (!activeRoleId && roles.length) {
      setActiveRoleId(String(roles[0].id))
    }
  }, [activeRoleId, roles])
  /* eslint-enable react-hooks/set-state-in-effect */

  const rightsQuery = useQuery({
    queryKey: ['role-permissions', 'rights', context.token, context.subInstituteId, activeRoleId],
    queryFn: () => menuRightsService.getRights(context, activeRoleId),
    enabled: ready && Boolean(activeRoleId),
    staleTime: 60 * 1000,
  })

  const serverTree = useMemo(
    () => (rightsQuery.data ? toPermissionTree(rightsQuery.data.data ?? []) : null),
    [rightsQuery.data],
  )

  /* eslint-disable react-hooks/set-state-in-effect -- The draft is a local copy of whatever the server last returned. */
  useEffect(() => {
    if (!serverTree) return
    setDraft(serverTree)
    setHasChanges(false)
    setAnimateKey((previous) => previous + 1)
  }, [serverTree])
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveMutation = useMutation({
    mutationFn: () => menuRightsService.saveRights(context, activeRoleId, toRightsPayload(draft)),
    onSuccess: (response) => {
      if (Number(response.status_code) !== 1) {
        setActionError(response.message || 'Failed to save permissions')
        return
      }
      setActionError(null)
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['role-permissions', 'rights'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-navigation'] })
    },
    onError: (error) => setActionError(toMessage(error, 'Failed to save permissions')),
  })

  const createRoleMutation = useMutation({
    mutationFn: (role: { name: string; description?: string }) => menuRightsService.createRole(context, role),
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['role-permissions', 'roles'] })
    },
    onError: (error) => setActionError(toMessage(error, 'Failed to create role')),
  })

  const toggleAction = useCallback((nodeId: string, action: ActionKey, value: boolean) => {
    setDraft((previous) => applyAction(previous, nodeId, action, value))
    setHasChanges(true)
  }, [])

  const toggleNodeAll = useCallback((nodeId: string, value: boolean) => {
    setDraft((previous) => applyNodeAll(previous, nodeId, value))
    setHasChanges(true)
  }, [])

  const toggleModuleColumn = useCallback((moduleId: string, action: ActionKey, value: boolean) => {
    setDraft((previous) => applyModuleColumn(previous, moduleId, action, value))
    setHasChanges(true)
  }, [])

  const createRole = useCallback(
    async (role: { name: string; description?: string }) => {
      const response = await createRoleMutation.mutateAsync(role).catch(() => null)
      if (!response || Number(response.status_code) !== 1) return null
      setActiveRoleId(String(response.data.id))
      return response.data
    },
    [createRoleMutation],
  )

  const queryError =
    (rolesQuery.error instanceof Error ? rolesQuery.error.message : null) ??
    (rightsQuery.error instanceof Error ? rightsQuery.error.message : null)

  return {
    roles,
    rolesLoading: ready && rolesQuery.isLoading,
    activeRoleId,
    activeRole: roles.find((role) => String(role.id) === activeRoleId),
    setActiveRoleId,

    permissions: draft,
    permissionsLoading: Boolean(activeRoleId) && rightsQuery.isLoading,
    error: actionError ?? queryError ?? (ready ? null : 'Sign in to manage role permissions'),

    hasChanges,
    saving: saveMutation.isPending,
    animateKey,

    toggleAction,
    toggleNodeAll,
    toggleModuleColumn,
    save: () => saveMutation.mutate(),
    createRole,
  }
}
