import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

// Phase 1-4 Automation CRM screens
const SignalInboxListView = createLazyComponent(() => import('@/domain/crm/signal-inbox-list-view').then((m) => ({ default: m.SignalInboxListView })))
const OutreachApprovalListView = createLazyComponent(() => import('@/domain/crm/outreach-approval-list-view').then((m) => ({ default: m.OutreachApprovalListView })))
const AgentRunListView = createLazyComponent(() => import('@/domain/crm/agent-run-list-view').then((m) => ({ default: m.AgentRunListView })))
const AutomationRulesListView = createLazyComponent(() => import('@/domain/crm/automation-rules-list-view').then((m) => ({ default: m.AutomationRulesListView })))
const ConsentListView = createLazyComponent(() => import('@/domain/crm/consent-list-view').then((m) => ({ default: m.ConsentListView })))

const LeadListView = createLazyComponent(() => import('@/domain/crm/lead-list-view').then((m) => ({ default: m.LeadListView })))
const OrganizationListView = createLazyComponent(() => import('@/domain/crm/organization-list-view').then((m) => ({ default: m.OrganizationListView })))
const ContactListView = createLazyComponent(() => import('@/domain/crm/contact-list-view').then((m) => ({ default: m.ContactListView })))
const CampaignListView = createLazyComponent(() => import('@/domain/crm/campaign-list-view').then((m) => ({ default: m.CampaignListView })))

// Sales phase. Each of these is a real, working list view screen.
const OpportunityListView = createLazyComponent(() => import('@/domain/crm/opportunity-list-view').then((m) => ({ default: m.OpportunityListView })))
const QuoteListView = createLazyComponent(() => import('@/domain/crm/quote-list-view').then((m) => ({ default: m.QuoteListView })))
const ProductListView = createLazyComponent(() => import('@/domain/crm/product-list-view').then((m) => ({ default: m.ProductListView })))
const ServiceListView = createLazyComponent(() => import('@/domain/crm/service-list-view').then((m) => ({ default: m.ServiceListView })))
const SmsLogListView = createLazyComponent(() => import('@/domain/crm/sms-log-list-view').then((m) => ({ default: m.SmsLogListView })))
const PriceBookListView = createLazyComponent(() => import('@/domain/crm/price-book-list-view').then((m) => ({ default: m.PriceBookListView })))
const SalesOrderListView = createLazyComponent(() => import('@/domain/crm/sales-order-list-view').then((m) => ({ default: m.SalesOrderListView })))
const InvoiceListView = createLazyComponent(() => import('@/domain/crm/invoice-list-view').then((m) => ({ default: m.InvoiceListView })))

// Order-to-cash phase (Vendors/Sales Orders/Purchase Orders/Invoices)
const VendorListView = createLazyComponent(() => import('@/domain/crm/vendor-list-view').then((m) => ({ default: m.VendorListView })))
const PurchaseOrderListView = createLazyComponent(() => import('@/domain/crm/purchase-order-list-view').then((m) => ({ default: m.PurchaseOrderListView })))

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
const SignalInboxView = createLazyComponent(() => import('@/domain/crm/signal-inbox-view').then((m) => ({ default: m.SignalInboxView })))

// Marketing Automation & AI Agent Runs
const AutomationRulesView = createLazyComponent(() => import('@/domain/crm/automation-rules-view').then((m) => ({ default: m.AutomationRulesView })))
const AgentRunsView = createLazyComponent(() => import('@/domain/crm/agent-runs-view').then((m) => ({ default: m.AgentRunsView })))

// Master Fields Admin
const MasterFieldsRoute = createLazyComponent(() => import('@/app/module/crm/master-fields/page').then((m) => ({ default: m.default })))

