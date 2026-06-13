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

export type Department = {
  id: string
  name: string
  parent: string | null
  hod: string | null
  employees: number
  status: 'Active' | 'Inactive' | 'Draft'
  created: string
}

export const DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Executive Office', parent: null, hod: 'Avin Mehta', employees: 8, status: 'Active', created: '2014-03-12' },
  { id: 'd2', name: 'Human Resources', parent: 'Executive Office', hod: 'Priya Nair', employees: 42, status: 'Active', created: '2014-04-01' },
  { id: 'd3', name: 'Talent Acquisition', parent: 'Human Resources', hod: 'Rahul Verma', employees: 18, status: 'Active', created: '2015-06-20' },
  { id: 'd4', name: 'Engineering', parent: 'Executive Office', hod: 'Sanjay Kapoor', employees: 486, status: 'Active', created: '2014-04-15' },
  { id: 'd5', name: 'Platform Engineering', parent: 'Engineering', hod: 'Meera Iyer', employees: 124, status: 'Active', created: '2016-01-10' },
  { id: 'd6', name: 'Quality Assurance', parent: 'Engineering', hod: 'Arjun Rao', employees: 76, status: 'Active', created: '2016-02-22' },
  { id: 'd7', name: 'Product Management', parent: 'Executive Office', hod: 'Neha Gupta', employees: 54, status: 'Active', created: '2015-09-05' },
  { id: 'd8', name: 'Sales & Marketing', parent: 'Executive Office', hod: 'Vikram Singh', employees: 132, status: 'Active', created: '2014-07-18' },
  { id: 'd9', name: 'Customer Success', parent: 'Sales & Marketing', hod: 'Anita Desai', employees: 64, status: 'Active', created: '2017-03-30' },
  { id: 'd10', name: 'Finance & Accounts', parent: 'Executive Office', hod: 'Rohit Sharma', employees: 38, status: 'Active', created: '2014-05-09' },
  { id: 'd11', name: 'Legal & Compliance', parent: 'Executive Office', hod: null, employees: 12, status: 'Draft', created: '2023-11-02' },
  { id: 'd12', name: 'Information Security', parent: 'Engineering', hod: 'Kabir Khan', employees: 22, status: 'Inactive', created: '2018-08-14' },
]

export type DeptNode = {
  id: string
  name: string
  hod: string | null
  employees: number
  status: 'Active' | 'Inactive' | 'Draft'
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
