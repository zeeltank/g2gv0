import type {
  Activity,
  DashboardStat,
  DashboardUser,
  DepartmentLeaveData,
  EmployeeLeave,
  Holiday,
  LeaveRequest,
  LeaveTrendData,
  LeaveTypeDistribution,
} from '@/types/Leavedashboard'

export const currentUser: DashboardUser = {
  id: 'emp-001',
  name: 'Priya Sharma',
  role: 'HR Manager',
  email: 'priya.sharma@company.com',
}

export const dashboardStats: DashboardStat[] = [
  {
    id: 'total-requests',
    title: 'Total Leave Requests',
    value: 124,
    percentageChange: 12,
    icon: 'clipboard-list',
    tone: 'primary',
  },
  {
    id: 'pending-requests',
    title: 'Pending Requests',
    value: 18,
    percentageChange: -8,
    icon: 'clock',
    tone: 'warning',
  },
  {
    id: 'approved-requests',
    title: 'Approved Requests',
    value: 92,
    percentageChange: 15,
    icon: 'check-circle',
    tone: 'success',
  },
  {
    id: 'rejected-requests',
    title: 'Rejected Requests',
    value: 14,
    percentageChange: -5,
    icon: 'x-circle',
    tone: 'destructive',
  },
  {
    id: 'on-leave-today',
    title: 'Employees on Leave Today',
    value: 8,
    percentageChange: 3,
    icon: 'users',
    tone: 'info',
  },
  {
    id: 'available-balance',
    title: 'Available Leave Balance',
    value: 22,
    suffix: 'days',
    percentageChange: 7,
    icon: 'calendar-days',
    tone: 'muted',
  },
]

export const leaveTrendData: LeaveTrendData[] = [
  { month: 'Jan', requests: 25, approved: 20, rejected: 5 },
  { month: 'Feb', requests: 30, approved: 25, rejected: 5 },
  { month: 'Mar', requests: 28, approved: 22, rejected: 6 },
  { month: 'Apr', requests: 35, approved: 28, rejected: 7 },
  { month: 'May', requests: 32, approved: 26, rejected: 6 },
  { month: 'Jun', requests: 40, approved: 32, rejected: 8 },
  { month: 'Jul', requests: 38, approved: 30, rejected: 8 },
  { month: 'Aug', requests: 42, approved: 35, rejected: 7 },
  { month: 'Sep', requests: 36, approved: 28, rejected: 8 },
  { month: 'Oct', requests: 45, approved: 36, rejected: 9 },
  { month: 'Nov', requests: 40, approved: 32, rejected: 8 },
  { month: 'Dec', requests: 35, approved: 28, rejected: 7 },
]

export const leaveTypeData: LeaveTypeDistribution[] = [
  { name: 'Casual Leave', value: 45, color: '#2563eb' },
  { name: 'Sick Leave', value: 25, color: '#dc2626' },
  { name: 'Earned Leave', value: 30, color: '#16a34a' },
  { name: 'Work From Home', value: 15, color: '#7c3aed' },
  { name: 'Maternity Leave', value: 3, color: '#d97706' },
  { name: 'Paternity Leave', value: 2, color: '#0891b2' },
]

export const departmentLeaveData: DepartmentLeaveData[] = [
  { department: 'Engineering', requests: 45, approved: 35, rejected: 10 },
  { department: 'HR', requests: 20, approved: 18, rejected: 2 },
  { department: 'Sales', requests: 25, approved: 20, rejected: 5 },
  { department: 'Finance', requests: 15, approved: 12, rejected: 3 },
  { department: 'Marketing', requests: 20, approved: 17, rejected: 3 },
  { department: 'Operations', requests: 25, approved: 20, rejected: 5 },
]

