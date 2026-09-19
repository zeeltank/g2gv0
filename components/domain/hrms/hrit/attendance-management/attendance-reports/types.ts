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
  /**
   * F-179. The row's position in the current page, 1-based.
   *
   * The '#' column used to render `id` - the hrms_attendances primary key -
   * which reads as a broken counter (1447, 1452, 1461...). Optional because it
   * is assigned at render time, where the page offset is known.
   */
  rowNumber?: number
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
