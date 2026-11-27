/**
 * The coverage registry: EVERY functionality of the source-derived coverage matrix (G2G_Intelligence_Coverage_Matrix.md, section 3.1 to 3.9), 132 rows, each
 * with the module that owns it, its matrix id, its name, the screen that serves it (only a route verified to exist, otherwise null) and its coverage state:
 *
 *   partial       a detector assesses a slice of it (the detector ids are listed); NEVER "covered": every detector looks at a narrow slice
 *   not_assessed  no detector exists. This says nothing about whether data exists
 *   excluded      owner decision D2: payroll, compensation, individual performance, disciplinary and offboarding are kept out of Intelligence entirely
 *                 (no metrics, no links, no aggregates, no summaries) pending separate approval and security review
 *
 * The module pages render this list so that no functionality is silently absent. Ownership follows the actual parent module and route (D4): every row
 * belongs to exactly one module, and a detector-backed area belongs to exactly one module (see modules.ts).
 *
 * Detectors prefixed `platform.` / `agentic.` are new and are named by contract with the backend; until the server reports one of them the row is shown as
 * "not yet assessed" (see displayState), never as covered.
 */
import { areaById } from './domains'
import { MODULE_INTELLIGENCE, type ModuleIntelligenceKey } from './modules'

export type RegistryState = 'partial' | 'not_assessed' | 'excluded'

export interface CoverageRow {
  module: ModuleIntelligenceKey
  id: string
  name: string
  /** A route verified to exist (checked by coverage-registry.test.ts), or null. An excluded row never has one. */
  route: string | null
  state: RegistryState
  /** Detector ids that assess a slice of it (partial rows only). */
  detectors: readonly string[]
}

type M = ModuleIntelligenceKey
const row = (module: M, id: string, name: string, route: string | null, state: RegistryState = 'not_assessed', detectors: readonly string[] = []): CoverageRow => ({ module, id, name, route, state, detectors })
const partial = (module: M, id: string, name: string, route: string | null, ...detectors: string[]): CoverageRow => row(module, id, name, route, 'partial', detectors)
const excluded = (module: M, id: string, name: string): CoverageRow => row(module, id, name, null, 'excluded')

const ORG = '/module/organizational-management'
const HRIT = '/module/hrit-solutions'
const TAL = '/module/talent-management'
const LMS = '/module/lms'
const CAP = '/module/capability-intelligence'
const TASK = '/module/task-management'
const CRM = '/module/crm'

const STRUCTURE = 'hr.organisation_structure'
const ATTENDANCE = 'hr.attendance_health'
const LEAVE = 'hr.leave_attention'
const RECRUIT = 'hr.recruitment_funnel'
const ONBOARD = 'hr.onboarding_probation'
const CERT = 'hr.certification_expiry'
const CAPDEV = 'hr.capability_development'
const LEARN = 'hr.learning_assignments'
const TASKWF = 'hr.task_workflow'
const DEAL = 'commercial.deal_health'
const PIPE = 'commercial.pipeline_attention'
const RENEW = 'commercial.customer_renewals'
const INVOICE = 'commercial.invoice_attention'
const SIGEV = 'commercial.signal_evidence_quality'
const SIGYIELD = 'commercial.signal_yield'

