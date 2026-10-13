'use client'

/**
 * CRM's entry point into the generic report builder engine
 * (Docs/reports-engine/PLAN.md, Phase 3) — a new, top-level menu item
 * (/module/crm/reports), sibling to Marketing/Sales/Support, matching the
 * real vtiger reference's own top-level Reports tab. Deliberately a
 * different screen from the pre-existing /module/crm/support/reports AI
 * Stack screen (CrmReportsView) — that one is untouched, admin-curated,
 * template reports; this is the full generic builder (folders, arbitrary
 * columns/filters/grouping, tabular/summary/pivot/chart).
 */

import { ReportsShell } from '@/domain/reports/reports-shell'

export function CrmReportsShell() {
  return (
    <ReportsShell
      scope="crm"
      title="Reports"
      description="Build a report from Leads, Organizations, Contacts, Opportunities, Quotes, Orders, Tickets and more — tabular, summary, pivot or chart."
    />
  )
}
