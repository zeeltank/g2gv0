import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

// Phase 1-4 Automation CRM screens
const SignalInboxListView = createLazyComponent(() => import('@/domain/crm/signal-inbox-list-view').then((m) => ({ default: m.SignalInboxListView })))
const OutreachApprovalListView = createLazyComponent(() => import('@/domain/crm/outreach-approval-list-view').then((m) => ({ default: m.OutreachApprovalListView })))
const AgentRunListView = createLazyComponent(() => import('@/domain/crm/agent-run-list-view').then((m) => ({ default: m.AgentRunListView })))
const ConsentListView = createLazyComponent(() => import('@/domain/crm/consent-list-view').then((m) => ({ default: m.ConsentListView })))

const LeadListView = createLazyComponent(() => import('@/domain/crm/lead-list-view').then((m) => ({ default: m.LeadListView })))
const OrganizationListView = createLazyComponent(() => import('@/domain/crm/organization-list-view').then((m) => ({ default: m.OrganizationListView })))
const CampaignListView = createLazyComponent(() => import('@/domain/crm/campaign-list-view').then((m) => ({ default: m.CampaignListView })))

// Sales phase. Each of these is a real, working list view screen.
const OpportunityListView = createLazyComponent(() => import('@/domain/crm/opportunity-list-view').then((m) => ({ default: m.OpportunityListView })))
const QuoteListView = createLazyComponent(() => import('@/domain/crm/quote-list-view').then((m) => ({ default: m.QuoteListView })))
const SmsLogListView = createLazyComponent(() => import('@/domain/crm/sms-log-list-view').then((m) => ({ default: m.SmsLogListView })))
const SalesOrderListView = createLazyComponent(() => import('@/domain/crm/sales-order-list-view').then((m) => ({ default: m.SalesOrderListView })))
const InvoiceListView = createLazyComponent(() => import('@/domain/crm/invoice-list-view').then((m) => ({ default: m.InvoiceListView })))

// Support phase (Tickets/FAQ/Service Contracts/Assets)
const AssetListView = createLazyComponent(() => import('@/domain/crm/asset-list-view').then((m) => ({ default: m.AssetListView })))
const TicketListView = createLazyComponent(() => import('@/domain/crm/ticket-list-view').then((m) => ({ default: m.TicketListView })))
const FaqListView = createLazyComponent(() => import('@/domain/crm/faq-list-view').then((m) => ({ default: m.FaqListView })))
const ServiceContractListView = createLazyComponent(() => import('@/domain/crm/service-contract-list-view').then((m) => ({ default: m.ServiceContractListView })))

// Email Templates admin library
const EmailTemplateListView = createLazyComponent(() => import('@/domain/crm/email-template-list-view').then((m) => ({ default: m.EmailTemplateListView })))

// Reports entry points
const CrmReportsView = createLazyComponent(() => import('@/domain/crm/crm-reports-view').then((m) => ({ default: m.CrmReportsView })))
const CrmReportsShell = createLazyComponent(() => import('@/domain/crm/crm-reports-shell').then((m) => ({ default: m.CrmReportsShell })))

// Market Signals & Intelligence
const MarketSignalsView = createLazyComponent(() => import('@/domain/crm/market-signals-view').then((m) => ({ default: m.MarketSignalsView })))

// AI Agent Runs
const AgentRunsView = createLazyComponent(() => import('@/domain/crm/agent-runs-view').then((m) => ({ default: m.AgentRunsView })))

// Master Fields Admin
const MasterFieldsRoute = createLazyComponent(() => import('@/app/module/crm/master-fields/page').then((m) => ({ default: m.default })))

// GTM Intelligence Modules (Unified Single-Pane)
const CommandCenterView = createLazyComponent(() => import('@/domain/gtm/command-center-view').then((m) => ({ default: m.CommandCenterView })))
const PlaybooksView = createLazyComponent(() => import('@/domain/gtm/playbooks-view').then((m) => ({ default: m.PlaybooksView })))
const CampaignsView = createLazyComponent(() => import('@/domain/gtm/campaigns-view').then((m) => ({ default: m.CampaignsView })))
const OutreachView = createLazyComponent(() => import('@/domain/gtm/outreach-view').then((m) => ({ default: m.OutreachView })))
const CustomersView = createLazyComponent(() => import('@/domain/gtm/customers-view').then((m) => ({ default: m.CustomersView })))
const AgentsView = createLazyComponent(() => import('@/domain/gtm/agents-view').then((m) => ({ default: m.AgentsView })))
const MonitoringView = createLazyComponent(() => import('@/domain/gtm/monitoring-view').then((m) => ({ default: m.MonitoringView })))