export const COVERAGE_REGISTRY: readonly CoverageRow[] = [
  // 3.1 Organisation Management (12)
  row('organization', 'O1', 'Organisation profile', `${ORG}/organization-setup/organization-profile`),
  row('organization', 'O2', 'Organisation settings, roles, delivery and modules', null),
  partial('organization', 'O3', 'Department management', `${ORG}/organization-setup/department-management`, STRUCTURE),
  row('organization', 'O4', 'Department content (SOPs, policies, rules, processes, runs)', null),
  row('organization', 'O5', 'Shift master', `${ORG}/organization-setup/shift-master`),
  row('organization', 'O6', 'My department documents', `${ORG}/organization-setup/my-department-documents`),
  partial('organization', 'O7', 'Employee directory', `${ORG}/user-management/employee-directory`, STRUCTURE),
  row('organization', 'O8', 'Role and permissions', `${ORG}/user-management/role-and-permissions`),
  row('organization', 'O9', 'Compliance library', `${ORG}/compliance-and-discipline/compliance-library`),
  excluded('organization', 'O10', 'Disciplinary library'),
  row('organization', 'O11', 'Readiness gates', `${ORG}/readiness-gates`),
  row('organization', 'O12', 'Organisation graph views', null),

  // 3.2 HRIT Management (21)
  partial('hrms', 'H1', 'Attendance tracking', `${HRIT}/attendance-management/attendance-tracking`, ATTENDANCE),
  partial('hrms', 'H2', 'Attendance and monthly reports', `${HRIT}/attendance-management/attendance-reports`, ATTENDANCE),
  row('hrms', 'H3', 'Manage employee attendance (HR desk)', `${HRIT}/attendance-management/manage-employee-attendance`),
  row('hrms', 'H4', 'My office hours', `${HRIT}/attendance-management/my-office-hours`),
  partial('hrms', 'H5', 'Leave dashboard', `${HRIT}/leave-management/leave-dashboard`, LEAVE),
  partial('hrms', 'H6', 'Leave requests', `${HRIT}/leave-management/leave-requests`, LEAVE),
  row('hrms', 'H7', 'Leave reports', `${HRIT}/leave-management/leave-reports`),
  row('hrms', 'H8', 'Leave configuration', `${HRIT}/leave-management/leave-configuration`),
  excluded('hrms', 'H9', 'Payroll type'),
  excluded('hrms', 'H10', 'Salary structure and rollover'),
  excluded('hrms', 'H11', 'Payroll deduction'),
  excluded('hrms', 'H12', 'Monthly payroll and lock'),
  excluded('hrms', 'H13', 'Payroll register, bank, history and structure reports'),
  excluded('hrms', 'H14', 'Salary certificate and Form 16'),
  excluded('hrms', 'H15', 'Employee ledger'),
  excluded('hrms', 'H16', 'My HR (payslips, pay breakdown, salary certificate, Form 16)'),
  row('hrms', 'H17', 'Expenses (dashboard, my expenses, approvals, categories, unpaid)', `${HRIT}/expense-management/expense-dashboard`),
  row('hrms', 'H18', 'Employee advances', `${HRIT}/expense-management/employee-advances`),
  row('hrms', 'H19', 'Travel visit', `${HRIT}/travel-visit`),
  row('hrms', 'H20', 'HR dashboard', null),
  row('hrms', 'H21', 'Job title master', null),

  // 3.3 Talent Management (17)
  row('talent', 'T1', 'Talent dashboard', `${TAL}/talent-dashboard`),
  partial('talent', 'T2', 'Recruitment (postings, applications, interviews)', `${TAL}/recruitment`, RECRUIT),
  row('talent', 'T3', 'Screening, assessments and hiring team', `${TAL}/recruitment`),
  partial('talent', 'T4', 'Offers', `${TAL}/recruitment`, RECRUIT),
  row('talent', 'T5', 'Careers site and tracking', null),
  row('talent', 'T6', 'Recruitment analytics', null),
  partial('talent', 'T7', 'Onboarding', `${TAL}/onboarding`, ONBOARD),
  partial('talent', 'T8', 'Probation', `${TAL}/onboarding`, ONBOARD),
  excluded('talent', 'T9', 'Performance reviews and appraisals'),
  excluded('talent', 'T10', 'Compensation'),
  row('talent', 'T11', 'Employee profiles', `${TAL}/employee-profiles`),
  partial('talent', 'T12', 'Development and career paths', `${TAL}/development-and-career-paths`, CAPDEV),
  partial('talent', 'T13', 'Certifications and my certifications', `${TAL}/certifications`, CERT),
  partial('talent', 'T14', 'Capability progress and my capability', `${TAL}/capability-progress`, CAPDEV),
  row('talent', 'T15', 'Mobility and succession', `${TAL}/mobility-and-succession`),
  excluded('talent', 'T16', 'Offboarding'),
  row('talent', 'T17', 'Talent administration', `${TAL}/administration`),

  // 3.4 LMS (15)
  partial('lms', 'L1', 'Learning dashboard', `${LMS}/learning/learning-dashboard`, LEARN),
  row('lms', 'L2', 'Learning catalog', `${LMS}/learning/learning-catalog`),
  row('lms', 'L3', 'Course builder', `${LMS}/administration/course-builder`),
  partial('lms', 'L4', 'My learning and quiz', `${LMS}/learning/my-learning`, LEARN, CERT),
  partial('lms', 'L5', 'Assignments', `${LMS}/training-and-records/assignments`, LEARN),
  row('lms', 'L6', 'Capability gap inbox', `${LMS}/training-and-records/capability-gap-inbox`),
  row('lms', 'L7', 'Sessions and calendar', `${LMS}/training-and-records/sessions-and-calendar`),
  row('lms', 'L8', 'Simulation learning', `${LMS}/simulation-learning`),
  partial('lms', 'L9', 'Certifications and records', `${LMS}/training-and-records/certifications-and-records`, CERT),
  partial('lms', 'L10', 'Assessments (admin)', `${LMS}/assessments`, CAPDEV),
  row('lms', 'L11', 'My assessment', `${LMS}/learning/my-assessment`),
  row('lms', 'L12', 'Learning effectiveness', null),
  row('lms', 'L13', 'LMS reports', '/module/reports/lms-report/employee-analysis-report'),
  row('lms', 'L14', 'Governance and administration', `${LMS}/administration/administration-and-governance`),
  row('lms', 'L15', 'Sales training', `${LMS}/learning/sales-training`),

  // 3.5 Capability Intelligence (8): none has a detector. The detector-backed capability screens are routed under Talent Management and counted there (D4).
  row('competency', 'C1', 'Command center', `${CAP}/dashboard`),
  row('competency', 'C2', 'Competency library', `${CAP}/competency-library`),
  row('competency', 'C3', 'Libraries and taxonomy', `${CAP}/capability-library`),
  row('competency', 'C4', 'Framework and role mapping', `${CAP}/competency-framework`),
  row('competency', 'C5', 'Explorer', `${CAP}/capability-explorer`),
  row('competency', 'C6', 'Audit and activity', `${CAP}/audit`),
  row('competency', 'C7', 'Role, task and course competency maps', null),
  row('competency', 'C8', 'Skill matching', '/skill-matching'),

  // 3.6 Task Management (14)
  partial('task', 'K1', 'Dashboard and workspace', `${TASK}/task-management-dashboard`, TASKWF),
  partial('task', 'K2', 'My tasks', `${TASK}/my-tasks`, TASKWF),
  row('task', 'K3', 'Projects and workstreams', `${TASK}/projects-and-workstreams`),
  row('task', 'K4', 'Dependencies and milestones', `${TASK}/dependencies-and-workstreams`),
  row('task', 'K5', 'Task calendar', `${TASK}/task-calendar`),
  row('task', 'K6', 'Backlog', null),
  row('task', 'K7', 'Deadline extensions', null),
  row('task', 'K8', 'Reports and analysis', `${TASK}/reports-and-analysis`),
  row('task', 'K9', 'Status management', `${TASK}/task-status`),
  row('task', 'K10', 'Priority management', `${TASK}/task-priority`),
  row('task', 'K11', 'Permissions', `${TASK}/task-permission`),
  row('task', 'K12', 'Integrations', `${TASK}/task-integrations`),
  row('task', 'K13', 'Audit logs', `${TASK}/task-audit-logs`),
  row('task', 'K14', 'Task documents', null),

  // 3.7 Sales & Marketing (32)
  partial('crm', 'S1', 'CRM opportunities', `${CRM}/sales/opportunities`, DEAL),
  row('crm', 'S2', 'Leads', `${CRM}/marketing/leads`),
  row('crm', 'S3', 'Organisations', `${CRM}/marketing/organizations`),
  row('crm', 'S4', 'Contacts', `${CRM}/marketing/contacts`),
  row('crm', 'S5', 'Campaigns (CRM)', `${CRM}/marketing/campaigns`),
  // S6: the Outreach Approvals screen was retired into the Messages view of the Outreach tab of Market Signals (27 Nov 2026); the old address is only a redirect, so the row points at the tab.
  row('crm', 'S6', 'Outreach approvals', '/signals/outreach'),
  row('crm', 'S7', 'Quotes', `${CRM}/sales/quotes`),
  row('crm', 'S8', 'Products and services', `${CRM}/sales/products`),
  row('crm', 'S9', 'Price books', `${CRM}/sales/price-books`),
  row('crm', 'S10', 'Sales orders', `${CRM}/sales/sales-orders`),
  // S11 and S12: the Purchase Orders and Vendors screens were retired (26 Nov 2026); the matrix rows stay (the matrix is source-derived), with no screen.
  row('crm', 'S11', 'Purchase orders', null),
  row('crm', 'S12', 'Vendors', null),
  partial('crm', 'S13', 'Invoices', `${CRM}/sales/invoices`, INVOICE),
  row('crm', 'S14', 'Support (tickets, SLA, assets, contracts, FAQ, templates, SMS)', `${CRM}/support/tickets`),
  row('crm', 'S15', 'CRM reports', `${CRM}/reports`),
  row('crm', 'S16', 'Saved views, recycle bin, picklists and tax rates', '/platform-services/fields-configuration'),
  // S17: Automation Rules moved into Workflows (Automations tab), which is where this functionality lives now.
  row('crm', 'S17', 'CRM agents and automation', '/platform-services/workflow'),
  row('crm', 'S18', 'Account 360 and knowledge graph', `${CRM}/signals`),
  partial('crm', 'S19', 'GTM command center', '/gtm/command-center', PIPE),
  partial('crm', 'S20', 'GTM deals and pipeline', '/gtm/deals', DEAL, PIPE),
  // S21 and S23: the GTM Forecast and Prospecting screens were retired (26 Nov 2026); the pipeline-attention detector still assesses open deals.
  partial('crm', 'S21', 'GTM forecast', null, PIPE),
  partial('crm', 'S22', 'GTM customers and renewals', '/gtm/customers', RENEW),
  row('crm', 'S23', 'GTM prospecting (accounts and contacts)', null),
  row('crm', 'S24', 'GTM campaigns, segments and outreach', '/gtm/campaigns'),
  row('crm', 'S25', 'GTM playbooks, agents and workflows', '/gtm/playbooks'),
  row('crm', 'S26', 'GTM reports and monitoring', '/gtm/reports'),
  partial('crm', 'S27', 'Signals: market signals', '/signals', SIGEV),
  partial('crm', 'S28', 'Signals: research runs', '/signals', SIGYIELD),
  partial('crm', 'S29', 'Signals: review', '/signal-review', SIGEV),
  row('crm', 'S30', 'Signals: ingestion and connectors', '/ingestion'),
  row('crm', 'S31', 'Signals: portfolio, ICP and matching', '/portfolio'),
  row('crm', 'S32', 'Legacy signal inbox', `${CRM}/marketing/signal-inbox`),

  // 3.8 Platform Services (11). P3, P4, P6, P9, P10, P11 are covered by the new platform detectors (named by contract with the backend).
  row('platform-services', 'P1', 'Hub and registry', '/platform-services'),
  row('platform-services', 'P2', 'Workflow (approval chains)', '/platform-services/workflow'),
  partial('platform-services', 'P3', 'Scheduler', '/platform-services/scheduler', 'platform.scheduler_reliability'),
  partial('platform-services', 'P4', 'Integrations', '/platform-services/integration', 'platform.integration_status'),
  row('platform-services', 'P5', 'Communication', '/platform-services/communication'),
  partial('platform-services', 'P6', 'AI Stack', '/platform-services/ai-stack', 'platform.ai_usage'),
  row('platform-services', 'P7', 'Field settings', '/platform-services/fields-configuration'),
  row('platform-services', 'P8', 'Add process', '/platform-services/add-process'),
  partial('platform-services', 'P9', 'Event bus', '/platform-services/event-bus', 'platform.event_delivery'),
  partial('platform-services', 'P10', 'Governance and audit', '/ai/policies', 'platform.governance'),
  partial('platform-services', 'P11', 'AI console (providers, models, prompts, evaluation, usage and cost)', '/ai/usage-cost', 'platform.ai_usage'),

  // 3.9 Agentic AI (2)
  partial('agentic-ai', 'A1', 'Core screens (dashboard, library, create, run log, analytics, multi-agent, reflection, workspace)', '/module/agentic-ai/agent-dashboard', 'agentic.run_health'),
  row('agentic-ai', 'A2', 'Agent gateway (runs, proposals, autonomy, Ask)', '/module/agentic-ai/run-log'),
]

