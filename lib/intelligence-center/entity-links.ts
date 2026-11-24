/**
 * Where a record an insight points at can be opened.
 *
 * A link is built ONLY for the record kinds whose detail page is verified to exist (opportunities, invoices and departments have an id route under app/).
 * For every other kind the screen says "Record #N (no direct page: find it in <module>)" and links to the module's list: a URL is never guessed.
 * The ids in these links come from the server as numbers; they are re-checked as positive integers here, so nothing but digits can reach a path.
 */
import type { Insight, InsightEvidence } from '../../services/intelligence/types'
import type { ModuleLink } from './domains'

type EntityEvidence = Extract<InsightEvidence, { kind: 'entity' }>

interface EntityKind {
  singular: string
  plural: string
  /** The page of ONE record, only where one exists. */
  route?: (id: number) => string
  /** Where to find the record when it has no page of its own. */
  module: ModuleLink | null
}

const KINDS: Readonly<Record<string, EntityKind>> = {
  crm_opportunity: { singular: 'opportunity', plural: 'opportunities', route: (id) => `/module/crm/sales/opportunities/${id}`, module: { label: 'Opportunities', href: '/module/crm/sales/opportunities' } },
  crm_invoice: { singular: 'invoice', plural: 'invoices', route: (id) => `/module/crm/sales/invoices/${id}`, module: { label: 'Invoices', href: '/module/crm/sales/invoices' } },
  department: { singular: 'department', plural: 'departments', route: (id) => `/organization/departments/${id}`, module: { label: 'Departments', href: '/organization/departments' } },
  gtm_deal: { singular: 'deal', plural: 'deals', module: { label: 'GTM Deals', href: '/gtm/deals' } },
  gtm_account: { singular: 'account', plural: 'accounts', module: { label: 'Customer Success', href: '/gtm/customers' } },
  gtm_renewal: { singular: 'renewal', plural: 'renewals', module: { label: 'Customer Success', href: '/gtm/customers' } },
  leave_request: { singular: 'leave request', plural: 'leave requests', module: { label: 'Leave Management', href: '/dashboard/leave-management' } },
  certification: { singular: 'certification', plural: 'certifications', module: { label: 'Certifications', href: '/module/talent-management/certifications' } },
  lms_certificate: { singular: 'certificate', plural: 'certificates', module: { label: 'Certifications', href: '/module/talent-management/certifications' } },
  job_application: { singular: 'application', plural: 'applications', module: { label: 'Recruitment', href: '/module/talent-management/recruitment' } },
  job_offer: { singular: 'offer', plural: 'offers', module: { label: 'Recruitment', href: '/module/talent-management/recruitment' } },
  onboarding_journey: { singular: 'onboarding journey', plural: 'onboarding journeys', module: { label: 'Onboarding', href: '/module/talent-management/onboarding' } },
  employee: { singular: 'person', plural: 'people', module: { label: 'Employee Directory', href: '/module/organizational-management/user-management/employee-directory' } },
  task: { singular: 'task', plural: 'tasks', module: { label: 'Task Management', href: '/module/task-management/task-management-dashboard' } },
  learning_assignment: { singular: 'learning assignment', plural: 'learning assignments', module: { label: 'Assignments', href: '/module/lms/training-and-records/assignments' } },
  // Platform Services and Agentic AI: the entity_type names the backend detectors emit (agentic_agent, event, ai_policy). None has a page of its own, so each links to its list screen only.
  agentic_agent: { singular: 'agent', plural: 'agents', module: { label: 'Agentic AI agents', href: '/module/agentic-ai/agentic-library' } },
  event: { singular: 'event', plural: 'events', module: { label: 'Event Bus', href: '/platform-services/event-bus' } },
  ai_policy: { singular: 'AI policy', plural: 'AI policies', module: { label: 'AI policies', href: '/ai/policies' } },
  course_enrolment: { singular: 'course enrolment', plural: 'course enrolments', module: { label: 'Learning Dashboard', href: '/module/lms/learning/learning-dashboard' } },
}

/** The record types that have a page of their own. */
export const LINKABLE_ENTITY_TYPES: readonly string[] = Object.entries(KINDS)
  .filter(([, kind]) => kind.route)
  .map(([type]) => type)

export const KNOWN_ENTITY_TYPES: readonly string[] = Object.keys(KINDS)

function isRecordId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && id < 1e12
}

/** The page of one record, or null when the kind has no page (or the id is not a plain positive whole number). Never a guess. */
export function entityHref(entityType: string, entityId: number): string | null {
  if (!isRecordId(entityId)) return null
  return KINDS[entityType]?.route?.(entityId) ?? null
}

/** Humanises a type this file does not know ("some_new_thing" -> "some new thing"); never throws, never trusts the characters. */
function humanise(type: string): string {
  const words = type.replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
  return words === '' ? 'record' : words
}

export function entityNoun(entityType: string, count: number): string {
  const kind = KINDS[entityType]
  if (kind) return count === 1 ? kind.singular : kind.plural
  const base = humanise(entityType)
  return count === 1 ? base : `${base} records`
}

export function entityModule(entityType: string): ModuleLink | null {
  return KINDS[entityType]?.module ?? null
}

export interface EntityRecord {
  id: number
  /** Present only when the record has a page of its own. */
  href: string | null
  /** "Opportunity #12" for a record with a page, "Record #12" for one without. */
  text: string
}

export interface EntityGroup {
  entityType: string
  count: number
  /** "11 opportunities listed". */
  summary: string
  /** The first records, linked where a page exists. */
  shown: EntityRecord[]
  /** How many are not shown in `shown`. */
  more: number
  /** True when no record of this kind has a page of its own. */
  noPage: boolean
  /** Where to find the records that have no page (null when this file does not know the kind). */
  module: ModuleLink | null
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Folds the repeated entity evidence of an insight into one line per record kind: "11 opportunities listed", the first few as links where a page exists,
 * and "and N more". Replaces printing every record on its own line.
 */
export function compactEntities(evidence: readonly InsightEvidence[], show = 3): EntityGroup[] {
  const byType = new Map<string, EntityEvidence[]>()
  for (const item of evidence) {
    if (item.kind !== 'entity') continue
    const list = byType.get(item.entity_type) ?? []
    list.push(item)
    byType.set(item.entity_type, list)
  }
  const groups: EntityGroup[] = []
  for (const [entityType, items] of byType) {
    const count = items.length
    const shown = items.slice(0, show).map((item): EntityRecord => {
      const href = entityHref(entityType, item.entity_id)
      const id = isRecordId(item.entity_id) ? `#${item.entity_id}` : '(no id)'
      return { id: item.entity_id, href, text: href ? `${capitalise(entityNoun(entityType, 1))} ${id}` : `Record ${id}` }
    })
    groups.push({
      entityType,
      count,
      summary: `${count} ${entityNoun(entityType, count)} listed`,
      shown,
      more: Math.max(0, count - shown.length),
      noPage: shown.every((s) => s.href === null),
      module: entityModule(entityType),
    })
  }
  return groups
}
