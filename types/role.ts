/**
 * Roles, keyed on the backend's `role_key`.
 *
 * This used to be four strings — 'admin' | 'hr' | 'dept-head' | 'employee' —
 * derived by substring-matching a profile's *display name* (F-104). That is the
 * exact mistake `role_key` (D-010) was introduced to end, and the backend had
 * already ended it: RequireProfile matches role_key exactly and documents why.
 * The frontend was the last place still guessing.
 *
 * The platform defines nine roles per tenant on `tbluserprofilemaster`. All nine
 * are here now, so `auditor`, `recruiter`, `executive` and `reporting_manager`
 * stop being indistinguishable from `employee`.
 */

export type Role =
  | 'employee'
  | 'reporting_manager'
  | 'department_head'
  | 'hr_executive'
  | 'hr_manager'
  | 'administrator'
  | 'executive'
  | 'auditor'
  | 'recruiter'

export const ROLES: { id: Role; label: string; short: string }[] = [
  { id: 'employee', label: 'Employee', short: 'EM' },
  { id: 'reporting_manager', label: 'Reporting Manager', short: 'RM' },
  { id: 'department_head', label: 'Department Head', short: 'DH' },
  { id: 'hr_executive', label: 'HR Executive', short: 'HE' },
  { id: 'hr_manager', label: 'HR Manager', short: 'HR' },
  { id: 'administrator', label: 'Administrator', short: 'AM' },
  { id: 'executive', label: 'Executive', short: 'EX' },
  { id: 'auditor', label: 'Auditor', short: 'AU' },
  { id: 'recruiter', label: 'Recruiter', short: 'RC' },
]

/**
 * Named groups, so a screen expresses *who* it is for rather than listing keys.
 *
 * These mirror `App\Support\RoleKey::ALIASES` on the backend deliberately: a
 * gate the browser applies and a gate the API applies must mean the same thing,
 * or the menu disagrees with the endpoint again.
 */
export const ROLE_GROUPS = {
  /** Tenant owners. */
  admin: ['administrator'] as Role[],
  /** The HR function. */
  hr: ['hr_manager', 'hr_executive'] as Role[],
  /** Anyone who manages people. */
  manager: ['reporting_manager', 'department_head'] as Role[],
  /** Read-only oversight. */
  oversight: ['executive', 'auditor'] as Role[],
} as const

/** Everyone who may administer payroll and leave configuration. */
export const HR_ADMIN_ROLES: Role[] = [...ROLE_GROUPS.admin, ...ROLE_GROUPS.hr]

export const ALL_ROLES: Role[] = ROLES.map((role) => role.id)

export function isRole(value: string | null | undefined): value is Role {
  return !!value && ALL_ROLES.includes(value as Role)
}

/**
 * "Is this an HR or admin user?" — the question ~20 screens across the product
 * were asking as `role === 'admin' || role === 'hr'`.
 *
 * Widening Role to the nine role_keys made every one of those comparisons a
 * type error, which is the compiler pointing at each place that assumed the old
 * four-role vocabulary. Rather than re-listing keys at each site, they ask here.
 * `hr_executive` is included because the old 'hr' bucket contained it — this
 * preserves what those screens already granted rather than silently re-drawing
 * anyone's access.
 */
export function isHrAdmin(role: Role | null | undefined): boolean {
  return !!role && HR_ADMIN_ROLES.includes(role)
}

/** Access levels per the GTG Permission Matrix. */
export type Access = 'full' | 'view' | 'scoped' | 'none'

type PageKey =
  | 'organization-information'
  | 'add-organization-detail'
  | 'department-list'
  | 'department-hierarchy'

/**
 * Permission matrix for the Organization Setup pages, taken from the GTG
 * Architecture Reference + Permission Flowchart.
 *
 * Written as "the roles that get more than none", because listing all nine on
 * every row buries the rule. `getAccess` returns 'none' for anything unlisted,
 * which is also the safe default for a role added later.
 */
const MATRIX: Record<PageKey, Partial<Record<Role, Access>>> = {
  'organization-information': {
    administrator: 'full',
    hr_manager: 'view',
    hr_executive: 'view',
    executive: 'view',
    auditor: 'view',
  },
  'add-organization-detail': {
    administrator: 'full',
  },
  'department-list': {
    administrator: 'full',
    hr_manager: 'full',
    hr_executive: 'full',
    department_head: 'scoped',
    reporting_manager: 'scoped',
    auditor: 'view',
  },
  'department-hierarchy': {
    administrator: 'full',
    hr_manager: 'full',
    hr_executive: 'full',
    auditor: 'view',
  },
}

export function getAccess(page: PageKey, role: Role): Access {
  return MATRIX[page][role] ?? 'none'
}

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.id === role)?.label ?? ''
}