export const CRM_CONTENT: ContentRoute[] = [
  // 1. Command Center
  { accessLink: '/gtm/command-center', component: CommandCenterView },
  { accessLink: '/module/crm/command-center', component: CommandCenterView },

  // 2. Market Signals & Social Listening
  { accessLink: '/module/crm/signals', component: MarketSignalsView },
  { accessLink: '/signals', component: MarketSignalsView },
  // Signal Review has no entry here any more: it was merged into Company Opportunities (13 Nov 2026). Its two old addresses are redirect pages under app/, which send
  // a visitor to /signals with the query kept; the menu row stays in the database and the sidebar hides it in code (lib/signals-nav.ts).
  { accessLink: '/module/crm/marketing/signal-inbox', component: MarketSignalsView },

  // 4. Playbooks & Sequences
  { accessLink: '/gtm/playbooks', component: PlaybooksView },
  { accessLink: '/module/crm/playbooks', component: PlaybooksView },

  // 5. Account 360 / Organizations
  { accessLink: '/module/crm/marketing/organizations', component: OrganizationListView },

  // 6. Contacts were merged into Organizations (S18, 25 Nov 2026): a person is a tab of a company (People) and a scope of the Organizations list (All people). The two old
  // Contacts addresses, with their detail pages, are redirect pages under app/module/crm/{marketing,support}/contacts, so nothing is mapped here.

  // 7. Multi-Channel Campaigns (Unified CRM + GTM)
  { accessLink: '/gtm/campaigns', component: CampaignsView },
  { accessLink: '/module/crm/marketing/campaigns', component: CampaignListView },

  // 8. Outreach & Approvals Queue
  { accessLink: '/gtm/outreach', component: OutreachView },
  { accessLink: '/module/crm/marketing/outreach-approvals', component: OutreachApprovalListView },

  // 9. Lead Qualification
  { accessLink: '/module/crm/marketing/leads', component: LeadListView },

  // 10. Automation Rules were merged into the Automations tab of the Workflows page in Platform Services (26 Nov 2026): the saved rules were never run by anything. The
  // old address is a redirect page under app/module/crm/marketing, so nothing is mapped here.

  // 11. Opportunities & Deals Pipeline (with AI Coach & MEDDPICC)
  { accessLink: '/module/crm/sales/opportunities', component: OpportunityListView },
  { accessLink: '/gtm/deals', component: OpportunityListView },

  // 13. CPQ: Quotes
  { accessLink: '/module/crm/sales/quotes', component: QuoteListView },

  // 14 and 15. Products and Services were merged into the Product Portfolio (/portfolio) on 13 Nov 2026 (owner decision, slice 15). Their old addresses, with
  // their detail and line pages, are redirect pages under app/module/crm/sales, so nothing is mapped here.

  // 16. CPQ: Price Books were removed (S16, 25 Nov 2026): a Sub-product holds its own price. The old address is a redirect page under app/module/crm/sales, so nothing is mapped here.

  // 17. Billing: Sales Orders
  { accessLink: '/module/crm/sales/sales-orders', component: SalesOrderListView },

  // 18. Billing: Invoices
  { accessLink: '/module/crm/sales/invoices', component: InvoiceListView },

  // 21. Customer Success & Renewals
  { accessLink: '/gtm/customers', component: CustomersView },
  { accessLink: '/module/crm/customers', component: CustomersView },

  // 22. SMS Notification Logs
  { accessLink: '/module/crm/sales/sms-notifier', component: SmsLogListView },

  // 23. Autonomous AI Agents Hub
  { accessLink: '/gtm/agents', component: AgentsView },
  { accessLink: '/module/crm/agents', component: AgentsView },

  // 24. AI Agent Run History & Telemetry
  { accessLink: '/module/crm/marketing/agent-runs', component: AgentRunsView },

  // 25. The Revenue Workflows engine is the Automations and Runs tabs of the Workflows page in Platform Services (26 Nov 2026). The old GTM address is a redirect page
  // under app/gtm/workflows, so nothing is mapped here.

  // 26. Unified Reports & Governance
  { accessLink: '/module/crm/reports', component: CrmReportsShell },
  { accessLink: '/gtm/reports', component: CrmReportsShell },
  { accessLink: '/module/crm/support/reports', component: CrmReportsView },

  // 27. Monitoring & Telemetry
  { accessLink: '/gtm/monitoring', component: MonitoringView },
  { accessLink: '/module/crm/monitoring', component: MonitoringView },

  // 28. Governance: Master Fields Admin
  { accessLink: '/module/crm/master-fields', component: MasterFieldsRoute },

  // Fallback for legacy Consent link
  { accessLink: '/module/crm/marketing/consent', component: ConsentListView },

  // Support Cross-Links
  { accessLink: '/module/crm/support/assets', component: AssetListView },
  { accessLink: '/module/crm/support/tickets', component: TicketListView },
  { accessLink: '/module/crm/support/faq', component: FaqListView },
  { accessLink: '/module/crm/support/service-contracts', component: ServiceContractListView },
  { accessLink: '/module/crm/support/email-templates', component: EmailTemplateListView },
  { accessLink: '/module/crm/support/organizations', component: OrganizationListView },
  { accessLink: '/module/crm/support/sms-notifier', component: SmsLogListView },
]