/**
 * What a row with no verified screen shows instead of a link. Twelve rows have none (O2, O4, O12, H20, H21, T5, T6, L12, C7, K6, K7, K14): each is a
 * panel, drawer, backend-only resource, public page that needs a token or slug, or a role-dependent panel inside the main dashboard, not a route of its own.
 * Re-checked against app/ and every content map: none can be proven to have a dedicated screen, so none is given a URL.
 */
export const NO_ROUTE_TEXT = 'No dedicated screen route verified'

/** The rows that are not excluded and have no verified screen: shown non-clickable, with NO_ROUTE_TEXT. */
export function rowsWithoutRoute(): CoverageRow[] {
  return COVERAGE_REGISTRY.filter((r) => r.state !== 'excluded' && r.route === null)
}

/** The detectors that are new and named by contract with the backend: until one reports, a row that depends only on them is "not yet assessed". */
export function isPendingDetector(id: string): boolean {
  return id.startsWith('platform.') || id.startsWith('agentic.')
}

export function registryRows(module: string): CoverageRow[] {
  return COVERAGE_REGISTRY.filter((r) => r.module === module)
}

export interface RegistrySummary {
  total: number
  partial: number
  not_assessed: number
  excluded: number
}

export function summarise(rows: readonly CoverageRow[]): RegistrySummary {
  return {
    total: rows.length,
    partial: rows.filter((r) => r.state === 'partial').length,
    not_assessed: rows.filter((r) => r.state === 'not_assessed').length,
    excluded: rows.filter((r) => r.state === 'excluded').length,
  }
}

