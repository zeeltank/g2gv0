'use client'

export { AttendanceCalendarDrawer } from './attendance-calendar-drawer'
export { AttendanceDonutChart } from './attendance-donut-chart'
export { AttendanceDrillDownDrawer } from './attendance-drill-down-drawer'
/*
 * AttendanceFilters (./attendance-filters) was DELETED in HRIT Sprint 3.
 *
 * It was the earlier generation of EnhancedAttendanceFilters — same control,
 * same props, plus the "Saved Reports" dropdown that F-99 removed. It was
 * exported from this barrel and imported by NOTHING: the only consumer,
 * attendance-reports/page.tsx, uses EnhancedAttendanceFilters.
 *
 * Two generations of one idea living side by side is the drift risk §E.0 of the
 * audit calls out; the unused one goes rather than being left to be picked up
 * by accident.
 */
export { AttendanceGroupedTable } from './attendance-grouped-table'
export { AttendanceHighlights } from './attendance-highlights'
export { AttendanceKPICards as AttendanceKpiCards } from './attendance-kpi-cards'
export { AttendanceKPICards } from './attendance-kpi-cards'
export { AttendanceSummaryCards } from './attendance-summary-cards'
export { TableToolbar as AttendanceTableToolbar } from './attendance-table-toolbar'
export { AttendanceTabs } from './attendance-tabs'
export { AttendanceTrendChart } from './attendance-trend-chart'
export { EnhancedAttendanceFilters } from './enhanced-attendance-filters'
export { EventDetailsDrawer } from './event-details-drawer'
export { LeaveBalanceCard } from './leave-balance-card'
export { LeaveBalanceModal } from './leave-balance-modal'
export { MonthlySummaryCard } from './monthly-summary-card'
export { RecentAttendanceCard } from './recent-attendance-card'
export { TodayStatusCard } from './today-status-card'
export { TodaySummaryCard } from './today-summary-card'
export { UpcomingEventsCard } from './upcoming-events-card'
