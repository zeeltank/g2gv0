'use client'

import { useCallback, useMemo } from 'react'

import { DashboardHeader } from '@/components/leave-managemnt/Leave_managemntHeader'
import { DashboardStats } from '@/components/leave-managemnt/Leave_managemntStats'
import { DepartmentChart } from '@/components/leave-managemnt/Leave_managemntChart'
import { HolidayCard } from '@/components/leave-managemnt/HolidayCard'
import { LeaveTrendChart } from '@/components/leave-managemnt/LeaveTrendChart'
import { LeaveTypeChart } from '@/components/leave-managemnt/LeaveTypeChart'
import { PendingApprovalTable } from '@/components/leave-managemnt/PendingApprovalTable'
import { RecentActivity } from '@/components/leave-managemnt/RecentActivity'
import { UpcomingLeaveCard } from '@/components/leave-managemnt/UpcomingLeaveCard'
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
} from '@/lib/Leavemanagment-data'
import type { LeaveRequest } from '@/types/Leavedashboard'

export default function DashboardPage() {
  const currentDate = useMemo(() => getCurrentDate(), [])

  const handleViewDetails = useCallback((request: LeaveRequest) => {
    console.info('View leave request details', request.id)
  }, [])

  return (
      <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
        <DashboardHeader user={currentUser} currentDate={currentDate} />
        <DashboardStats stats={dashboardStats} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <LeaveTrendChart data={leaveTrendData} />
          <LeaveTypeChart data={leaveTypeData} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.55fr)]">
          <DepartmentChart data={departmentLeaveData} />
          <UpcomingLeaveCard leaves={upcomingLeaves} />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <HolidayCard holidays={upcomingHolidays} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <PendingApprovalTable requests={pendingLeaveRequests} onViewDetails={handleViewDetails} />
          <RecentActivity activities={recentActivities} />
        </section>
      </div>
  )
}
