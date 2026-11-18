'use client'

/**
 * Task Management's entry point into the generic report builder engine
 * (Docs/reports-engine/PLAN.md, Phase 1 — the proving ground before CRM's
 * 15 categories in Phase 3). Replaces the old flat `TmReports` screen
 * (Productivity/Delays/Learning tabs) with the same folder-based shell
 * every module now shares: Task Reports, Events Report, Assigned Tasks
 * Report, plus "All Reports" and "Shared With Me".
 */

import { ReportsShell } from '@/domain/reports/reports-shell'

export function TmReportsShell() {
  return (
    <ReportsShell
      scope="task_management"
      title="Reports"
      description="Build a report from Tasks, Events or Projects — tabular, summary, pivot or chart."
    />
  )
}
