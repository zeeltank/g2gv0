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
  {
    id: '6',
    employee: 'Neha Gupta',
    employeeId: 'EMP006',
    department: 'Finance',
    date: '2026-06-21',
    punchIn: '09:10 AM',
    punchOut: '04:00 PM',
    expectedOut: '06:00 PM',
    earlyBy: '2h 0m',
    earlyByMin: 120,
    status: 'present',
  },
  {
    id: '7',
    employee: 'Arjun Malhotra',
    employeeId: 'EMP007',
    department: 'Engineering',
    date: '2026-06-15',
    punchIn: '10:00 AM',
    punchOut: '05:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '30m',
    earlyByMin: 30,
    status: 'present',
  },
  {
    id: '8',
    employee: 'Kavita Rao',
    employeeId: 'EMP008',
    department: 'Marketing',
    date: '2026-06-22',
    punchIn: '09:00 AM',
    punchOut: '02:00 PM',
    expectedOut: '06:00 PM',
    earlyBy: '4h 0m',
    earlyByMin: 240,
    status: 'present',
  },
  {
    id: '9',
    employee: 'Manohar Kumar',
    employeeId: 'EMP009',
    department: 'Sales',
    date: '2026-06-14',
    punchIn: '08:30 AM',
    punchOut: '01:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '4h 30m',
    earlyByMin: 270,
    status: 'present',
  },
  {
    id: '10',
    employee: 'Divya Shah',
    employeeId: 'EMP010',
    department: 'Finance',
    date: '2026-06-23',
    punchIn: '09:20 AM',
    punchOut: '06:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '--',
    earlyByMin: 0,
    status: 'late',
  },
  {
    id: '11',
    employee: 'Rohit Verma',
    employeeId: 'EMP011',
    department: 'HR',
    date: '2026-06-24',
    punchIn: '--',
    punchOut: '--',
    expectedOut: '06:00 PM',
    earlyBy: '--',
    earlyByMin: 0,
    status: 'absent',
  },
  {
    id: '12',
    employee: 'Ananya Mishra',
    employeeId: 'EMP012',
    department: 'Engineering',
    date: '2026-06-13',
    punchIn: '08:45 AM',
    punchOut: '01:15 PM',
    expectedOut: '06:00 PM',
    earlyBy: '4h 45m',
    earlyByMin: 285,
    status: 'present',
  },
  {
    id: '13',
    employee: 'Karan Patel',
    employeeId: 'EMP013',
    department: 'Marketing',
    date: '2026-06-25',
    punchIn: '09:30 AM',
    punchOut: '02:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '3h 30m',
    earlyByMin: 210,
    status: 'present',
  },
  {
    id: '14',
    employee: 'Meera Nair',
    employeeId: 'EMP014',
    department: 'Sales',
    date: '2026-06-26',
    punchIn: '08:15 AM',
    punchOut: '05:45 PM',
    expectedOut: '06:00 PM',
    earlyBy: '15m',
    earlyByMin: 15,
    status: 'present',
  },
  {
    id: '15',
    employee: 'Siddharth Jain',
    employeeId: 'EMP015',
    department: 'Finance',
    date: '2026-06-12',
    punchIn: '10:30 AM',
    punchOut: '04:30 PM',
    expectedOut: '06:00 PM',
    earlyBy: '1h 30m',
    earlyByMin: 90,
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
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Sales', label: 'Sales' },
  { value: 'HR', label: 'HR' },
  { value: 'Finance', label: 'Finance' },
]

export const employees = [
  { value: 'EMP001', label: 'Amit Sharma (EMP001)' },
  { value: 'EMP002', label: 'Priya Patel (EMP002)' },
  { value: 'EMP003', label: 'Raj Kumar (EMP003)' },
  { value: 'EMP004', label: 'Sneha Reddy (EMP004)' },
  { value: 'EMP005', label: 'Vikram Singh (EMP005)' },
  { value: 'EMP006', label: 'Neha Gupta (EMP006)' },
  { value: 'EMP007', label: 'Arjun Malhotra (EMP007)' },
  { value: 'EMP008', label: 'Kavita Rao (EMP008)' },
  { value: 'EMP009', label: 'Manohar Kumar (EMP009)' },
  { value: 'EMP010', label: 'Divya Shah (EMP010)' },
  { value: 'EMP011', label: 'Rohit Verma (EMP011)' },
  { value: 'EMP012', label: 'Ananya Mishra (EMP012)' },
  { value: 'EMP013', label: 'Karan Patel (EMP013)' },
  { value: 'EMP014', label: 'Meera Nair (EMP014)' },
  { value: 'EMP015', label: 'Siddharth Jain (EMP015)' },
]

export const savedReports = [
  { value: 'last-month', label: 'Last Month Report' },
  { value: 'q1-2026', label: 'Q1 2026 Report' },
  { value: 'this-week', label: 'This Week Report' },
]