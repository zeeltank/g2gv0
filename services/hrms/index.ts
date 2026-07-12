/**
 * HRMS Service
 * API calls for HRMS - attendance, leave, and compliance
 */

import { apiClient } from '@/services/core'

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'late' | 'half_day'
}

export interface LeaveRequest {
  id: string
  userId: string
  leaveType: string
  startDate: string
  endDate: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason?: string
  approvedBy?: string
}

export interface LeaveBalance {
  leaveType: string
  total: number
  used: number
  pending: number
  available: number
}

export interface ComplianceItem {
  id: string
  title: string
  category: string
  dueDate?: string
  status: 'compliant' | 'non_compliant' | 'pending'
  assignedTo?: string
}

export const hrmsService = {
  // Attendance
  getAttendanceRecords: (params?: { userId?: string; startDate?: string; endDate?: string }) => 
    apiClient.get<AttendanceRecord[]>('/attendance', params as Record<string, string>),
  checkIn: (userId: string) => apiClient.post<AttendanceRecord>('/attendance/check-in', { userId }),
  checkOut: (userId: string) => apiClient.post<AttendanceRecord>('/attendance/check-out', { userId }),

  // Leave
  getLeaveRequests: (params?: { userId?: string; status?: string }) => 
    apiClient.get<LeaveRequest[]>('/leave-requests', params as Record<string, string>),
  getLeaveRequest: (id: string) => apiClient.get<LeaveRequest>(`/leave-requests/${id}`),
  createLeaveRequest: (data: Partial<LeaveRequest>) => 
    apiClient.post<LeaveRequest>('/leave-requests', data),
  approveLeaveRequest: (id: string, approverId: string) => 
    apiClient.post<LeaveRequest>(`/leave-requests/${id}/approve`, { approverId }),
  rejectLeaveRequest: (id: string, reason: string) => 
    apiClient.post<LeaveRequest>(`/leave-requests/${id}/reject`, { reason }),

  // Leave Balance
  getLeaveBalances: (userId: string) => 
    apiClient.get<LeaveBalance[]>(`/users/${userId}/leave-balances`),

  // Compliance
  getComplianceItems: (params?: { category?: string; status?: string }) => 
    apiClient.get<ComplianceItem[]>('/compliance', params as Record<string, string>),
  updateComplianceStatus: (id: string, status: string) => 
    apiClient.patch<ComplianceItem>(`/compliance/${id}`, { status }),
}
