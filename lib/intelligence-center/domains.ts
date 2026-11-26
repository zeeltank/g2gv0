/**
 * The Intelligence taxonomy: seven management domains, the areas inside them, which detector ids and insight surfaces feed each area, and the real module
 * (screen) each one opens. STATIC and VERIFIED: every route below is checked against app/ and the module content maps by domains.test.ts, so a link in
 * this file is a link to something that exists. Nothing here is data: it never says whether anything is wrong, only where a finding belongs.
 *
 * Classification of an insight to an area uses the detector id FIRST and the insight's surfaces SECOND. An insight that fits nowhere goes to the
 * "Other findings" bucket: an insight is never dropped.
 */

export type DomainId =
  | 'people-workforce'
  | 'talent-onboarding'
  | 'capability-learning'
  | 'work-execution'
  | 'revenue-pipeline'
  | 'market-signals'
  | 'platform-governance'
  | 'cross-functional'
  | 'other'

export type DomainIcon = 'users' | 'user-plus' | 'graduation-cap' | 'list-checks' | 'trending-up' | 'radar' | 'shield-check' | 'layers'
export type DomainAccent = 'indigo' | 'blue' | 'violet' | 'sky' | 'cyan' | 'slate'

export interface ModuleLink {
  label: string
  href: string
}

/** One detector feeding an area. `surfaces` set means "only the insights of this detector that carry one of these surfaces"; unset means "the rest". */
export interface AreaFeed {
  detector: string
  surfaces?: readonly string[]
}

export interface AreaDef {
  id: string
  domain: DomainId
  title: string
  /** One sentence: what this area watches. */
  monitors: string
  feeds: readonly AreaFeed[]
  /** Second-chance classification, for a detector id this file does not know. */
  surfaces: readonly string[]
  /** The module(s) to open, first is the primary one. */
  modules: readonly ModuleLink[]
  /** A new check: until one of its detectors reports, the area is "not yet assessed" (the backend may not have it yet), never "not available". */
  pending?: boolean
}

export interface DomainDef {
  id: DomainId
  title: string
  monitors: string
  icon: DomainIcon
  accent: DomainAccent
  areas: readonly AreaDef[]
  /** Modules to open from the domain page. */
  modules: readonly ModuleLink[]
  /** True when no detector exists for this domain yet. */
  notConnected: boolean
  /** For a domain that is not connected: what it covers, each with a real link. */
  covers: readonly ModuleLink[]
}

/** Plain titles of the known detectors (static, for the places a detector is named without the server's list, e.g. "not available for your role"). */
export const DETECTOR_TITLE: Readonly<Record<string, string>> = {
  'hr.attendance_health': 'Attendance records',
  'hr.leave_attention': 'Leave approvals',
  'hr.organisation_structure': 'Organisation structure',
  'hr.recruitment_funnel': 'Recruitment',
  'hr.onboarding_probation': 'Onboarding and probation',
  'hr.certification_expiry': 'Certification expiry',
  'hr.learning_assignments': 'Learning assignments',
  'hr.capability_development': 'Capability development',
  'hr.task_workflow': 'Tasks and workflow',
  'commercial.deal_health': 'Deal health',
  'commercial.pipeline_attention': 'Pipeline data quality',
  'commercial.customer_renewals': 'Customer renewals',
  'commercial.invoice_attention': 'Overdue invoices',
  'commercial.signal_evidence_quality': 'Signal evidence quality',
  'commercial.signal_yield': 'Research yield',
  'platform.scheduler_reliability': 'Scheduler reliability',
  'platform.integration_status': 'Integration status',
  'platform.event_delivery': 'Event delivery',
  'platform.ai_usage': 'AI usage and cost',
  'platform.governance': 'Governance and policies',
  'agentic.run_health': 'Agent run health',
}

const L = (label: string, href: string): ModuleLink => ({ label, href })

