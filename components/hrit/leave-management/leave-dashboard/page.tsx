'use client'

import { useCallback, useMemo } from 'react'

import { DashboardHeader } from '@/components/hrit/leave-management/leave-dashboard/components/DashboardHeader'                        
import { DashboardStats } from '@/components/hrit/leave-management/leave-dashboard/components/DashboardStats'
import { DepartmentChart } from '@/components/hrit/leave-management/leave-dashboard/components/DepartmentChart'
import { HolidayCard } from '@/components/hrit/leave-management/leave-dashboard/components/HolidayCard'
import { LeaveTypeChart } from '@/components/hrit/leave-management/leave-dashboard/components/LeaveTypeChart'
import { PendingApprovalsCard } from '@/components/hrit/leave-management/leave-dashboard/components/PendingApprovalCard'
import { RecentActivity } from '@/components/hrit/leave-management/leave-dashboard/components/RecentActivity'
import { RecentLeaveRequests } from '@/components/hrit/leave-management/leave-dashboard/components/RecentLeaveRequests'
import { LeaveBalanceSnapshotCard } from '@/components/hrit/leave-management/leave-dashboard/components/LeaveBalanceSnapshot'
import { LeaveQuickActionsCard } from '@/components/hrit/leave-management/leave-dashboard/components/LeaveQuickActionsCard'
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
import type { LeaveRequest } from '@/types/leave-dashboard'

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
