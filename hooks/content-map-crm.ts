import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LeadListView = createLazyComponent(() => import('@/domain/crm/lead-list-view').then((m) => ({ default: m.LeadListView })))

// CRM (module id 199) was a disabled, never-finished menu tree reactivated
// for this migration - access_links are nested under /marketing/ (not the
// flat 2-segment convention Task Management uses), matching that tree's own
// pre-existing shape. Grows entry-by-entry as each module (Contacts,
// Organizations, Campaigns) ships its own phase, same as content-map-m6.ts
// did for Task Management.
export const CRM_CONTENT: ContentRoute[] = [
  { accessLink: '/module/crm/marketing/leads', component: LeadListView },
]
