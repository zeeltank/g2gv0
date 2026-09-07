/**
 * Types for the Attendance Reports screen.
 *
 * Replaces `services/report-data.ts`, which held these types plus four fixture
 * datasets (F-119): `earlyGoingMockData`, `departmentReportMockData`,
 * `employeeReportMockData` and a `savedReports` list that was rendered into the
 * live filter bar. The three datasets had no importer; `savedReports` did, and
 * selecting one called `console.log` (F-99).
 *
 * The file is gone. Types live here, where nothing can accidentally import a
 * fixture beside them.
 */

export interface EarlyGoingRecord {
  id: string
  employee: string
  employeeId: string
  department: string
  date: string
  punchIn: string
  punchOut: string
  expectedOut: string
  earlyBy: string
  earlyByMin: number
  status: 'present' | 'late' | 'absent'
}
