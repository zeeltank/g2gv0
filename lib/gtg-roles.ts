export type Role = 'admin' | 'hr' | 'dept-head' | 'employee'

export const ROLES: { id: Role; label: string; short: string }[] = [
  { id: 'admin', label: 'Administrator', short: 'AM' },
  { id: 'hr', label: 'HR Manager', short: 'HR' },
  { id: 'dept-head', label: 'Department Head', short: 'DH' },
  { id: 'employee', label: 'Employee', short: 'EM' },
]

/** Access levels per the GTG Permission Matrix. */
export type Access = 'full' | 'view' | 'scoped' | 'none'

type PageKey =
  | 'organization-information'
  | 'add-organization-detail'
  | 'department-list'
  | 'department-hierarchy'

/**
 * Permission matrix for the Organization Setup pages, taken verbatim
 * from the GTG Architecture Reference + Permission Flowchart.
 */
const MATRIX: Record<PageKey, Record<Role, Access>> = {
  'organization-information': {
    admin: 'full',
    hr: 'view',
    'dept-head': 'none',
    employee: 'none',
  },
  'add-organization-detail': {
    admin: 'full',
    hr: 'none',
    'dept-head': 'none',
    employee: 'none',
  },
  'department-list': {
    admin: 'full',
    hr: 'full',
    'dept-head': 'scoped',
    employee: 'none',
  },
  'department-hierarchy': {
    admin: 'full',
    hr: 'full',
    'dept-head': 'none',
    employee: 'none',
  },
}

export function getAccess(page: PageKey, role: Role): Access {
  return MATRIX[page][role]
}

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.id === role)?.label ?? ''
}
