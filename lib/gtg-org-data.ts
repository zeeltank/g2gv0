export type SisterCompany = {
  id: string
  name: string
  code: string
  type: string
  location: string
  employees: number
}

export const ORG_PROFILE = {
  name: 'GapstoGrowth Technologies',
  code: 'GTG-HQ-001',
  registrationNumber: 'CIN-U72900KA2014PTC076543',
  industry: 'Information Technology & Services',
  organizationType: 'Private Limited',
  website: 'www.gapstogrowth.com',
  email: 'corporate@gapstogrowth.com',
  phone: '+91 80 4567 8900',
  fax: '+91 80 4567 8999',
  address: {
    line1: 'Prestige Tech Park, Tower B, Level 9',
    line2: 'Marathahalli - Sarjapur Outer Ring Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postal: '560103',
    country: 'India',
  },
  founded: '2014',
  totalEmployees: 1284,
}

export const SISTER_COMPANIES: SisterCompany[] = [
  {
    id: 'sc-1',
    name: 'GapstoGrowth Analytics',
    code: 'GTG-ANL-002',
    type: 'Subsidiary',
    location: 'Hyderabad, India',
    employees: 312,
  },
  {
    id: 'sc-2',
    name: 'GapstoGrowth EMEA',
    code: 'GTG-EMEA-003',
    type: 'Branch',
    location: 'London, United Kingdom',
    employees: 148,
  },
  {
    id: 'sc-3',
    name: 'GapstoGrowth Cloud Labs',
    code: 'GTG-CLD-004',
    type: 'Subsidiary',
    location: 'Singapore',
    employees: 96,
  },
]

/**
 * A department as the Department Management screen holds it.
 *
 * `code`, `description`, `hodId`, `sortOrder` and `updated` are populated from
 * the API. They were previously either absent or fabricated on the client - the
 * code came from a hardcoded lookup table, `hod` was always null, `employees`
 * was always 0, and `status` was always 'Active'.
 *
 * NOTE ON 'Draft': the status filter offered it, but hrms_departments.status is
 * an int with two states. It is kept in the union only because DeptNode and the
 * status badge share it; nothing produces it.
 */
export type Department = {
  id: string
  name: string
  code?: string | null
  description?: string | null
  parentId?: string | null
  parent: string | null
  hod: string | null
  hodId?: string | null
  employees: number
  status: 'Active' | 'Inactive' | 'Draft'
  sortOrder?: number
  created: string
  updated?: string | null
}

/*
 * DEPARTMENTS (the 12-row demo fixture - Executive Office/Avin Mehta,
 * Engineering/486 employees, and so on) has been removed.
 *
 * Its only consumer was department-hierarchy.tsx, which rendered it instead of
 * the API and has been deleted along with it. Keeping a realistic-looking
 * fixture exported from a lib/ module is how it got rendered to users in the
 * first place: the component looked correct in isolation and nothing about the
 * import said "this is not real data".
 */

export type DeptNode = {
  id: string
  name: string
  code?: string | null
  hod: string | null
  employees: number
  status: 'Active' | 'Inactive' | 'Draft'
  /**
   * Position among siblings.
   *
   * The tree had no ordering field at all, so it rendered in whatever order
   * the API happened to return - which made the Move up / Move down buttons
   * look broken even when they had correctly written a new order to the
   * database.
   */
  sortOrder?: number
  /**
   * True when this department's `parent_id` points at a row that does not
   * exist, so it has been promoted to a root to keep the tree renderable.
   * Surfaced in the UI rather than silently hidden.
   */
  orphaned?: boolean
  children: DeptNode[]
}

export function buildHierarchy(depts: Department[]): DeptNode[] {
  const byName = new Map<string, DeptNode>()
  depts.forEach((d) =>
    byName.set(d.name, {
      id: d.id,
      name: d.name,
      hod: d.hod,
      employees: d.employees,
      status: d.status,
      children: [],
    }),
  )
  const roots: DeptNode[] = []
  depts.forEach((d) => {
    const node = byName.get(d.name)!
    if (d.parent && byName.has(d.parent)) {
      byName.get(d.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}
