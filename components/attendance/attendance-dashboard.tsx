'use client'

import * as React from 'react'
import { TodayStatusCard } from './today-status-card'
import { TodaySummaryCard } from './today-summary-card'
import { MonthlySummaryCard } from './monthly-summary-card'
import { UpcomingEventsCard } from './upcoming-events-card'
import { LeaveBalanceCard } from './leave-balance-card'
import { RecentAttendanceCard } from './recent-attendance-card'
import { AttendanceCalendarDrawer } from './attendance-calendar-drawer'
import { AttendanceHistoryDrawer } from './attendance-history-drawer'
import { LeaveBalanceModal } from './leave-balance-modal'
import { EventDetailsDrawer } from './event-details-drawer'
import { useAttendance } from './use-attendance'

export function AttendanceDashboard() {
  const { loading, processing, error, todayRecord, monthlySummary, leaveBalance, upcomingEvents, attendanceHistory, punch, retry } = useAttendance()
  
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = React.useState(false)
  const [eventsOpen, setEventsOpen] = React.useState(false)

  const handlePunch = (action: 'in' | 'out') => {
    punch(action)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-2 space-y-6">
          <TodayStatusCard
            record={todayRecord || null}
            loading={loading}
            processing={processing}
            error={error || null}
            onPunch={handlePunch}
            // onRetry={retry}
          />
       
           <LeaveBalanceCard
            balance={leaveBalance || null}
            loading={loading}
            onViewBalance={() => setLeaveModalOpen(true)}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <MonthlySummaryCard
            summary={monthlySummary || null}
            loading={loading}
            onViewCalendar={() => setCalendarOpen(true)}
          />
             <TodaySummaryCard
            record={todayRecord || null}
            loading={loading}
          />
         
        </div>
      </div>

      <UpcomingEventsCard
        events={upcomingEvents}
        loading={loading}
        onViewEvents={() => setEventsOpen(true)}
      />

      <RecentAttendanceCard
        records={attendanceHistory}
        loading={loading}
        onViewAll={() => setHistoryOpen(true)}
      />

      <AttendanceCalendarDrawer
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        records={attendanceHistory}
        monthlySummary={monthlySummary}
      />

      <AttendanceHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        records={attendanceHistory}
        loading={loading}
      />

      <LeaveBalanceModal
        open={leaveModalOpen}
        onOpenChange={setLeaveModalOpen}
        balance={leaveBalance || null}
        loading={loading}
      />

      <EventDetailsDrawer
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        events={upcomingEvents}
      />
    </div>
  )
}