const PEOPLE_AREAS: readonly AreaDef[] = [
  {
    id: 'attendance',
    domain: 'people-workforce',
    title: 'Attendance',
    monitors: 'Whether attendance records are complete: who is recording, missing punch-outs and duplicate entries.',
    feeds: [{ detector: 'hr.attendance_health' }],
    surfaces: ['attendance'],
    modules: [L('Attendance', '/dashboard/attendance'), L('Attendance Tracking', '/module/hrit-solutions/attendance-management/attendance-tracking')],
  },
  {
    id: 'leave',
    domain: 'people-workforce',
    title: 'Leave',
    monitors: 'Leave requests whose approval has been waiting longer than the agreed time.',
    feeds: [{ detector: 'hr.leave_attention' }],
    surfaces: ['leave'],
    modules: [L('Leave Management', '/dashboard/leave-management'), L('Leave Requests', '/module/hrit-solutions/leave-management/leave-requests')],
  },
  {
    id: 'organisation-structure',
    domain: 'people-workforce',
    title: 'Organisation structure',
    monitors: 'Whether people have a department, a job title and a reporting manager, and whether departments have a head.',
    feeds: [{ detector: 'hr.organisation_structure' }],
    surfaces: ['organisation'],
    modules: [L('Departments', '/organization/departments'), L('Employee Directory', '/module/organizational-management/user-management/employee-directory')],
  },
]

const TALENT_AREAS: readonly AreaDef[] = [
  {
    id: 'recruitment',
    domain: 'talent-onboarding',
    title: 'Recruitment',
    monitors: 'Applications waiting for review and offers that have passed their expiry without an outcome.',
    feeds: [{ detector: 'hr.recruitment_funnel' }],
    surfaces: ['recruitment'],
    modules: [L('Recruitment', '/module/talent-management/recruitment')],
  },
  {
    id: 'onboarding-probation',
    domain: 'talent-onboarding',
    title: 'Onboarding & probation',
    monitors: 'Probation periods ending or overdue for confirmation, and onboarding tasks that are overdue.',
    feeds: [{ detector: 'hr.onboarding_probation' }],
    surfaces: ['onboarding'],
    modules: [L('Onboarding', '/module/talent-management/onboarding'), L('Talent Dashboard', '/module/talent-management/talent-dashboard')],
  },
]

const CAPABILITY_AREAS: readonly AreaDef[] = [
  {
    id: 'certifications',
    domain: 'capability-learning',
    title: 'Certifications',
    monitors: 'Certifications that have lapsed or are about to expire.',
    feeds: [{ detector: 'hr.certification_expiry' }],
    surfaces: ['certifications'],
    modules: [L('Certifications', '/module/talent-management/certifications')],
  },
  {
    id: 'learning-assignments',
    domain: 'capability-learning',
    title: 'Learning assignments',
    monitors: 'Assigned learning that is overdue or has stalled.',
    feeds: [{ detector: 'hr.learning_assignments' }],
    surfaces: ['learning'],
    modules: [L('Assignments', '/module/lms/training-and-records/assignments'), L('Learning Dashboard', '/module/lms/learning/learning-dashboard')],
  },
  {
    id: 'capability-development',
    domain: 'capability-learning',
    title: 'Capability development',
    monitors: 'Competency assessments and development plans that are overdue.',
    feeds: [{ detector: 'hr.capability_development' }],
    surfaces: ['capability'],
    // Owned by Talent Intelligence (D4): these screens are routed under /module/talent-management/*.
    modules: [L('Capability Progress', '/module/talent-management/capability-progress'), L('Development & Career Paths', '/module/talent-management/development-and-career-paths')],
  },
]

const WORK_AREAS: readonly AreaDef[] = [
  {
    id: 'tasks-workflow',
    domain: 'work-execution',
    title: 'Tasks & workflow',
    monitors: 'Overdue tasks, tasks on hold and tasks that were reopened.',
    feeds: [{ detector: 'hr.task_workflow' }],
    surfaces: ['tasks'],
    modules: [L('Task Management', '/module/task-management/task-management-dashboard'), L('My Tasks', '/module/task-management/my-tasks')],
  },
]