export const pendingLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave-001',
    employee: { id: 'emp-002', name: 'Rahul Kumar' },
    department: 'Engineering',
    leaveType: 'Casual Leave',
    duration: '2 days',
    fromDate: '2026-07-08',
    toDate: '2026-07-09',
    appliedDate: '2026-07-01',
    status: 'pending',
    reason: 'Personal work',
  },
  {
    id: 'leave-002',
    employee: { id: 'emp-003', name: 'Sneha Patel' },
    department: 'HR',
    leaveType: 'Sick Leave',
    duration: '1 day',
    fromDate: '2026-07-04',
    toDate: '2026-07-04',
    appliedDate: '2026-07-01',
    status: 'pending',
    reason: 'Medical appointment',
  },
  {
    id: 'leave-003',
    employee: { id: 'emp-004', name: 'Amit Singh' },
    department: 'Sales',
    leaveType: 'Earned Leave',
    duration: '3 days',
    fromDate: '2026-07-15',
    toDate: '2026-07-17',
    appliedDate: '2026-06-29',
    status: 'pending',
    reason: 'Family trip',
  },
  {
    id: 'leave-004',
    employee: { id: 'emp-005', name: 'Neha Gupta' },
    department: 'Finance',
    leaveType: 'Work From Home',
    duration: '1 day',
    fromDate: '2026-07-06',
    toDate: '2026-07-06',
    appliedDate: '2026-06-30',
    status: 'pending',
  },
  {
    id: 'leave-005',
    employee: { id: 'emp-006', name: 'Vikram Reddy' },
    department: 'Marketing',
    leaveType: 'Casual Leave',
    duration: '2 days',
    fromDate: '2026-07-21',
    toDate: '2026-07-22',
    appliedDate: '2026-06-28',
    status: 'pending',
    reason: 'Personal',
  },
]

export const upcomingHolidays: Holiday[] = [
  { id: 'hol-001', name: 'Independence Day', date: '2026-08-15', day: 'Saturday' },
  { id: 'hol-002', name: 'Ganesh Chaturthi', date: '2026-09-14', day: 'Monday' },
  { id: 'hol-003', name: 'Gandhi Jayanti', date: '2026-10-02', day: 'Friday' },
  { id: 'hol-004', name: 'Diwali', date: '2026-11-08', day: 'Sunday' },
]

export const recentActivities: Activity[] = [
  {
    id: 'act-001',
    title: 'Priya applied for Casual Leave',
    description: '2-day request submitted for manager review',
    timestamp: '2 hours ago',
    type: 'application',
  },
  {
    id: 'act-002',
    title: "Rahul's Leave Approved",
    description: 'Earned Leave approved by the reporting manager',
    timestamp: '4 hours ago',
    type: 'approval',
  },
  {
    id: 'act-003',
    title: 'Sneha Leave Rejected',
    description: 'Sick Leave rejected due to insufficient balance',
    timestamp: '1 day ago',
    type: 'rejection',
  },
  {
    id: 'act-004',
    title: 'Manager Approved Earned Leave',
    description: 'Engineering team leave request moved to approved',
    timestamp: '1 day ago',
    type: 'approval',
  },
]

export const upcomingLeaves: EmployeeLeave[] = [
  {
    id: 'upcoming-001',
    employee: 'Amit Singh',
    leaveType: 'Earned Leave',
    fromDate: '2026-07-15',
    toDate: '2026-07-17',
    duration: '3 days',
  },
  {
    id: 'upcoming-002',
    employee: 'Vikram Reddy',
    leaveType: 'Casual Leave',
    fromDate: '2026-07-21',
    toDate: '2026-07-22',
    duration: '2 days',
  },
  {
    id: 'upcoming-003',
    employee: 'Neha Gupta',
    leaveType: 'Work From Home',
    fromDate: '2026-07-06',
    toDate: '2026-07-06',
    duration: '1 day',
  },
  {
    id: 'upcoming-004',
    employee: 'Rajesh Verma',
    leaveType: 'Sick Leave',
    fromDate: '2026-07-24',
    toDate: '2026-07-25',
    duration: '2 days',
  },
]

export const formatDate = (dateString: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))

export const formatDateShort = (dateString: string): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))

export const getCurrentDate = (): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
