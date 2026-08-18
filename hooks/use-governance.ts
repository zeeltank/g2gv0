'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCatalogService,
  lmsGovernanceService,
  type AuditLog,
  type CatalogDepartment,
  type GovernanceKpis,
  type GovernanceRole,
  type GovernanceUser,
  type HealthCheck,
  type Integration,
  type IntegrationPayload,
  type PermissionRow,
  type RolePayload,
  type Trainer,
  type TrainerPayload,
  type UserPayload,
  type Vendor,
  type VendorPayload,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export type GovernanceTab =
  | 'users'
  | 'roles'
  | 'trainers'
  | 'vendors'
  | 'integrations'
  | 'audit'
  | 'settings'

export function useGovernance() {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])
  const profileName = user?.profileName
  /** The API enforces this too; the UI uses it to hide writes it would refuse. */
  const canAdminister = user?.role === 'admin' || user?.role === 'hr'

  const [tab, setTab] = useState<GovernanceTab>('users')

  const [kpis, setKpis] = useState<GovernanceKpis | null>(null)
  const [health, setHealth] = useState<HealthCheck[]>([])

  // Users
  const [users, setUsers] = useState<GovernanceUser[]>([])
  const [userMeta, setUserMeta] = useState({ current_page: 1, last_page: 1, per_page: 10, total: 0 })
  const [userSearch, setUserSearch] = useState('')
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState('')
  const [userProfileId, setUserProfileId] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPerPage, setUserPerPage] = useState(10)

  const [roles, setRoles] = useState<GovernanceRole[]>([])
  const [departments, setDepartments] = useState<CatalogDepartment[]>([])

  // Permission matrix
  const [matrixProfileId, setMatrixProfileId] = useState<number | null>(null)
  const [matrix, setMatrix] = useState<PermissionRow[]>([])
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixDirty, setMatrixDirty] = useState(false)

  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditMeta, setAuditMeta] = useState({
    current_page: 1, last_page: 1, per_page: 20, total: 0, journey_events: 0,
  })
  const [auditFilters, setAuditFilters] = useState<{ actions: string[]; entity_types: string[] }>({
    actions: [], entity_types: [],
  })
  const [auditAction, setAuditAction] = useState('')
  const [auditPage, setAuditPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearch)
      setUserPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  /* ── Header: KPIs, health, and the reference data every tab needs ── */

  const loadHeader = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to manage this institute.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Settled individually: a single failing panel should not blank the page.
      const [kpiResult, healthResult, roleResult, deptResult] = await Promise.all([
        lmsGovernanceService.kpis(context, profileName).catch(() => null),
        lmsGovernanceService.systemHealth(context, profileName).catch(() => null),
        lmsGovernanceService.roles(context, profileName).catch(() => null),
        lmsCatalogService.getFilterOptions(context).catch(() => null),
      ])

      setKpis(kpiResult?.data ?? null)
      setHealth(healthResult?.data ?? [])
      setRoles(roleResult?.data ?? [])
      setDepartments(deptResult?.data?.departments ?? [])

      if (!kpiResult && !healthResult && !roleResult) {
        setError('Failed to load governance data.')
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load governance data.'))
    } finally {
      setLoading(false)
    }
  }, [resolveContext, profileName])

  useEffect(() => {
    queueMicrotask(() => {
      void loadHeader()
    })
  }, [loadHeader])

  /* ── Per-tab loads ── */

  const loadUsers = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    try {
      const response = await lmsGovernanceService.users(
        context,
        {
          page: userPage,
          perPage: userPerPage,
          search: debouncedUserSearch || undefined,
          status: userStatus || undefined,
          profileId: userProfileId || undefined,
        },
        profileName,
      )
      setUsers(response.data ?? [])
      if (response.meta) setUserMeta(response.meta)
    } catch (loadError) {
      setActionError(toMessage(loadError, 'Failed to load users.'))
      setUsers([])
    }
  }, [resolveContext, userPage, userPerPage, debouncedUserSearch, userStatus, userProfileId, profileName])

  const loadTrainers = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return
    try {
      const response = await lmsGovernanceService.trainers(context, undefined, profileName)
      setTrainers(response.data ?? [])
    } catch {
      setTrainers([])
    }
  }, [resolveContext, profileName])

  const loadVendors = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return
    try {
      const response = await lmsGovernanceService.vendors(context, undefined, profileName)
      setVendors(response.data ?? [])
    } catch {
      setVendors([])
    }
  }, [resolveContext, profileName])

  const loadIntegrations = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return
    try {
      const response = await lmsGovernanceService.integrations(context, profileName)
      setIntegrations(response.data ?? [])
    } catch {
      setIntegrations([])
    }
  }, [resolveContext, profileName])

  const loadAudit = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return
    try {
      const response = await lmsGovernanceService.auditLogs(
        context,
        { page: auditPage, action: auditAction || undefined },
        profileName,
      )
      setAuditLogs(response.data ?? [])
      if (response.meta) setAuditMeta({ journey_events: 0, ...response.meta })
      if (response.filters) setAuditFilters(response.filters)
    } catch {
      setAuditLogs([])
    }
  }, [resolveContext, auditPage, auditAction, profileName])

  // Each tab fetches only when it is the visible one, so opening the page does
  // not fire seven requests for six panels nobody is looking at.
  useEffect(() => {
    queueMicrotask(() => {
      if (tab === 'users') void loadUsers()
      else if (tab === 'trainers') void loadTrainers()
      else if (tab === 'vendors') void loadVendors()
      else if (tab === 'integrations') void loadIntegrations()
      else if (tab === 'audit') void loadAudit()
    })
  }, [tab, loadUsers, loadTrainers, loadVendors, loadIntegrations, loadAudit])

  /* ── Permission matrix ── */

  const loadMatrix = useCallback(
    async (profileId: number) => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return

      setMatrixProfileId(profileId)
      setMatrixLoading(true)
      setMatrixDirty(false)

      try {
        const response = await lmsGovernanceService.permissions(context, profileId, profileName)
        setMatrix(response.data ?? [])
      } catch (loadError) {
        setActionError(toMessage(loadError, 'Failed to load the permission matrix.'))
        setMatrix([])
      } finally {
        setMatrixLoading(false)
      }
    },
    [resolveContext, profileName],
  )

  /** Toggle one flag locally; nothing is sent until the matrix is saved. */
  const togglePermission = useCallback(
    (menuId: number, field: 'can_view' | 'can_add' | 'can_edit' | 'can_delete') => {
      setMatrix((current) =>
        current.map((row) => {
          if (row.id !== menuId) return row
          const next = { ...row, [field]: !row[field] }
          // Add/edit/delete are meaningless without view, so clearing view
          // clears the rest rather than leaving an unreachable permission.
          if (field === 'can_view' && !next.can_view) {
            next.can_add = false
            next.can_edit = false
            next.can_delete = false
          }
          return next
        }),
      )
      setMatrixDirty(true)
    },
    [],
  )

  /* ── Shared write wrapper ── */

  const run = useCallback(
    async (operation: () => Promise<string>, fallback: string) => {
      setSaving(true)
      setActionError(null)
      setMessage(null)

      try {
        const success = await operation()
        setMessage(success)
        return { ok: true, message: success }
      } catch (writeError) {
        const failure = toMessage(writeError, fallback)
        setActionError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const savePermissions = useCallback(
    () =>
      run(async () => {
        if (!matrixProfileId) throw new Error('Select a role first.')
        const response = await lmsGovernanceService.savePermissions(
          resolveContext(),
          matrixProfileId,
          matrix.map((row) => ({
            menu_id: row.id,
            can_view: row.can_view,
            can_add: row.can_add,
            can_edit: row.can_edit,
            can_delete: row.can_delete,
          })),
          profileName,
        )
        setMatrixDirty(false)
        await loadHeader()
        return response.message ?? 'Permissions saved.'
      }, 'Failed to save permissions.'),
    [run, resolveContext, matrixProfileId, matrix, profileName, loadHeader],
  )

  /* ── Users ── */

  const saveUser = useCallback(
    (payload: UserPayload, id?: number) =>
      run(async () => {
        const context = resolveContext()
        if (id) await lmsGovernanceService.updateUser(context, id, payload, profileName)
        else await lmsGovernanceService.createUser(context, payload, profileName)
        await Promise.all([loadUsers(), loadHeader()])
        return id ? 'User updated.' : `${payload.first_name} added.`
      }, 'Failed to save the user.'),
    [run, resolveContext, profileName, loadUsers, loadHeader],
  )

  const removeUser = useCallback(
    (id: number) =>
      run(async () => {
        await lmsGovernanceService.deleteUser(resolveContext(), id, profileName)
        await Promise.all([loadUsers(), loadHeader()])
        return 'User deactivated.'
      }, 'Failed to deactivate the user.'),
    [run, resolveContext, profileName, loadUsers, loadHeader],
  )

  /** Per-row skip reasons from the last import, surfaced rather than swallowed. */
  const [importErrors, setImportErrors] = useState<string[]>([])

  const importUsers = useCallback(
    async (file: File, userProfileId: number) => {
      setSaving(true)
      setActionError(null)
      setMessage(null)
      setImportErrors([])

      try {
        const response = await lmsGovernanceService.importUsers(
          resolveContext(),
          file,
          userProfileId,
          profileName,
        )
        // A partial import is a success with caveats: the rows that loaded are
        // real, and the user needs to see which ones did not.
        setImportErrors(response.errors ?? [])
        await Promise.all([loadUsers(), loadHeader()])
        const success = response.message ?? 'Users imported.'
        setMessage(success)
        return { ok: true, message: success }
      } catch (importError) {
        const failure = toMessage(importError, 'Failed to import users.')
        setActionError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [resolveContext, profileName, loadUsers, loadHeader],
  )

  /* ── Roles ── */

  const saveRole = useCallback(
    (payload: RolePayload, id?: number) =>
      run(async () => {
        const context = resolveContext()
        if (id) await lmsGovernanceService.updateRole(context, id, payload, profileName)
        else await lmsGovernanceService.createRole(context, payload, profileName)
        await loadHeader()
        return id ? 'Role updated.' : `${payload.name} added.`
      }, 'Failed to save the role.'),
    [run, resolveContext, profileName, loadHeader],
  )

  const removeRole = useCallback(
    (id: number) =>
      run(async () => {
        await lmsGovernanceService.deleteRole(resolveContext(), id, profileName)
        await loadHeader()
        return 'Role deleted.'
      }, 'Failed to delete the role.'),
    [run, resolveContext, profileName, loadHeader],
  )

  /* ── Trainers ── */

  const saveTrainer = useCallback(
    (payload: TrainerPayload, id?: number) =>
      run(async () => {
        const context = resolveContext()
        if (id) await lmsGovernanceService.updateTrainer(context, id, payload, profileName)
        else await lmsGovernanceService.createTrainer(context, payload, profileName)
        await Promise.all([loadTrainers(), loadHeader()])
        return id ? 'Trainer updated.' : `${payload.name} added.`
      }, 'Failed to save the trainer.'),
    [run, resolveContext, profileName, loadTrainers, loadHeader],
  )

  const removeTrainer = useCallback(
    (id: number) =>
      run(async () => {
        await lmsGovernanceService.deleteTrainer(resolveContext(), id, profileName)
        await Promise.all([loadTrainers(), loadHeader()])
        return 'Trainer removed.'
      }, 'Failed to remove the trainer.'),
    [run, resolveContext, profileName, loadTrainers, loadHeader],
  )

  /* ── Vendors ── */

  const saveVendor = useCallback(
    (payload: VendorPayload, id?: number) =>
      run(async () => {
        const context = resolveContext()
        if (id) await lmsGovernanceService.updateVendor(context, id, payload, profileName)
        else await lmsGovernanceService.createVendor(context, payload, profileName)
        await Promise.all([loadVendors(), loadHeader()])
        return id ? 'Vendor updated.' : `${payload.name} added.`
      }, 'Failed to save the vendor.'),
    [run, resolveContext, profileName, loadVendors, loadHeader],
  )

  const removeVendor = useCallback(
    (id: number) =>
      run(async () => {
        await lmsGovernanceService.deleteVendor(resolveContext(), id, profileName)
        await Promise.all([loadVendors(), loadHeader()])
        return 'Vendor removed.'
      }, 'Failed to remove the vendor.'),
    [run, resolveContext, profileName, loadVendors, loadHeader],
  )

  /* ── Integrations ── */

  const saveIntegration = useCallback(
    (payload: IntegrationPayload, id?: number) =>
      run(async () => {
        const context = resolveContext()
        if (id) await lmsGovernanceService.updateIntegration(context, id, payload, profileName)
        else await lmsGovernanceService.createIntegration(context, payload, profileName)
        // Health reads the integrations table for SSO, so refresh both.
        await Promise.all([loadIntegrations(), loadHeader()])
        return id ? 'Integration updated.' : `${payload.display_name} connected.`
      }, 'Failed to save the integration.'),
    [run, resolveContext, profileName, loadIntegrations, loadHeader],
  )

  const removeIntegration = useCallback(
    (id: number) =>
      run(async () => {
        await lmsGovernanceService.deleteIntegration(resolveContext(), id, profileName)
        await Promise.all([loadIntegrations(), loadHeader()])
        return 'Integration removed.'
      }, 'Failed to remove the integration.'),
    [run, resolveContext, profileName, loadIntegrations, loadHeader],
  )

  /** Contracts needing attention, surfaced on the Settings tab. */
  const expiringVendors = useMemo(
    () => vendors.filter((v) => v.contract_state === 'expiring' || v.contract_state === 'expired'),
    [vendors],
  )

  return {
    tab,
    setTab,

    kpis,
    health,
    roles,
    departments,
    canAdminister,

    users,
    userMeta,
    userSearch,
    setUserSearch,
    userStatus,
    setUserStatus: (value: string) => {
      setUserStatus(value)
      setUserPage(1)
    },
    userProfileId,
    setUserProfileId: (value: string) => {
      setUserProfileId(value)
      setUserPage(1)
    },
    userPage,
    setUserPage,
    userPerPage,
    setUserPerPage: (value: number) => {
      setUserPerPage(value)
      setUserPage(1)
    },
    saveUser,
    removeUser,
    importUsers,
    importErrors,

    saveRole,
    removeRole,

    matrixProfileId,
    matrix,
    matrixLoading,
    matrixDirty,
    loadMatrix,
    togglePermission,
    savePermissions,

    trainers,
    saveTrainer,
    removeTrainer,

    vendors,
    expiringVendors,
    saveVendor,
    removeVendor,

    integrations,
    saveIntegration,
    removeIntegration,

    auditLogs,
    auditMeta,
    auditFilters,
    auditAction,
    setAuditAction: (value: string) => {
      setAuditAction(value)
      setAuditPage(1)
    },
    auditPage,
    setAuditPage,

    loading,
    error,
    saving,
    message,
    actionError,
    dismiss: () => {
      setMessage(null)
      setActionError(null)
    },
    reload: () => void loadHeader(),
  }
}

export type GovernanceState = ReturnType<typeof useGovernance>
