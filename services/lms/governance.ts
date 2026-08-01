/**
 * Administration & Governance.
 *
 * Users, roles and the permission matrix read tables that already existed but
 * had no usable API — their controllers live in routes/user.php behind session
 * auth and CSRF. Trainers, vendors and integrations are new entities created
 * for this page.
 *
 * Note what is deliberately absent: no endpoint here returns a password,
 * plain_password, Aadhaar, PAN or bank field, and the integrations model stores
 * no access tokens. The generic /table_data endpoint the old frontend read
 * users through used to return all of those, for every tenant, unauthenticated.
 */

import { apiClient } from '@/services/core'
import { withLaravelParams, type LaravelContext } from '@/lib/laravel-context'

export interface GovernanceResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface GovernancePaginatedResponse<T> {
  status: boolean
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    journey_events?: number
  }
  filters?: { actions: string[]; entity_types: string[] }
}

/* ─── KPIs ─────────────────────────────────────────────────────────────────── */

export interface GovernanceKpis {
  users: number
  active_users: number
  roles: number
  permissions: number
  trainers: number
  vendors: number
  integrations: number
  /** Audit events in the last 30 days, scoped to this tenant. */
  audit_logs: number
}

/* ─── Users ────────────────────────────────────────────────────────────────── */

export interface GovernanceUser {
  id: number
  user_name: string | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  full_name: string
  /** Two-letter monogram, computed server-side so clients agree. */
  initials: string
  email: string | null
  mobile: string | null
  employee_no: string | null
  /** 1 active, 0 inactive. */
  status: number
  last_login: string | null
  user_profile_id: number | null
  profile_name: string | null
  department_id: number | null
  department_name: string | null
  image: string | null
  created_at: string | null
}

export interface UserPayload {
  first_name: string
  last_name?: string | null
  middle_name?: string | null
  email: string
  mobile?: string | null
  employee_no?: string | null
  user_profile_id: number
  department_id?: number | null
  status?: number
  /** Required on create only; omitted on update to leave the password alone. */
  user_name?: string
  password?: string
}

export interface UserQuery {
  page?: number
  perPage?: number
  search?: string
  status?: string
  profileId?: number | string
  departmentId?: number | string
  sortBy?: 'name' | 'email' | 'status' | 'last_login'
  sortDir?: 'asc' | 'desc'
}

/* ─── Roles & permissions ──────────────────────────────────────────────────── */

export interface GovernanceRole {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  sort_order: number | null
  status: number
  user_count: number
  permission_count: number
}

export interface RolePayload {
  name: string
  description?: string | null
  parent_id?: number | null
  sort_order?: number | null
  status?: number
}

