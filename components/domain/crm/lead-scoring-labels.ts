/**
 * Shared display labels for lead scoring rules - used by the admin builder
 * (crm-lead-routing-admin.tsx) and the lead detail page's score
 * explainability breakdown, so the two never drift apart on wording.
 */

import type { CrmLeadScoringField, CrmLeadScoringOperator } from '@/types/crm'

export const LEAD_SCORING_FIELD_LABEL: Record<CrmLeadScoringField, string> = {
  lead_source: 'Lead Source', industry: 'Industry', country: 'Country', rating: 'Rating',
  lead_status: 'Lead Status', annual_revenue: 'Annual Revenue', number_of_emp: 'Number of Employees',
}

export const LEAD_SCORING_OPERATOR_LABEL: Record<CrmLeadScoringOperator, string> = {
  equals: 'is', not_equals: 'is not', contains: 'contains', is_not_empty: 'is set (any value)',
  greater_than: 'is greater than', less_than: 'is less than',
}
