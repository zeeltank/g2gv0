import type { Department, DeptNode } from '@/lib/gtg-org-data'

export const HOD_TITLES: Record<string, string> = {
  'Avin Mehta': 'CEO',
  'Priya Nair': 'CHRO',
  'Rahul Verma': 'TA Manager',
  'Sanjay Kapoor': 'CTO',
  'Meera Iyer': 'Platform Head',
  'Arjun Rao': 'QA Manager',
  'Neha Gupta': 'Product Lead',
  'Vikram Singh': 'Growth Head',
  'Anita Desai': 'Success Lead',
  'Rohit Sharma': 'CFO',
  'Kabir Khan': 'Security Lead',
}

export function departmentCode(department: Department) {
  const explicit: Record<string, string> = {
    'Executive Office': 'EXO',
    'Human Resources': 'HR',
    'Talent Acquisition': 'HR-TA',
    Engineering: 'ENG',
    'Platform Engineering': 'ENG-PLT',
    'Quality Assurance': 'ENG-QA',
    'Product Management': 'PRD',
    'Sales & Marketing': 'SM',
    'Customer Success': 'CS',
    'Finance & Accounts': 'FIN',
    'Legal & Compliance': 'LGL',
    'Information Security': 'SEC',
  }

  if (explicit[department.name]) return explicit[department.name]

  return department.name
    .split(/\s|&/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

export function initials(name?: string | null) {
  if (!name) return 'UA'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function descendantCount(node: DeptNode): number {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0)
}