'use client'

import { lazy, Suspense, useCallback, useMemo } from 'react'

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

const DashboardHeader = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/DashboardHeader').then((m) => ({
    default: m.DashboardHeader,
  })),
)

const DashboardStats = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/DashboardStats').then((m) => ({
    default: m.DashboardStats,
  })),
)

const DepartmentChart = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/DepartmentChart').then((m) => ({
    default: m.DepartmentChart,
  })),
)

const HolidayCard = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/HolidayCard').then((m) => ({
    default: m.HolidayCard,
  })),
)

const LeaveTypeChart = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/LeaveTypeChart').then((m) => ({
    default: m.LeaveTypeChart,
  })),
)

const PendingApprovalsCard = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/PendingApprovalCard').then((m) => ({
    default: m.PendingApprovalsCard,
  })),
)

const RecentActivity = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/RecentActivity').then((m) => ({
    default: m.RecentActivity,
  })),
)

const RecentLeaveRequests = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/RecentLeaveRequests').then((m) => ({
    default: m.RecentLeaveRequests,
  })),
)

const LeaveBalanceSnapshotCard = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/LeaveBalanceSnapshot').then((m) => ({
    default: m.LeaveBalanceSnapshotCard,
  })),
)

const LeaveQuickActionsCard = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/LeaveQuickActionsCard').then((m) => ({
    default: m.LeaveQuickActionsCard,
  })),
)

export default function DashboardPage() {
  const currentDate = useMemo(() => getCurrentDate(), [])

  const handleViewDetails = useCallback((request: LeaveRequest) => {
    console.info('View leave request details', request.id)
  }, [])

  return (
      <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      <Suspense fallback={<div className="h-16 rounded-2xl bg-muted/40" />}>
        <DashboardHeader userName={currentUser.name} currentDate={currentDate} upcomingLeaves={upcomingLeaves} />
      </Suspense>

      <Suspense fallback={<div className="h-28 rounded-2xl bg-muted/40" />}>
        <DashboardStats stats={dashboardStats} />
      </Suspense>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Suspense fallback={<div className="h-80 rounded-2xl bg-muted/40" />}>
          <DepartmentChart data={departmentLeaveData} />
        </Suspense>
        <Suspense fallback={<div className="h-80 rounded-2xl bg-muted/40" />}>
          <LeaveTypeChart data={leaveTypeData} />
        </Suspense>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<div className="h-64 rounded-2xl bg-muted/40" />}>
          <PendingApprovalsCard requests={pendingLeaveRequests} onViewDetails={handleViewDetails} />
        </Suspense>
        <Suspense fallback={<div className="h-64 rounded-2xl bg-muted/40" />}>
          <LeaveBalanceSnapshotCard balances={leaveBalances} />
        </Suspense>
        <Suspense fallback={<div className="h-64 rounded-2xl bg-muted/40" />}>
          <HolidayCard holidays={upcomingHolidays} />
        </Suspense>
        <Suspense fallback={<div className="h-64 rounded-2xl bg-muted/40" />}>
          <LeaveQuickActionsCard actions={quickActions} />
        </Suspense>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <RecentLeaveRequests requests={recentLeaveRequests} />
        </Suspense>
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          <RecentActivity activities={recentActivities} />
        </Suspense>
      </section>
      </div>
  )
}