export function registrySummary(module: string): RegistrySummary {
  return summarise(registryRows(module))
}

/**
 * The state to SHOW for a row. A partial row that rests only on new, not-yet-reporting detectors is "not yet assessed" until one of them reports: the
 * screen never claims coverage a detector has not delivered. `reported` is the set of detector ids present in the snapshot the server sent.
 */
export function displayState(rowDef: CoverageRow, reported: ReadonlySet<string>): RegistryState {
  if (rowDef.state !== 'partial') return rowDef.state
  const pending = rowDef.detectors.length > 0 && rowDef.detectors.every(isPendingDetector)
  if (pending && !rowDef.detectors.some((d) => reported.has(d))) return 'not_assessed'
  return 'partial'
}

/** Titles of the OTHER modules whose Intelligence reports a detector of this row (so a row never claims a finding another module owns). */
export function reportedUnder(rowDef: CoverageRow): string[] {
  const out = new Set<string>()
  for (const detector of rowDef.detectors) {
    for (const owner of MODULE_INTELLIGENCE) {
      if (owner.key === rowDef.module) continue
      const owns = owner.areas.some((ref) => areaById(ref.domain, ref.area)?.feeds.some((feed) => feed.detector === detector))
      if (owns) out.add(`${owner.title} Intelligence`)
    }
  }
  return [...out]
}