const REVENUE_AREAS: readonly AreaDef[] = [
  {
    id: 'crm-opportunities',
    domain: 'revenue-pipeline',
    title: 'CRM opportunities',
    monitors: 'Open CRM opportunities that have not been touched or are past their closing date.',
    feeds: [{ detector: 'commercial.deal_health', surfaces: ['crm_opportunities'] }],
    surfaces: ['crm_opportunities'],
    modules: [L('Opportunities', '/module/crm/sales/opportunities')],
  },
  {
    id: 'gtm-deals-pipeline',
    domain: 'revenue-pipeline',
    title: 'GTM deals & pipeline',
    monitors: 'GTM deals with no next step, no recent activity or a stale stage, and pipeline records missing an amount or close date.',
    feeds: [{ detector: 'commercial.deal_health' }, { detector: 'commercial.pipeline_attention' }],
    surfaces: ['gtm_deals', 'gtm_forecast', 'gtm_command_center'],
    modules: [L('GTM Command Center', '/gtm/command-center'), L('GTM Deals', '/gtm/deals')],
  },
  {
    id: 'customers-renewals',
    domain: 'revenue-pipeline',
    title: 'Customers & renewals',
    monitors: 'Renewals that are overdue or due soon, and customer accounts whose health is at risk.',
    feeds: [{ detector: 'commercial.customer_renewals' }],
    surfaces: ['gtm_customers'],
    modules: [L('Customer Success', '/gtm/customers')],
  },
  {
    id: 'invoices',
    domain: 'revenue-pipeline',
    title: 'Invoices',
    monitors: 'Invoices that are past their due date and not fully paid.',
    feeds: [{ detector: 'commercial.invoice_attention' }],
    surfaces: ['crm_invoices'],
    modules: [L('Invoices', '/module/crm/sales/invoices')],
  },
]

const SIGNAL_AREAS: readonly AreaDef[] = [
  {
    id: 'evidence-quality',
    domain: 'market-signals',
    title: 'Evidence quality',
    monitors: 'Whether market signals are backed by dated evidence and have been reviewed.',
    feeds: [{ detector: 'commercial.signal_evidence_quality' }],
    surfaces: ['signal_review'],
    modules: [L('Signal Review', '/signal-review'), L('Market Signals', '/signals')],
  },
  {
    id: 'research-yield',
    domain: 'market-signals',
    title: 'Research yield',
    monitors: 'Research runs that finished without a qualified result, and runs that failed.',
    feeds: [{ detector: 'commercial.signal_yield' }],
    surfaces: ['signals'],
    modules: [L('Market Signals', '/signals')],
  },
]

/**
 * Platform, AI & Governance areas. These checks are NEW: until the server reports one, its area is "not yet assessed" (pending). Hub, workflows,
 * communication, field settings and add-process have no detector and are listed as not yet assessed in the coverage registry, never invented here.
 */
const PLATFORM_AREAS: readonly AreaDef[] = [
  {
    id: 'scheduler-reliability',
    domain: 'platform-governance',
    title: 'Scheduler reliability',
    monitors: 'Scheduled tasks that are failing or have never run.',
    feeds: [{ detector: 'platform.scheduler_reliability' }],
    surfaces: ['platform_scheduler'],
    modules: [L('Scheduler', '/platform-services/scheduler')],
    pending: true,
  },
  {
    id: 'integration-status',
    domain: 'platform-governance',
    title: 'Integration status',
    monitors: 'Integrations that are not configured or report an error. Credentials are never read.',
    feeds: [{ detector: 'platform.integration_status' }],
    surfaces: ['platform_integrations'],
    modules: [L('Integrations', '/platform-services/integration')],
    pending: true,
  },
  {
    id: 'event-delivery',
    domain: 'platform-governance',
    title: 'Event delivery',
    monitors: 'Platform events that failed or were not delivered.',
    feeds: [{ detector: 'platform.event_delivery' }],
    surfaces: ['platform_event_bus'],
    modules: [L('Event Bus', '/platform-services/event-bus')],
    pending: true,
  },
  {
    id: 'ai-usage',
    domain: 'platform-governance',
    title: 'AI usage and cost',
    monitors: 'AI usage and cost against the limits that are set. Keys are never read.',
    feeds: [{ detector: 'platform.ai_usage' }],
    surfaces: ['ai_usage_cost'],
    modules: [L('AI Stack', '/platform-services/ai-stack'), L('AI usage and cost', '/ai/usage-cost')],
    pending: true,
  },
  {
    id: 'governance',
    domain: 'platform-governance',
    title: 'Governance and policies',
    monitors: 'AI policies that are not yet acknowledged, and the operational reliability of the governance records.',
    feeds: [{ detector: 'platform.governance' }],
    surfaces: ['ai_policies'],
    modules: [L('AI policies', '/ai/policies')],
    pending: true,
  },
  {
    id: 'agentic-runs',
    domain: 'platform-governance',
    title: 'Agent runs',
    monitors: 'Failed agent runs, cost per run and agents that are idle.',
    feeds: [{ detector: 'agentic.run_health' }],
    surfaces: ['agentic_run_log'],
    modules: [L('Agentic AI run log', '/module/agentic-ai/run-log'), L('Agentic AI dashboard', '/module/agentic-ai/agent-dashboard')],
    pending: true,
  },
]

