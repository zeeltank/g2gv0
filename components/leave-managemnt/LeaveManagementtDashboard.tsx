'use client'

import { useCallback, useMemo } from 'react'

import { DashboardHeader } from '@/components/leave-managemnt/Leave_managemntHeader'
import { DashboardStats } from '@/components/leave-managemnt/Leave_managemntStats'
import { DepartmentChart } from '@/components/leave-managemnt/Leave_managemntChart'
import { HolidayCard } from '@/components/leave-managemnt/HolidayCard'
import { LeaveTypeChart } from '@/components/leave-managemnt/LeaveTypeChart'
import { PendingApprovalsCard } from '@/components/leave-managemnt/PendingApprovalCard'
import { RecentActivity } from '@/components/leave-managemnt/RecentActivity'
import { LeaveBalanceSnapshotCard } from '@/components/leave-managemnt/LeaveBalanceSnapshot'
import { LeaveQuickActionsCard } from '@/components/leave-managemnt/LeaveQuickActionsCard'
import {
  currentUser,
  dashboardStats,
  departmentLeaveData,
  getCurrentDate,
  leaveTrendData,
  leaveTypeData,
  pendingLeaveRequests,
  recentActivities,
  upcomingHolidays,
  upcomingLeaves,
  leaveBalances,
  quickActions,
} from '@/lib/Leavemanagment-data'
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <RecentActivity activities={recentActivities} />
        </section>
      </div>
  )
}
