import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LeadListView = createLazyComponent(() => import('@/domain/crm/lead-list-view').then((m) => ({ default: m.LeadListView })))
const OrganizationListView = createLazyComponent(() => import('@/domain/crm/organization-list-view').then((m) => ({ default: m.OrganizationListView })))
const ContactListView = createLazyComponent(() => import('@/domain/crm/contact-list-view').then((m) => ({ default: m.ContactListView })))

// CRM (module id 199) was a disabled, never-finished menu tree reactivated
// for this migration - access_links are nested under /marketing/ (not the
// flat 2-segment convention Task Management uses), matching that tree's own
// pre-existing shape. Grows entry-by-entry as each module (Campaigns still
// pending) ships its own phase, same as content-map-m6.ts did for Task
// Management.
export const CRM_CONTENT: ContentRoute[] = [
  { accessLink: '/module/crm/marketing/leads', component: LeadListView },
  { accessLink: '/module/crm/marketing/organizations', component: OrganizationListView },
  { accessLink: '/module/crm/marketing/contacts', component: ContactListView },
]