/** Platform screens with no detector at all (Not Yet Assessed): shown on the domain page so nothing is silently absent. */
export const PLATFORM_COVERS: readonly ModuleLink[] = [
  L('Platform Services hub', '/platform-services'),
  L('Workflows', '/platform-services/workflow'),
  L('Communications', '/platform-services/communication'),
  L('Documents', '/documents'),
  L('Reports (Sales & Marketing)', '/module/crm/reports'),
  L('Reports (Learning)', '/module/reports/lms-report/employee-analysis-report'),
]

export const DOMAINS: readonly DomainDef[] = [
  {
    id: 'people-workforce',
    title: 'People & Workforce Health',
    monitors: 'Whether attendance and leave records are complete, approvals are not stuck, and the organisation structure is filled in.',
    icon: 'users',
    accent: 'indigo',
    areas: PEOPLE_AREAS,
    modules: [L('Attendance', '/dashboard/attendance'), L('Leave Management', '/dashboard/leave-management'), L('Departments', '/organization/departments')],
    notConnected: false,
    covers: [],
  },
  {
    id: 'talent-onboarding',
    title: 'Talent Acquisition & Onboarding',
    monitors: 'Whether applications and offers are moving, and whether new joiners are confirmed and onboarded on time.',
    icon: 'user-plus',
    accent: 'blue',
    areas: TALENT_AREAS,
    modules: [L('Recruitment', '/module/talent-management/recruitment'), L('Onboarding', '/module/talent-management/onboarding')],
    notConnected: false,
    covers: [],
  },
  {
    id: 'capability-learning',
    title: 'Capability, Learning & Certification',
    monitors: 'Whether certifications are current, assigned learning is on time, and capability development is on track.',
    icon: 'graduation-cap',
    accent: 'violet',
    areas: CAPABILITY_AREAS,
    modules: [
      L('Certifications', '/module/talent-management/certifications'),
      L('Assignments', '/module/lms/training-and-records/assignments'),
      L('Capability Command Center', '/module/capability-intelligence/dashboard'),
    ],
    notConnected: false,
    covers: [],
  },
  {
    id: 'work-execution',
    title: 'Work Execution',
    monitors: 'Whether tasks are completed on time, and whether work is being held up or reopened.',
    icon: 'list-checks',
    accent: 'sky',
    areas: WORK_AREAS,
    modules: [L('Task Management', '/module/task-management/task-management-dashboard'), L('My Tasks', '/module/task-management/my-tasks')],
    notConnected: false,
    covers: [],
  },
  {
    id: 'revenue-pipeline',
    title: 'Sales, CRM & Revenue',
    monitors: 'Whether deals are moving, renewals and customers are looked after, and invoices are being paid.',
    icon: 'trending-up',
    accent: 'indigo',
    areas: REVENUE_AREAS,
    modules: [L('GTM Command Center', '/gtm/command-center'), L('Opportunities', '/module/crm/sales/opportunities'), L('Invoices', '/module/crm/sales/invoices')],
    notConnected: false,
    covers: [],
  },
  {
    id: 'market-signals',
    title: 'Market Signals',
    monitors: 'Whether market research is producing evidence-backed signals that people review.',
    icon: 'radar',
    accent: 'cyan',
    areas: SIGNAL_AREAS,
    modules: [L('Market Signals', '/signals'), L('Signal Review', '/signal-review')],
    notConnected: false,
    covers: [],
  },
  {
    id: 'platform-governance',
    title: 'Platform, AI & Governance',
    monitors: 'Whether AI agents, platform services, documents, communications and reports are running as intended.',
    icon: 'shield-check',
    accent: 'slate',
    areas: PLATFORM_AREAS,
    modules: [L('Scheduler', '/platform-services/scheduler'), L('Integrations', '/platform-services/integration'), L('Event Bus', '/platform-services/event-bus'), L('AI usage and cost', '/ai/usage-cost')],
    notConnected: false,
    covers: PLATFORM_COVERS,
  },
]

