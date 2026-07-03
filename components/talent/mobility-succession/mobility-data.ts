export interface MobilityKPI {
  id: string
  title: string
  value: string
  trend: {
    value: string
    isPositive?: boolean
    isNeutral?: boolean
  }
  icon: 'briefcase' | 'users' | 'file-text' | 'arrow-left-right' | 'trending-up' | 'shield'
  action?: string
}

export interface InternalJob {
  id: string
  jobId: string
  title: string
  department: string
  location: string
  grade: string
  postedOn: string
  applications: number
  status: 'Open' | 'In Review' | 'Closed'
}

export const mockMobilityKPIs: MobilityKPI[] = [
  {
    id: 'kpi-1',
    title: 'Open Internal Jobs',
    value: '18',
    trend: { value: '3 vs last month', isPositive: true },
    icon: 'briefcase',
  },
  {
    id: 'kpi-2',
    title: 'Applications',
    value: '126',
    trend: { value: '12 vs last month', isPositive: true },
    icon: 'users',
  },
  {
    id: 'kpi-3',
    title: 'In Review',
    value: '37',
    trend: { value: '4 vs last month', isPositive: true },
    icon: 'file-text',
  },
  {
    id: 'kpi-4',
    title: 'Transfers in Progress',
    value: '14',
    trend: { value: 'No change', isNeutral: true },
    icon: 'arrow-left-right',
  },
  {
    id: 'kpi-5',
    title: 'Promotions in Progress',
    value: '9',
    trend: { value: '2 vs last month', isPositive: true },
    icon: 'trending-up',
  },
  {
    id: 'kpi-6',
    title: 'Critical Roles',
    value: '22',
    trend: { value: '' }, // Replaced by action in UI
    icon: 'shield',
    action: 'View successors'
  }
]

export const mockInternalJobs: InternalJob[] = [
  {
    id: 'job-1',
    jobId: 'INT-2024-018',
    title: 'Senior Product Manager',
    department: 'Product',
    location: 'Bengaluru',
    grade: 'G7',
    postedOn: '12 May 2024',
    applications: 24,
    status: 'Open'
  },
  {
    id: 'job-2',
    jobId: 'INT-2024-017',
    title: 'Finance Business Partner',
    department: 'Finance',
    location: 'Mumbai',
    grade: 'G6',
    postedOn: '10 May 2024',
    applications: 18,
    status: 'Open'
  },
  {
    id: 'job-3',
    jobId: 'INT-2024-016',
    title: 'Regional Sales Head',
    department: 'Sales',
    location: 'Delhi NCR',
    grade: 'G8',
    postedOn: '08 May 2024',
    applications: 31,
    status: 'Open'
  },
  {
    id: 'job-4',
    jobId: 'INT-2024-015',
    title: 'UX Designer',
    department: 'Design',
    location: 'Bengaluru',
    grade: 'G5',
    postedOn: '05 May 2024',
    applications: 15,
    status: 'In Review'
  },
  {
    id: 'job-5',
    jobId: 'INT-2024-014',
    title: 'Data Analyst',
    department: 'Analytics',
    location: 'Hyderabad',
    grade: 'G4',
    postedOn: '01 May 2024',
    applications: 9,
    status: 'In Review'
  },
  {
    id: 'job-6',
    jobId: 'INT-2024-013',
    title: 'HR Generalist',
    department: 'Human Resources',
    location: 'Pune',
    grade: 'G4',
    postedOn: '28 Apr 2024',
    applications: 12,
    status: 'Open'
  },
  {
    id: 'job-7',
    jobId: 'INT-2024-012',
    title: 'Marketing Manager',
    department: 'Marketing',
    location: 'Bengaluru',
    grade: 'G6',
    postedOn: '25 Apr 2024',
    applications: 17,
    status: 'Closed'
  }
]