// GTM Intelligence Modules (Unified Single-Pane)
const CommandCenterView = createLazyComponent(() => import('@/domain/gtm/command-center-view').then((m) => ({ default: m.CommandCenterView })))
const ProspectingView = createLazyComponent(() => import('@/domain/gtm/prospecting-view').then((m) => ({ default: m.ProspectingView })))
const PlaybooksView = createLazyComponent(() => import('@/domain/gtm/playbooks-view').then((m) => ({ default: m.PlaybooksView })))
const CampaignsView = createLazyComponent(() => import('@/domain/gtm/campaigns-view').then((m) => ({ default: m.CampaignsView })))
const OutreachView = createLazyComponent(() => import('@/domain/gtm/outreach-view').then((m) => ({ default: m.OutreachView })))
const ForecastView = createLazyComponent(() => import('@/domain/gtm/forecast-view').then((m) => ({ default: m.ForecastView })))
const CustomersView = createLazyComponent(() => import('@/domain/gtm/customers-view').then((m) => ({ default: m.CustomersView })))
const AgentsView = createLazyComponent(() => import('@/domain/gtm/agents-view').then((m) => ({ default: m.AgentsView })))
const WorkflowsView = createLazyComponent(() => import('@/domain/gtm/workflows-view').then((m) => ({ default: m.WorkflowsView })))
const MonitoringView = createLazyComponent(() => import('@/domain/gtm/monitoring-view').then((m) => ({ default: m.MonitoringView })))

export const CRM_CONTENT: ContentRoute[] = [
  // 1. Command Center
  { accessLink: '/gtm/command-center', component: CommandCenterView },
  { accessLink: '/module/crm/command-center', component: CommandCenterView },

  // 2. Market Signals & Social Listening
  { accessLink: '/module/crm/signals', component: MarketSignalsView },
  { accessLink: '/signals', component: MarketSignalsView },
  { accessLink: '/module/crm/marketing/signal-inbox', component: SignalInboxView },

  // 3. Prospecting & ICP Discovery
  { accessLink: '/gtm/prospecting', component: ProspectingView },
  { accessLink: '/module/crm/prospecting', component: ProspectingView },

  // 4. Playbooks & Sequences
  { accessLink: '/gtm/playbooks', component: PlaybooksView },
  { accessLink: '/module/crm/playbooks', component: PlaybooksView },

  // 5. Account 360 / Organizations
  { accessLink: '/module/crm/marketing/organizations', component: OrganizationListView },

  // 6. Stakeholders & Contacts
  { accessLink: '/module/crm/marketing/contacts', component: ContactListView },

  // 7. Multi-Channel Campaigns (Unified CRM + GTM)
  { accessLink: '/gtm/campaigns', component: CampaignsView },
  { accessLink: '/module/crm/marketing/campaigns', component: CampaignListView },

  // 8. Outreach & Approvals Queue
  { accessLink: '/gtm/outreach', component: OutreachView },
  { accessLink: '/module/crm/marketing/outreach-approvals', component: OutreachApprovalListView },

  // 9. Lead Qualification
  { accessLink: '/module/crm/marketing/leads', component: LeadListView },

  // 10. Automation Rules
  { accessLink: '/module/crm/marketing/automation-rules', component: AutomationRulesView },

  // 11. Opportunities & Deals Pipeline (with AI Coach & MEDDPICC)
  { accessLink: '/module/crm/sales/opportunities', component: OpportunityListView },
  { accessLink: '/gtm/deals', component: OpportunityListView },

  // 12. Revenue Forecasting
  { accessLink: '/gtm/forecast', component: ForecastView },
  { accessLink: '/module/crm/sales/forecast', component: ForecastView },

  // 13. CPQ: Quotes
  { accessLink: '/module/crm/sales/quotes', component: QuoteListView },

  // 14. CPQ: Products Catalog
  { accessLink: '/module/crm/sales/products', component: ProductListView },

  // 15. CPQ: Services Catalog
  { accessLink: '/module/crm/sales/services', component: ServiceListView },

  // 16. CPQ: Price Books
  { accessLink: '/module/crm/sales/price-books', component: PriceBookListView },

  // 17. Billing: Sales Orders
  { accessLink: '/module/crm/sales/sales-orders', component: SalesOrderListView },

  // 18. Billing: Invoices
  { accessLink: '/module/crm/sales/invoices', component: InvoiceListView },

  // 19. Procurement: Vendors
  { accessLink: '/module/crm/sales/vendors', component: VendorListView },

  // 20. Procurement: Purchase Orders
  { accessLink: '/module/crm/sales/purchase-orders', component: PurchaseOrderListView },

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

  // 25. Revenue Workflows Engine
  { accessLink: '/gtm/workflows', component: WorkflowsView },
  { accessLink: '/module/crm/workflows', component: WorkflowsView },

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
  { accessLink: '/module/crm/support/contacts', component: ContactListView },
  { accessLink: '/module/crm/support/sms-notifier', component: SmsLogListView },
]