/** The bucket for any finding the taxonomy does not know. Not listed in DOMAINS: it appears only when it has something in it. */
export const OTHER_AREA: AreaDef = {
  id: 'other-findings',
  domain: 'other',
  title: 'Other findings',
  monitors: 'Findings from checks that are not yet placed in a domain.',
  feeds: [],
  surfaces: [],
  modules: [],
}

export const OTHER_DOMAIN: DomainDef = {
  id: 'other',
  title: 'Other findings',
  monitors: 'Findings from checks that are not yet placed in one of the domains above. Nothing is hidden: it is listed here.',
  icon: 'layers',
  accent: 'slate',
  areas: [OTHER_AREA],
  modules: [],
  notConnected: false,
  covers: [],
}

/** Every domain a route can name, in display order. */
export const ALL_DOMAINS: readonly DomainDef[] = [...DOMAINS, OTHER_DOMAIN]

/* ── cross-functional: "Possible relationships" (Global Intelligence only) ─ */

/** The detector id prefix the backend uses for cross-functional checks (`cross.*`, domain `cross`, categories `cross_*`, confidence rule_based). */
export const CROSS_DETECTOR_PREFIX = 'cross.'
export const CROSS_DOMAIN_ID: DomainId = 'cross-functional'
export const CROSS_AREA_ID = 'possible-relationships'

export function isCrossDetector(detector: string | null | undefined): boolean {
  return typeof detector === 'string' && detector.startsWith(CROSS_DETECTOR_PREFIX)
}

/** A cross-functional finding is recognised by its detector id first, its server domain second. Never by surface: it belongs to no single module. */
export function isCrossInsight(insight: { detector: string; domain?: string }): boolean {
  return isCrossDetector(insight.detector) || insight.domain === 'cross'
}

/**
 * The one area of the cross-functional section. It is deliberately NOT in DOMAINS / ALL_DOMAINS / any module: the section exists on Global Intelligence only
 * (global and module levels are never mixed), and it has no screen of its own to open, because a possible relationship belongs to no single module.
 */
export const CROSS_AREA: AreaDef = {
  id: CROSS_AREA_ID,
  domain: CROSS_DOMAIN_ID,
  title: 'Possible relationships',
  monitors: 'Two things that were observed together. A possible relationship needs verification: no cause is established.',
  feeds: [],
  surfaces: [],
  modules: [],
  pending: true,
}

export const CROSS_DOMAIN: DomainDef = {
  id: CROSS_DOMAIN_ID,
  title: 'Possible relationships',
  monitors: CROSS_AREA.monitors,
  icon: 'layers',
  accent: 'indigo',
  areas: [CROSS_AREA],
  modules: [],
  notConnected: false,
  covers: [],
}

export function domainById(id: string): DomainDef | null {
  if (id === CROSS_DOMAIN_ID) return CROSS_DOMAIN
  return ALL_DOMAINS.find((d) => d.id === id) ?? null
}

export function areaById(domainId: string, areaId: string): AreaDef | null {
  return domainById(domainId)?.areas.find((a) => a.id === areaId) ?? null
}

export function allAreas(): AreaDef[] {
  return ALL_DOMAINS.flatMap((d) => [...d.areas])
}

/** The ids of every detector a domain is fed by. */
export function domainDetectorIds(domain: DomainDef): string[] {
  return [...new Set(domain.areas.flatMap((a) => a.feeds.map((f) => f.detector)))]
}

export function areaDetectorIds(area: AreaDef): string[] {
  return [...new Set(area.feeds.map((f) => f.detector))]
}

export const KNOWN_DETECTORS: readonly string[] = [...new Set(allAreas().flatMap((a) => a.feeds.map((f) => f.detector)))]

export interface Placement {
  domain: DomainId
  area: string
}

/**
 * Which area a finding belongs to: the detector id first, the surfaces second, otherwise "Other findings". A detector feeding several areas (deal health:
 * CRM opportunities and GTM deals) is split by the surface the insight carries; with none of the specific surfaces it stays with the unrestricted feed.
 */
