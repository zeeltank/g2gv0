'use client'

export interface EarlyGoingRecord {
  id: string
  employee: string
  employeeId: string
  department: string
  date: string
  punchIn: string
  punchOut: string
  expectedOut: string
  earlyBy: string
  earlyByMin: number
  status: 'present' | 'late' | 'absent'
}

export interface DepartmentReport {
  id: string
  department: string
  totalEmployees: number
  present: number
  absent: number
  late: number
  earlyGoing: number
  averageWorkingHours: string
  attendancePercentage: number
}

export interface EmployeeReport {
  id: string
  date: string
  employeeId: string
  punchIn: string
  punchOut: string
  expectedIn: string
  expectedOut: string
  workingHours: string
  lateBy: string
  earlyBy: string
  status: 'present' | 'late' | 'absent'
}

export const earlyGoingMockData: EarlyGoingRecord[] = [
  {
    id: '1',
    employee: 'Amit Sharma',
    employeeId: 'EMP001',
    department: 'Engineering',
    date: '2026-06-20',
    punchIn: '09:00 AM',
    punchOut: '01:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '4h 30m',
    earlyByMin: 270,
    status: 'present',
  },
  {
    id: '2',
    employee: 'Priya Patel',
    employeeId: 'EMP002',
    department: 'Marketing',
    date: '2026-06-19',
    punchIn: '08:45 AM',
    punchOut: '02:15 PM',
    expectedOut: '06:00 PM',
    earlyBy: '3h 45m',
    earlyByMin: 225,
    status: 'present',
  },
  {
    id: '3',
    employee: 'Raj Kumar',
    employeeId: 'EMP003',
    department: 'Sales',
    date: '2026-06-18',
    punchIn: '09:15 AM',
    punchOut: '12:45 PM',
    expectedOut: '06:00 PM',
    earlyBy: '5h 15m',
    earlyByMin: 315,
    status: 'present',
  },
  {
    id: '4',
    employee: 'Sneha Reddy',
    employeeId: 'EMP004',
    department: 'Engineering',
    date: '2026-06-17',
    punchIn: '08:30 AM',
    punchOut: '01:00 PM',
    expectedOut: '06:00 PM',
    earlyBy: '5h 0m',
    earlyByMin: 300,
    status: 'present',
  },
  {
    id: '5',
    employee: 'Vikram Singh',
    employeeId: 'EMP005',
    department: 'HR',
    date: '2026-06-16',
    punchIn: '09:30 AM',
    punchOut: '03:00 PM',
    expectedOut: '06:00 PM',
    earlyBy: '3h 0m',
    earlyByMin: 180,
    status: 'present',
  },
]

export const departmentReportMockData: DepartmentReport[] = [
  {
    id: '1',
    department: 'Engineering',
    totalEmployees: 45,
    present: 42,
    absent: 2,
    late: 1,
    earlyGoing: 8,
    averageWorkingHours: '7h 45m',
    attendancePercentage: 93.3,
  },
  {
    id: '2',
    department: 'Marketing',
    totalEmployees: 28,
    present: 25,
    absent: 3,
    late: 0,
    earlyGoing: 5,
    averageWorkingHours: '7h 30m',
    attendancePercentage: 89.3,
  },
  {
    id: '3',
    department: 'Sales',
    totalEmployees: 32,
    present: 28,
    absent: 2,
    late: 2,
    earlyGoing: 12,
    averageWorkingHours: '7h 50m',
    attendancePercentage: 87.5,
  },
  {
    id: '4',
    department: 'HR',
    totalEmployees: 15,
    present: 14,
    absent: 1,
    late: 0,
    earlyGoing: 3,
    averageWorkingHours: '7h 40m',
    attendancePercentage: 93.3,
  },
  {
    id: '5',
    department: 'Finance',
    totalEmployees: 20,
    present: 18,
    absent: 2,
    late: 1,
    earlyGoing: 4,
    averageWorkingHours: '7h 55m',
    attendancePercentage: 90.0,
  },
]

export const employeeReportMockData: EmployeeReport[] = [
  {
    id: '1',
    date: '2026-06-20',
    employeeId: 'EMP001',
    punchIn: '09:00 AM',
    punchOut: '06:00 PM',
    expectedIn: '09:30 AM',
    expectedOut: '06:00 PM',
    workingHours: '8h 0m',
    lateBy: '30m',
    earlyBy: '--',
    status: 'late',
  },
  {
    id: '2',
    date: '2026-06-19',
    employeeId: 'EMP001',
    punchIn: '09:15 AM',
    punchOut: '02:30 PM',
    expectedIn: '09:00 AM',
    expectedOut: '06:00 PM',
    workingHours: '6h 15m',
    lateBy: '15m',
    earlyBy: '3h 30m',
    status: 'present',
  },
  {
    id: '3',
    date: '2026-06-18',
    employeeId: 'EMP001',
    punchIn: '09:00 AM',
    punchOut: '06:30 PM',
    expectedIn: '09:00 AM',
    expectedOut: '06:00 PM',
    workingHours: '8h 30m',
    lateBy: '--',
    earlyBy: '--',
    status: 'present',
  },
  {
    id: '4',
    date: '2026-06-17',
    employeeId: 'EMP001',
    punchIn: '--',
    punchOut: '--',
    expectedIn: '09:00 AM',
    expectedOut: '06:00 PM',
    workingHours: '--',
    lateBy: '--',
    earlyBy: '--',
    status: 'absent',
  },
  {
    id: '5',
    date: '2026-06-16',
    employeeId: 'EMP001',
    punchIn: '08:45 AM',
    punchOut: '06:15 PM',
    expectedIn: '09:00 AM',
    expectedOut: '06:00 PM',
    workingHours: '8h 30m',
    lateBy: '--',
    earlyBy: '15m',
    status: 'present',
  },
]

export const departments = [
  { value: 'all', label: 'All Departments' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
]

export const employees = [
  { value: 'all', label: 'All Employees' },
  { value: 'emp001', label: 'Amit Sharma (EMP001)' },
  { value: 'emp002', label: 'Priya Patel (EMP002)' },
  { value: 'emp003', label: 'Raj Kumar (EMP003)' },
  { value: 'emp004', label: 'Sneha Reddy (EMP004)' },
  { value: 'emp005', label: 'Vikram Singh (EMP005)' },
]

export const savedReports = [
  { value: 'last-month', label: 'Last Month Report' },
  { value: 'q1-2026', label: 'Q1 2026 Report' },
  { value: 'this-week', label: 'This Week Report' },
]