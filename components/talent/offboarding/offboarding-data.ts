export interface OffboardingKPI {
  id: string
  title: string
  value: string
  subtitle: string
  icon: 'door-open' | 'log-out' | 'calendar' | 'shield' | 'users' | 'check-circle'
}

export interface ExitCase {
  id: string
  caseId: string
  employee: {
    name: string
    id: string
    initials: string
    title: string
    manager: string
    doj: string
  }
  department: string
  lastWorkingDay: string
  exitReason: string
  status: 'Resignation Submitted' | 'Notice Period' | 'Clearance' | 'Exit Interview' | 'Awaiting F&F' | 'Closed'
  owner: string
  updatedOn: string
}

export const mockOffboardingKPIs: OffboardingKPI[] = [
  {
    id: 'kpi-1',
    title: 'Total Exits',
    value: '36',
    subtitle: 'This Month',
    icon: 'door-open',
  },
  {
    id: 'kpi-2',
    title: 'Resignations',
    value: '22',
    subtitle: 'This Month',
    icon: 'log-out',
  },
  {
    id: 'kpi-3',
    title: 'Notice Period',
    value: '14',
    subtitle: 'In Progress',
    icon: 'calendar',
  },
  {
    id: 'kpi-4',
    title: 'Clearance Pending',
    value: '11',
    subtitle: 'Pending',
    icon: 'shield',
  },
  {
    id: 'kpi-5',
    title: 'Exit Interviews',
    value: '9',
    subtitle: 'Scheduled',
    icon: 'users',
  },
  {
    id: 'kpi-6',
    title: 'Closed',
    value: '18',
    subtitle: 'Completed',
    icon: 'check-circle',
  }
]

export const mockExitCases: ExitCase[] = [
  {
    id: 'exit-1',
    caseId: 'EC-2025-00123',
    employee: {
      name: 'Arjun Mehta',
      id: 'EMP10023',
      initials: 'AM',
      title: 'Product Engineer II',
      manager: 'Rohit Verma',
      doj: '15 Jan 2022'
    },
    department: 'Product Engineering',
    lastWorkingDay: '30 May 2025',
    exitReason: 'Better Opportunity',
    status: 'Notice Period',
    owner: 'Priya Sharma',
    updatedOn: '15 May 2025'
  },
  {
    id: 'exit-2',
    caseId: 'EC-2025-00124',
    employee: {
      name: 'Sneha Patel',
      id: 'EMP10045',
      initials: 'SP',
      title: 'Marketing Executive',
      manager: 'Alok Nath',
      doj: '05 Mar 2023'
    },
    department: 'Marketing',
    lastWorkingDay: '25 May 2025',
    exitReason: 'Career Change',
    status: 'Clearance',
    owner: 'Rahul Das',
    updatedOn: '14 May 2025'
  },
  {
    id: 'exit-3',
    caseId: 'EC-2025-00125',
    employee: {
      name: 'Rohit Verma',
      id: 'EMP10012',
      initials: 'RV',
      title: 'Sales Lead',
      manager: 'Meera Iyer',
      doj: '11 Jun 2021'
    },
    department: 'Sales',
    lastWorkingDay: '28 May 2025',
    exitReason: 'Personal Reasons',
    status: 'Notice Period',
    owner: 'Meera Iyer',
    updatedOn: '13 May 2025'
  },
  {
    id: 'exit-4',
    caseId: 'EC-2025-00126',
    employee: {
      name: 'Ananya Singh',
      id: 'EMP10078',
      initials: 'AS',
      title: 'Finance Analyst',
      manager: 'Karan Joshi',
      doj: '21 Sep 2023'
    },
    department: 'Finance',
    lastWorkingDay: '20 May 2025',
    exitReason: 'Relocation',
    status: 'Clearance',
    owner: 'Karan Joshi',
    updatedOn: '12 May 2025'
  },
  {
    id: 'exit-5',
    caseId: 'EC-2025-00127',
    employee: {
      name: 'Vikram Rao',
      id: 'EMP10056',
      initials: 'VR',
      title: 'Customer Success Mgr',
      manager: 'Priya Sharma',
      doj: '10 Oct 2022'
    },
    department: 'Customer Success',
    lastWorkingDay: '15 May 2025',
    exitReason: 'Better Opportunity',
    status: 'Exit Interview',
    owner: 'Priya Sharma',
    updatedOn: '12 May 2025'
  },
  {
    id: 'exit-6',
    caseId: 'EC-2025-00128',
    employee: {
      name: 'Neha Gupta',
      id: 'EMP10011',
      initials: 'NG',
      title: 'HR Generalist',
      manager: 'Rahul Das',
      doj: '01 Feb 2022'
    },
    department: 'HR',
    lastWorkingDay: '10 May 2025',
    exitReason: 'Personal Reasons',
    status: 'Awaiting F&F',
    owner: 'Rahul Das',
    updatedOn: '11 May 2025'
  },
  {
    id: 'exit-7',
    caseId: 'EC-2025-00129',
    employee: {
      name: 'Karan Malhotra',
      id: 'EMP10088',
      initials: 'KM',
      title: 'Product Engineer I',
      manager: 'Rohit Verma',
      doj: '15 Dec 2023'
    },
    department: 'Product Engineering',
    lastWorkingDay: '05 May 2025',
    exitReason: 'Career Growth',
    status: 'Closed',
    owner: 'Meera Iyer',
    updatedOn: '10 May 2025'
  },
  {
    id: 'exit-8',
    caseId: 'EC-2025-00130',
    employee: {
      name: 'Pooja Nair',
      id: 'EMP10056',
      initials: 'PN',
      title: 'UX Designer',
      manager: 'Anita Sharma',
      doj: '22 Mar 2022'
    },
    department: 'Design',
    lastWorkingDay: '02 May 2025',
    exitReason: 'Better Opportunity',
    status: 'Closed',
    owner: 'Karan Joshi',
    updatedOn: '09 May 2025'
  }
]
