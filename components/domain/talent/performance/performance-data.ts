export interface PerformanceKPI {
  id: string
  title: string
  value: string
  subtitle?: string
  icon: 'calendar' | 'users' | 'user-clock' | 'user-check' | 'scale' | 'check-circle' | 'gift'
  trend?: {
    value: string
    isPositive: boolean
  }
  progress?: number
}

export interface EmployeeReview {
  id: string
  employee: {
    name: string
    id: string
    initials: string
  }
  department: string
  manager: string
  cycle: string
  stage: 'Self Review' | 'Manager Review' | 'Calibration' | 'Final Review' | 'Completed'
  overallRating: string | null
  status: 'In Progress' | 'Pending' | 'Completed'
  dueDate: string | null
}

export interface ActivityFeedItem {
  id: string
  userInitial: string
  userName: string
  action: string
  date: string
  type: 'status_change' | 'reminder' | 'system'
}

export const mockPerformanceKPIs: PerformanceKPI[] = [
  {
    id: 'kpi-1',
    title: 'Active Review Cycles',
    value: '2',
    subtitle: '1 closing this month',
    icon: 'calendar',
  },
  {
    id: 'kpi-2',
    title: 'Employees in Cycle',
    value: '612',
    subtitle: '78% of total employees',
    icon: 'users',
  },
  {
    id: 'kpi-3',
    title: 'Self Reviews Pending',
    value: '156',
    subtitle: 'Due in next 7 days: 42',
    icon: 'user-clock',
  },
  {
    id: 'kpi-4',
    title: 'Manager Reviews Pending',
    value: '98',
    subtitle: 'Overdue: 18',
    icon: 'user-check',
  },
  {
    id: 'kpi-5',
    title: 'Calibration Pending',
    value: '3',
    subtitle: 'Due in next 5 days',
    icon: 'scale',
  },
  {
    id: 'kpi-6',
    title: 'Final Ratings Completed',
    value: '358',
    subtitle: '59% completed',
    icon: 'check-circle',
    progress: 59
  },
  {
    id: 'kpi-7',
    title: 'Reward Decisions Pending',
    value: '74',
    subtitle: 'Not yet finalized',
    icon: 'gift',
  }
]

export const mockEmployeeReviews: EmployeeReview[] = [
  {
    id: 'rev-1',
    employee: { name: 'Arjun Sharma', id: 'E1234', initials: 'AS' },
    department: 'Product',
    manager: 'Rohit Malhotra',
    cycle: 'FY 2024-25 Annual',
    stage: 'Self Review',
    overallRating: null,
    status: 'In Progress',
    dueDate: '15 May 2025'
  },
  {
    id: 'rev-2',
    employee: { name: 'Priya Kapoor', id: 'E1241', initials: 'PK' },
    department: 'Marketing',
    manager: 'Neha Bansal',
    cycle: 'FY 2024-25 Annual',
    stage: 'Manager Review',
    overallRating: null,
    status: 'Pending',
    dueDate: '16 May 2025'
  },
  {
    id: 'rev-3',
    employee: { name: 'Rohit Kumar', id: 'E1250', initials: 'RK' },
    department: 'Engineering',
    manager: 'Arjun Sharma',
    cycle: 'FY 2024-25 Annual',
    stage: 'Calibration',
    overallRating: '4 - Exceeds',
    status: 'In Progress',
    dueDate: '18 May 2025'
  },
  {
    id: 'rev-4',
    employee: { name: 'Sneha Mehta', id: 'E1260', initials: 'SM' },
    department: 'Finance',
    manager: 'Vikram Iyer',
    cycle: 'FY 2024-25 Annual',
    stage: 'Final Review',
    overallRating: '3 - Meets',
    status: 'Pending',
    dueDate: '20 May 2025'
  },
  {
    id: 'rev-5',
    employee: { name: 'Aditya Das', id: 'E1267', initials: 'AD' },
    department: 'Sales',
    manager: 'Karan Verma',
    cycle: 'FY 2024-25 Annual',
    stage: 'Completed',
    overallRating: '4 - Exceeds',
    status: 'Completed',
    dueDate: null
  },
  {
    id: 'rev-6',
    employee: { name: 'Neha Gupta', id: 'E1275', initials: 'NG' },
    department: 'HR',
    manager: 'Meera Joshi',
    cycle: 'FY 2024-25 Annual',
    stage: 'Completed',
    overallRating: '5 - Outstanding',
    status: 'Completed',
    dueDate: null
  }
]

export const mockActivityFeed: ActivityFeedItem[] = [
  {
    id: 'act-1',
    userInitial: 'RM',
    userName: 'Rohit Malhotra',
    action: 'moved stage from Self Review to Manager Review',
    date: '05 May 2025, 11:15 AM',
    type: 'status_change'
  },
  {
    id: 'act-2',
    userInitial: 'S',
    userName: 'System',
    action: 'Self review reminder email sent to Arjun Sharma',
    date: '02 May 2025, 10:00 AM',
    type: 'reminder'
  },
  {
    id: 'act-3',
    userInitial: 'S',
    userName: 'System',
    action: 'Review cycle FY 2024-25 Annual launched for Product department',
    date: '01 Apr 2025, 09:30 AM',
    type: 'system'
  }
]