export function classifyInsight(insight: { detector: string; surfaces?: readonly string[]; domain?: string }): Placement {
  if (isCrossInsight(insight)) return { domain: CROSS_DOMAIN_ID, area: CROSS_AREA_ID }
  const surfaces = insight.surfaces ?? []
  const candidates: Array<{ area: AreaDef; feed: AreaFeed }> = []
  for (const area of allAreas()) {
    for (const feed of area.feeds) {
      if (feed.detector === insight.detector) candidates.push({ area, feed })
    }
  }
  if (candidates.length > 0) {
    const specific = candidates.find((c) => c.feed.surfaces && c.feed.surfaces.some((s) => surfaces.includes(s)))
    const chosen = specific ?? candidates.find((c) => !c.feed.surfaces) ?? candidates[0]
    return { domain: chosen.area.domain, area: chosen.area.id }
  }
  for (const area of allAreas()) {
    if (area.surfaces.some((s) => surfaces.includes(s))) return { domain: area.domain, area: area.id }
  }
  return { domain: OTHER_AREA.domain, area: OTHER_AREA.id }
}

/* ── routes inside Intelligence ───────────────────────────────────────── */

export const HOME_HREF = '/intelligence'

export function domainHref(domain: string): string {
  return `${HOME_HREF}/${encodeURIComponent(domain)}`
}

export function areaHref(domain: string, area: string): string {
  return `${domainHref(domain)}/${encodeURIComponent(area)}`
}

/**
 * A finding's key as the server builds it carries the organisation (a `t<digits>` segment) and ends with the day it was computed (`:YYYY-MM-DD`).
 * Neither belongs in an address: the date would make a bookmark stop working at midnight, and the organisation id has no business in a URL.
 * This removes both and keeps everything else. A key without them is returned as it was.
 */
export function stableKey(key: string): string {
  const withoutTenant = key.split(':').filter((segment) => !/^t\d+$/.test(segment)).join(':')
  // From the first whole-day date segment to the end (a time after it may itself contain colons).
  return withoutTenant.replace(/(?<=.):\d{4}-\d{2}-\d{2}.*$/, '')
}

export function insightHref(domain: string, area: string, key: string): string {
  return `${areaHref(domain, area)}/${encodeURIComponent(stableKey(key))}`
}

/** The page of one insight, wherever it is classified. */
export function insightPageFor(insight: { key: string; detector: string; surfaces?: readonly string[]; domain?: string }): string {
  const place = classifyInsight(insight)
  return insightHref(place.domain, place.area, insight.key)
}

/** Decodes one URL segment; a malformed escape leaves it as it was rather than throwing. */
export function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Every static link target this file contains (module links, covers), for the route-existence test. */
export function allModuleLinks(): ModuleLink[] {
  const out: ModuleLink[] = []
  for (const d of ALL_DOMAINS) {
    out.push(...d.modules, ...d.covers)
    for (const a of d.areas) out.push(...a.modules)
  }
  return out
}

/* ── cross-domain views ───────────────────────────────────────────────── */

export interface ChainStage {
  label: string
  domain: DomainId
  /** Absent for a stage that stands for a whole domain. */
  area?: string
}

export interface ChainDef {
  id: string
  title: string
  stages: readonly ChainStage[]
}

/**
 * Two themed panels shown side by side for context. They are a LIST of screens that are looked at together, not a model: the relationships between
 * them are not measured, and nothing on screen says one causes another.
 */
export const CONNECTED_VIEWS: readonly ChainDef[] = [
  {
    id: 'revenue-related',
    title: 'Revenue-related checks',
    stages: [
      { label: 'Market signals', domain: 'market-signals' },
      { label: 'CRM opportunities', domain: 'revenue-pipeline', area: 'crm-opportunities' },
      { label: 'GTM deals', domain: 'revenue-pipeline', area: 'gtm-deals-pipeline' },
      { label: 'Customers & renewals', domain: 'revenue-pipeline', area: 'customers-renewals' },
      { label: 'Invoices', domain: 'revenue-pipeline', area: 'invoices' },
    ],
  },
  {
    id: 'people-capacity-related',
    title: 'People-capacity-related checks',
    stages: [
      { label: 'Recruitment', domain: 'talent-onboarding', area: 'recruitment' },
      { label: 'Onboarding', domain: 'talent-onboarding', area: 'onboarding-probation' },
      { label: 'Attendance', domain: 'people-workforce', area: 'attendance' },
      { label: 'Leave', domain: 'people-workforce', area: 'leave' },
      { label: 'Tasks', domain: 'work-execution', area: 'tasks-workflow' },
    ],
  },
]

export const CONNECTED_VIEWS_NOTE = 'These are shown together for context. The relationships between them are not measured.'