/** One row of the permission matrix: a menu plus this role's four flags. */
export interface PermissionRow {
  id: number
  menu_name: string
  parent_id: number | null
  level: number | null
  access_link: string | null
  icon: string | null
  sort_order: number | null
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface PermissionUpdate {
  menu_id: number
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
}

/* ─── Trainers, vendors, integrations ──────────────────────────────────────── */

export type TrainerType = 'internal' | 'external'

export interface Trainer {
  id: number
  name: string
  email: string | null
  phone: string | null
  trainer_type: TrainerType | string
  vendor_id: number | null
  vendor_name: string | null
  user_id: number | null
  specialisation: string | null
  bio: string | null
  qualifications: string | null
  hourly_rate: string | number | null
  currency: string | null
  status: number
  /** Total sessions: exact trainer_id matches plus legacy name/email matches. */
  session_count: number
  /** Sessions joined through lms_virtual_classroom.trainer_id — exact. */
  linked_session_count: number
  /** Older sessions still matched only by free-text name/email. */
  unlinked_session_count: number
  created_at: string | null
}

export interface TrainerPayload {
  name: string
  email?: string | null
  phone?: string | null
  trainer_type?: TrainerType
  vendor_id?: number | null
  /** tbluser.id. Named apart from the request's own `user_id` (the actor). */
  user_id_link?: number | null
  specialisation?: string | null
  bio?: string | null
  qualifications?: string | null
  hourly_rate?: number | null
  currency?: string | null
  status?: boolean
}

/** Derived from contract_end, never stored, so it cannot go stale. */
export type ContractState = 'open' | 'active' | 'expiring' | 'expired'

export interface Vendor {
  id: number
  name: string
  vendor_code: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  service_type: string | null
  contract_start: string | null
  contract_end: string | null
  contract_value: string | number | null
  currency: string | null
  status: number
  notes: string | null
  trainer_count: number
  contract_state: ContractState
  /** Negative once the contract has lapsed. Null when open-ended. */
  days_to_expiry: number | null
}

export interface VendorPayload {
  name: string
  vendor_code?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  service_type?: string | null
  contract_start?: string | null
  contract_end?: string | null
  contract_value?: number | null
  currency?: string | null
  status?: boolean
  notes?: string | null
}

export type IntegrationStatus = 'connected' | 'disconnected' | 'error'

export interface Integration {
  id: number
  provider: string
  display_name: string
  category: string | null
  description: string | null
  status: IntegrationStatus | string
  connected_at: string | null
  last_sync_at: string | null
  last_error: string | null
  /** Non-sensitive settings only — no tokens or keys are stored. */
  config: Record<string, unknown> | null
  created_at: string | null
}

export interface IntegrationPayload {
  provider: string
  display_name: string
  category?: string | null
  description?: string | null
  status?: IntegrationStatus
  config?: Record<string, unknown> | null
}

/* ─── Audit & health ───────────────────────────────────────────────────────── */

export interface AuditLog {
  /** hpbrain_audit_logs is UUID-keyed — varchar(36), not an auto-increment int. */
  id: string
  entity_type: string | null
  entity_id: string | number | null
  action: string | null
  actor_id: number | null
  actor_name: string | null
  ip_address: string | null
  status: string | null
  source: string | null
  created_at: string | null
}

export interface AuditQuery {
  page?: number
  perPage?: number
  search?: string
  action?: string
  entityType?: string
  from?: string
  to?: string
}

/** Each check is actually performed; 'unknown' means it could not be. */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown'

export interface HealthCheck {
  key: string
  label: string
  status: HealthStatus | string
  detail: string
}

/* ─── Service ──────────────────────────────────────────────────────────────── */

function params(
  context: LaravelContext,
  profileName?: string,
  extra?: Record<string, string>,
) {
  return withLaravelParams(context, {
    ...(profileName ? { user_profile_name: profileName } : {}),
    ...extra,
  }) as Record<string, string>
}

/** Drop empty values — Laravel treats '' as a supplied filter. */
function clean(extra: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string>
}

const BASE = '/lms/governance'

export const lmsGovernanceService = {
  kpis: (context: LaravelContext, profileName?: string) =>
    apiClient.get<GovernanceResponse<GovernanceKpis>>(`${BASE}/kpis`, params(context, profileName)),

  systemHealth: (context: LaravelContext, profileName?: string) =>
    apiClient.get<GovernanceResponse<HealthCheck[]>>(
      `${BASE}/system-health`,
      params(context, profileName),
    ),

  /* Users */

  users: (context: LaravelContext, query: UserQuery = {}, profileName?: string) =>
    apiClient.get<GovernancePaginatedResponse<GovernanceUser>>(
      `${BASE}/users`,
      params(
        context,
        profileName,
        clean({
          page: String(query.page ?? 1),
          per_page: String(query.perPage ?? 10),
          search: query.search,
          status: query.status,
          profile_id: query.profileId ? String(query.profileId) : undefined,
          department_id: query.departmentId ? String(query.departmentId) : undefined,
          sort_by: query.sortBy ?? 'name',
          sort_dir: query.sortDir ?? 'asc',
        }),
      ),
    ),

  createUser: (context: LaravelContext, payload: UserPayload, profileName?: string) =>
    apiClient.post<GovernanceResponse<{ id: number }>>(`${BASE}/users`, {
      ...params(context, profileName),
      ...payload,
    }),

  updateUser: (
    context: LaravelContext,
    id: number,
    payload: UserPayload,
    profileName?: string,
  ) =>
    apiClient.put<GovernanceResponse<null>>(`${BASE}/users/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  /** Soft delete — enrolments, progress and certificates still reference them. */
  deleteUser: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<GovernanceResponse<null>>(`${BASE}/users/${id}`, params(context, profileName)),

  /**
   * POST /api/lms/governance/users/import — bulk create from CSV.
   *
   * Multipart, so it goes through postForm. The role is passed as a field
   * rather than read from the file: the CSV may not choose its own privileges,
   * and tenant is taken from the caller's token server-side.
   */
  importUsers: (
    context: LaravelContext,
    file: File,
    userProfileId: number,
    profileName?: string,
  ) => {
    const form = new FormData()
    Object.entries(params(context, profileName)).forEach(([key, value]) => form.append(key, value))
    form.append('user_profile_id', String(userProfileId))
    form.append('file', file)
    return apiClient.postForm<
      GovernanceResponse<{ imported: number; skipped: number }> & { errors?: string[] }
    >(`${BASE}/users/import`, form)
  },

  /* Roles */

  roles: (context: LaravelContext, profileName?: string) =>
    apiClient.get<GovernanceResponse<GovernanceRole[]>>(`${BASE}/roles`, params(context, profileName)),

  createRole: (context: LaravelContext, payload: RolePayload, profileName?: string) =>
    apiClient.post<GovernanceResponse<{ id: number }>>(`${BASE}/roles`, {
      ...params(context, profileName),
      ...payload,
    }),

  updateRole: (context: LaravelContext, id: number, payload: RolePayload, profileName?: string) =>
    apiClient.put<GovernanceResponse<null>>(`${BASE}/roles/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteRole: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<GovernanceResponse<null>>(`${BASE}/roles/${id}`, params(context, profileName)),

  /* Permission matrix */

  permissions: (context: LaravelContext, profileId: number, profileName?: string) =>
    apiClient.get<GovernanceResponse<PermissionRow[]>>(
      `${BASE}/permissions`,
      params(context, profileName, { profile_id: String(profileId) }),
    ),

  /** Whole-set save, applied in a transaction server-side. */
  savePermissions: (
    context: LaravelContext,
    profileId: number,
    permissions: PermissionUpdate[],
    profileName?: string,
  ) =>
    apiClient.post<GovernanceResponse<{ saved: number }>>(`${BASE}/permissions`, {
      ...params(context, profileName),
      profile_id: profileId,
      permissions,
    }),

  /* Trainers */

  trainers: (context: LaravelContext, search?: string, profileName?: string) =>
    apiClient.get<GovernanceResponse<Trainer[]>>(
      `${BASE}/trainers`,
      params(context, profileName, clean({ search })),
    ),

  createTrainer: (context: LaravelContext, payload: TrainerPayload, profileName?: string) =>
    apiClient.post<GovernanceResponse<Trainer>>(`${BASE}/trainers`, {
      ...params(context, profileName),
      ...payload,
    }),

  updateTrainer: (
    context: LaravelContext,
    id: number,
    payload: TrainerPayload,
    profileName?: string,
  ) =>
    apiClient.put<GovernanceResponse<Trainer>>(`${BASE}/trainers/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteTrainer: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<GovernanceResponse<null>>(`${BASE}/trainers/${id}`, params(context, profileName)),

  /* Vendors */

  vendors: (context: LaravelContext, search?: string, profileName?: string) =>
    apiClient.get<GovernanceResponse<Vendor[]>>(
      `${BASE}/vendors`,
      params(context, profileName, clean({ search })),
    ),

  createVendor: (context: LaravelContext, payload: VendorPayload, profileName?: string) =>
    apiClient.post<GovernanceResponse<Vendor>>(`${BASE}/vendors`, {
      ...params(context, profileName),
      ...payload,
    }),

  updateVendor: (
    context: LaravelContext,
    id: number,
    payload: VendorPayload,
    profileName?: string,
  ) =>
    apiClient.put<GovernanceResponse<Vendor>>(`${BASE}/vendors/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteVendor: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<GovernanceResponse<null>>(`${BASE}/vendors/${id}`, params(context, profileName)),

  /* Integrations */

  integrations: (context: LaravelContext, profileName?: string) =>
    apiClient.get<GovernanceResponse<Integration[]>>(
      `${BASE}/integrations`,
      params(context, profileName),
    ),

  createIntegration: (
    context: LaravelContext,
    payload: IntegrationPayload,
    profileName?: string,
  ) =>
    apiClient.post<GovernanceResponse<Integration>>(`${BASE}/integrations`, {
      ...params(context, profileName),
      ...payload,
    }),

  updateIntegration: (
    context: LaravelContext,
    id: number,
    payload: IntegrationPayload,
    profileName?: string,
  ) =>
    apiClient.put<GovernanceResponse<Integration>>(`${BASE}/integrations/${id}`, {
      ...params(context, profileName),
      ...payload,
    }),

  deleteIntegration: (context: LaravelContext, id: number, profileName?: string) =>
    apiClient.delete<GovernanceResponse<null>>(
      `${BASE}/integrations/${id}`,
      params(context, profileName),
    ),

  /* Audit */

  auditLogs: (context: LaravelContext, query: AuditQuery = {}, profileName?: string) =>
    apiClient.get<GovernancePaginatedResponse<AuditLog>>(
      `${BASE}/audit-logs`,
      params(
        context,
        profileName,
        clean({
          page: String(query.page ?? 1),
          per_page: String(query.perPage ?? 20),
          search: query.search,
          action: query.action,
          entity_type: query.entityType,
          from: query.from,
          to: query.to,
        }),
      ),
    ),
}
