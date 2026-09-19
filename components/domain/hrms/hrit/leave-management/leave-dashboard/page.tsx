'use client'

import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { useLeaveDashboard, useLeaveRequestDetail } from '@/hooks/use-leave'
import { getCurrentDate, quickActions } from '@/lib/leave-management-data'
import {
  mapActivity,
  mapBalanceSnapshot,
  mapDashboardStats,
  mapDepartmentSummary,
  mapHolidays,
  mapLeaveRequest,
  mapTypeDistribution,
  mapUpcomingLeaves,
} from '@/domain/hrms/hrit/leave-management/services/leave-mappers'
import type { LeaveQuickAction, LeaveRequest } from '@/types/leave-dashboard'

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

// F-181. /api/leave/trend was fetched on every load and thrown away.
const LeaveTrendChart = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-dashboard/components/LeaveTrendChart').then((m) => ({
    default: m.LeaveTrendChart,
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

const LeaveRequestDetailsDrawer = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-requests/components/LeaveRequestDetailsDrawer').then((m) => ({
    default: m.LeaveRequestDetailsDrawer,
  })),
)

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const currentDate = useMemo(() => getCurrentDate(), [])
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    loading,
    processingRequestId,
    error,
    actionError,
    summary,
    // F-181. Fetched, stored and returned by the hook since it was written;
    // this page simply never took it out. The server pads all twelve months
    // so a chart has no gaps - it was built to be drawn.
    trend,
    departments,
    leaveTypes,
    holidays,
    balances,
    pending,
    recent,
    upcoming,
    retry,
    decide,
  } = useLeaveDashboard()

  // F-182. `loading` was dropped here, so the drawer defaulted it to false and
  // ApprovalChain rendered "This request was submitted before approval chains
  // were configured" during every fetch - and permanently if the fetch failed.
  // The prop exists precisely to prevent that claim.
  const { detail, loading: detailLoading } = useLeaveRequestDetail(
    drawerOpen ? selectedRequestId : null,
  )

  const stats = useMemo(() => mapDashboardStats(summary), [summary])
  const departmentData = useMemo(() => mapDepartmentSummary(departments), [departments])
  const leaveTypeData = useMemo(() => mapTypeDistribution(leaveTypes), [leaveTypes])
  const holidayData = useMemo(() => mapHolidays(holidays), [holidays])
  const balanceData = useMemo(() => mapBalanceSnapshot(balances?.leave_types ?? []), [balances])
  const activityData = useMemo(() => mapActivity(summary?.recent_activity ?? []), [summary])
  const pendingRequests = useMemo(() => pending.map(mapLeaveRequest), [pending])
  const recentRequests = useMemo(() => recent.map(mapLeaveRequest), [recent])
  const upcomingLeaves = useMemo(() => mapUpcomingLeaves(upcoming), [upcoming])

  const selectedRequest = useMemo<LeaveRequest | null>(() => {
    if (detail) return mapLeaveRequest(detail)
    return pendingRequests.find((request) => request.id === String(selectedRequestId)) ?? null
  }, [detail, pendingRequests, selectedRequestId])

  const handleViewDetails = useCallback((request: LeaveRequest) => {
    setSelectedRequestId(Number(request.id))
    setDrawerOpen(true)
  }, [])

  /*
   * F-183. One decision path for the card and the drawer, and it KEEPS the
   * result.
   *
   * `decide` returns { ok, message } - the server's own wording, which is more
   * specific than anything worth writing here. The card's call site discarded
   * it, so a successful approval produced no message at all: the row simply
   * vanished. The sibling Leave Requests screen surfaces exactly this and has
   * done since it was built.
   */
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const handleDecision = useCallback(
    async (
      id: number | string,
      status: Parameters<typeof decide>[1],
      remarks?: { hodComment?: string; hrRemarks?: string },
    ) => {
      setActionMessage(null)
      const result = await decide(id, status, remarks)
      if (result.ok) {
        setActionMessage(result.message)
        // The decision is made; the drawer's job is done.
        setDrawerOpen(false)
      }
      return result
    },
    [decide],
  )

  const navigate = useCallback(
    (submenu: string, query = '') => {
      router.push(`/module/hrit-solutions/leave-management/${submenu}${query}`)
    },
    [router],
  )

  const handleQuickAction = useCallback(
    (action: LeaveQuickAction) => {
      const destinations: Record<string, [string, string]> = {
        apply: ['leave-requests', '?apply=1'],
        requests: ['leave-requests', '?mine=1'],
        balance: ['leave-reports', '?report=leave-balance'],
        reports: ['leave-reports', ''],
      }
      const destination = destinations[action.id]
      if (destination) navigate(...destination)
    },
    [navigate],
  )

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load the leave dashboard"
        description={error}
        retry={retry}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-10xl flex-col gap-6">
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {actionMessage && !actionError && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{actionMessage}</span>
            <Button variant="ghost" size="sm" onClick={() => setActionMessage(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Suspense fallback={<Skeleton className="h-16 rounded-2xl" />}>
        <DashboardHeader
          userName={user?.name ?? 'there'}
          currentDate={currentDate}
          upcomingLeaves={upcomingLeaves}
        />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-28 rounded-2xl" />}>
        <DashboardStats stats={stats} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <LeaveTrendChart data={trend} />
      </Suspense>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <DepartmentChart data={departmentData} />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
          <LeaveTypeChart data={leaveTypeData} />
        </Suspense>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <PendingApprovalsCard
            requests={pendingRequests}
            onViewDetails={handleViewDetails}
            onViewAll={() => navigate('leave-requests', '?status=pending')}
            onDecision={(request, status) => void handleDecision(request.id, status)}
            processingRequestId={processingRequestId}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <LeaveBalanceSnapshotCard
            balances={balanceData}
            onViewAll={() => navigate('leave-reports', '?report=leave-balance')}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <HolidayCard
            holidays={holidayData}
            onViewAll={() => navigate('leave-configuration', '?tab=holiday-calendar')}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
          <LeaveQuickActionsCard actions={quickActions} onAction={handleQuickAction} />
        </Suspense>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <RecentLeaveRequests
            requests={recentRequests}
            onView={handleViewDetails}
            onViewAll={() => navigate('leave-requests')}
          />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <RecentActivity activities={activityData} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        {/*
          F-183. onDecision was not passed, and the drawer does NOT gate its
          remark box on it - only its footer. So on this screen an approver
          could open a pending request, type an HR remark, press Save, and have
          nothing happen: no toast, no error, the text still sitting in the box.
          `decide` was in scope the whole time; the card behind the drawer has
          been using it.

          Passing it also restores the Approve / Reject footer here, which was
          missing for the same reason - a read-only drawer in front of a card
          whose own buttons work.
        */}
        <LeaveRequestDetailsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          request={selectedRequest}
          detail={detail}
          loading={detailLoading}
          processing={processingRequestId === selectedRequestId}
          onDecision={(id, status, remarks) => {
            void handleDecision(id, status, remarks)
          }}
        />
      </Suspense>
    </div>
  )
}
