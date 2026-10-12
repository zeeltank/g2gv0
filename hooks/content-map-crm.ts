import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const LeadListView = createLazyComponent(() => import('@/domain/crm/lead-list-view').then((m) => ({ default: m.LeadListView })))
const OrganizationListView = createLazyComponent(() => import('@/domain/crm/organization-list-view').then((m) => ({ default: m.OrganizationListView })))
const ContactListView = createLazyComponent(() => import('@/domain/crm/contact-list-view').then((m) => ({ default: m.ContactListView })))
const CampaignListView = createLazyComponent(() => import('@/domain/crm/campaign-list-view').then((m) => ({ default: m.CampaignListView })))

// Sales phase. Each of these 5 is a real, working "coming soon" screen today
// (components/domain/crm/coming-soon-view.tsx) - not a broken route - and
// gets replaced file-by-file as each phase ships its real list view, without
// ever touching this registration (same import path, same export name).
const OpportunityListView = createLazyComponent(() => import('@/domain/crm/opportunity-list-view').then((m) => ({ default: m.OpportunityListView })))
const QuoteListView = createLazyComponent(() => import('@/domain/crm/quote-list-view').then((m) => ({ default: m.QuoteListView })))
const ProductListView = createLazyComponent(() => import('@/domain/crm/product-list-view').then((m) => ({ default: m.ProductListView })))
const ServiceListView = createLazyComponent(() => import('@/domain/crm/service-list-view').then((m) => ({ default: m.ServiceListView })))
const SmsLogListView = createLazyComponent(() => import('@/domain/crm/sms-log-list-view').then((m) => ({ default: m.SmsLogListView })))
const PriceBookListView = createLazyComponent(() => import('@/domain/crm/price-book-list-view').then((m) => ({ default: m.PriceBookListView })))
const SalesOrderListView = createLazyComponent(() => import('@/domain/crm/sales-order-list-view').then((m) => ({ default: m.SalesOrderListView })))
const InvoiceListView = createLazyComponent(() => import('@/domain/crm/invoice-list-view').then((m) => ({ default: m.InvoiceListView })))

// Order-to-cash phase (Vendors/Sales Orders/Purchase Orders/Invoices) - same
// "coming soon until its own phase ships" convention as the Sales phase
// list views above.
const VendorListView = createLazyComponent(() => import('@/domain/crm/vendor-list-view').then((m) => ({ default: m.VendorListView })))
const PurchaseOrderListView = createLazyComponent(() => import('@/domain/crm/purchase-order-list-view').then((m) => ({ default: m.PurchaseOrderListView })))

// CRM (module id 199) was a disabled, never-finished menu tree reactivated
// for this migration - access_links are nested under /marketing/ (not the
// flat 2-segment convention Task Management uses), matching that tree's own
// pre-existing shape. Grows entry-by-entry as each module ships its own
// phase, same as content-map-m6.ts did for Task Management.
export const CRM_CONTENT: ContentRoute[] = [
  { accessLink: '/module/crm/marketing/leads', component: LeadListView },
  { accessLink: '/module/crm/marketing/organizations', component: OrganizationListView },
  { accessLink: '/module/crm/marketing/contacts', component: ContactListView },
  { accessLink: '/module/crm/marketing/campaigns', component: CampaignListView },
  { accessLink: '/module/crm/sales/opportunities', component: OpportunityListView },
  { accessLink: '/module/crm/sales/quotes', component: QuoteListView },
  { accessLink: '/module/crm/sales/products', component: ProductListView },
  { accessLink: '/module/crm/sales/services', component: ServiceListView },
  { accessLink: '/module/crm/sales/sms-notifier', component: SmsLogListView },
  { accessLink: '/module/crm/sales/price-books', component: PriceBookListView },
  { accessLink: '/module/crm/sales/vendors', component: VendorListView },
  { accessLink: '/module/crm/sales/sales-orders', component: SalesOrderListView },
  { accessLink: '/module/crm/sales/invoices', component: InvoiceListView },
  { accessLink: '/module/crm/sales/purchase-orders', component: PurchaseOrderListView },
]
