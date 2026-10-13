'use client'

/**
 * CRM's entry point into the already-built, generic AI Stack Reports engine
 * (Templates tab) — not a new report system. `ModuleAiStackConsole` already
 * works for any module id purely from the route; this just gives it a real,
 * menu-rights-gated home under Support instead of only being reachable by
 * typing `/module/199/ai-stack` directly.
 *
 * `moduleId="199"` is CRM's own `tblmenumaster_g2g` root id - the same
 * constant every CRM menu-seeding migration this session uses, confirmed
 * stable. Reports built here read from `crm.leads_by_status`,
 * `crm.opportunities_by_stage`, `crm.tickets_by_status_and_priority`,
 * `crm.revenue_by_month_from_invoices`, and `crm.service_contract_utilization`
 * (ModuleDataSourceCatalog.php) - deterministic, tabular, admin-curated, not
 * generative - see the gap-closure plan's own Decision 6 for why.
 */

import { ModuleAiStackConsole } from '@/components/ai-stack/module-ai-stack-console'

const CRM_MENU_ID = '199'

export function CrmReportsView() {
  return <ModuleAiStackConsole moduleId={CRM_MENU_ID} />
}
