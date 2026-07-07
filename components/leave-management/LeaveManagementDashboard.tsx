'use client'

import { useCallback, useMemo } from 'react'

import { DashboardHeader } from '@/components/leave-management/LeaveManagementHeader'
import { DashboardStats } from '@/components/leave-management/LeaveManagementStats'
import { DepartmentChart } from '@/components/leave-management/LeaveManagementChart'
import { HolidayCard } from '@/components/leave-management/HolidayCard'
import { LeaveTypeChart } from '@/components/leave-management/LeaveTypeChart'
import { PendingApprovalsCard } from '@/components/leave-management/PendingApprovalCard'
import { RecentActivity } from '@/components/leave-management/RecentActivity'
import { RecentLeaveRequests } from '@/components/leave-management/RecentLeaveRequests'
import { LeaveBalanceSnapshotCard } from '@/components/leave-management/LeaveBalanceSnapshot'
import { LeaveQuickActionsCard } from '@/components/leave-management/LeaveQuickActionsCard'
import {
  currentUser,
  dashboardStats,
  departmentLeaveData,
  getCurrentDate,
  leaveTrendData,
  leaveTypeData,
  pendingLeaveRequests,
  recentActivities,
  recentLeaveRequests,
  upcomingHolidays,
  upcomingLeaves,
  leaveBalances,
  quickActions,
} from '@/lib/leave-management-data'
import type { LeaveRequest } from '@/types/Leavedashboard'

export default function DashboardPage() {
  const currentDate = useMemo(() => getCurrentDate(), [])

  const handleViewDetails = useCallback((request: LeaveRequest) => {
    console.info('View leave request details', request.id)
  }, [])

  return (
      <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      <DashboardHeader userName={currentUser.name} currentDate={currentDate} upcomingLeaves={upcomingLeaves} />
        <DashboardStats stats={dashboardStats} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <DepartmentChart data={departmentLeaveData} />
          <LeaveTypeChart data={leaveTypeData} />
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <PendingApprovalsCard requests={pendingLeaveRequests} onViewDetails={handleViewDetails} />
          <LeaveBalanceSnapshotCard balances={leaveBalances} />
          <HolidayCard holidays={upcomingHolidays} />
          <LeaveQuickActionsCard actions={quickActions} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <RecentLeaveRequests requests={recentLeaveRequests} />
          <RecentActivity activities={recentActivities} />
        </section>
      </div>
  )
}
