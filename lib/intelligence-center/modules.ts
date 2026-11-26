import type { DecentralizedModuleKey } from '@/lib/platform/access-links'
import type { DomainId } from './domains'

export interface ModuleAreaRef {
  domain: DomainId
  area: string
}

export interface ModuleIntelligenceDef {
  key: DecentralizedModuleKey | 'agentic-ai' | 'platform-services'
  menuSlug: string
  title: string
  monitors: string
  areas: readonly ModuleAreaRef[]
}

const area = (domain: DomainId, id: string): ModuleAreaRef => ({ domain, area: id })

/**
 * Module scope is explicit and follows the ACTUAL parent module and route (owner decision D4): a detector-backed area belongs to exactly ONE module and
 * is never repeated under another. The functionality a module has but no detector assesses (and what is excluded by decision D2) is NOT listed here: it
 * is in coverage-registry.ts, which every module page renders, so nothing is silently absent and nothing is shown as zero findings or as healthy.
 *
 *   organization       organisation-structure
 *   hrms               attendance, leave
 *   talent             recruitment, onboarding-probation, certifications, capability-development (development plans, certifications, employee profiles and
 *                      capability progress are routed under /module/talent-management/*)
 *   lms                learning-assignments
 *   competency         none: its eight screens have no detector (Not Yet Assessed)
 *   task               tasks-workflow
 *   crm                crm-opportunities, gtm-deals-pipeline, customers-renewals, invoices, evidence-quality, research-yield
 *   platform-services  scheduler-reliability, integration-status, event-delivery, ai-usage, governance
 *   agentic-ai         agentic-runs
 */
export const MODULE_INTELLIGENCE: readonly ModuleIntelligenceDef[] = [
  {
    key: 'organization',
    menuSlug: 'organizational-management',
    title: 'Organisation Management',
    monitors: 'Organisation structure checks currently available to your role.',
    areas: [area('people-workforce', 'organisation-structure')],
  },
  {
    key: 'hrms',
    menuSlug: 'hrit-solutions',
    title: 'HRIT Management',
    monitors: 'Attendance and leave checks currently available to your role.',
    areas: [area('people-workforce', 'attendance'), area('people-workforce', 'leave')],
  },
  {
    key: 'talent',
    menuSlug: 'talent-management',
    title: 'Talent Management',
    monitors: 'Recruitment, onboarding, certification and capability development checks currently available to your role.',
    areas: [
      area('talent-onboarding', 'recruitment'),
      area('talent-onboarding', 'onboarding-probation'),
      area('capability-learning', 'certifications'),
      area('capability-learning', 'capability-development'),
    ],
  },
  {
    key: 'lms',
    menuSlug: 'lms',
    title: 'LMS Intelligence',
    monitors: 'Learning assignment checks currently available to your role.',
    areas: [area('capability-learning', 'learning-assignments')],
  },
  {
    key: 'competency',
    menuSlug: 'capability-intelligence',
    title: 'Capability Intelligence',
    monitors: 'No check assesses the Capability Intelligence screens yet.',
    areas: [],
  },
  {
    key: 'task',
    menuSlug: 'task-management',
    title: 'Task Management',
    monitors: 'Task workflow checks currently available to your role.',
    areas: [area('work-execution', 'tasks-workflow')],
  },
  {
    key: 'crm',
    menuSlug: 'crm',
    title: 'Sales & Marketing',
    monitors: 'CRM, GTM and market-signal checks currently available to your role.',
    areas: [
      area('revenue-pipeline', 'crm-opportunities'),
      area('revenue-pipeline', 'gtm-deals-pipeline'),
      area('revenue-pipeline', 'customers-renewals'),
      area('revenue-pipeline', 'invoices'),
      area('market-signals', 'evidence-quality'),
      area('market-signals', 'research-yield'),
    ],
  },
  {
    key: 'platform-services',
    menuSlug: 'platform-services',
    title: 'Platform Services',
    monitors: 'Workflows, schedules, integrations, communication, event delivery, scheduler failures, AI Stack, AI usage and cost, governance and operational reliability: only the checks that exist are listed, the rest is shown as not yet assessed.',
    areas: [
      area('platform-governance', 'scheduler-reliability'),
      area('platform-governance', 'integration-status'),
      area('platform-governance', 'event-delivery'),
      area('platform-governance', 'ai-usage'),
      area('platform-governance', 'governance'),
    ],
  },
  {
    key: 'agentic-ai',
    menuSlug: 'agentic-ai',
    title: 'Agentic AI',
    monitors: 'Agent run health. Agentic AI data exists; it is not yet assessed until its check reports.',
    areas: [area('platform-governance', 'agentic-runs')],
  },
]

export function moduleIntelligenceByKey(key: string): ModuleIntelligenceDef | null {
  return MODULE_INTELLIGENCE.find((module) => module.key === key) ?? null
}

export function moduleIntelligenceByMenuSlug(slug: string | null | undefined): ModuleIntelligenceDef | null {
  if (!slug) return null
  return MODULE_INTELLIGENCE.find((module) => module.menuSlug === slug) ?? null
}

export type ModuleIntelligenceKey = (typeof MODULE_INTELLIGENCE)[number]['key']

export function moduleIntelligenceHref(key: ModuleIntelligenceKey): string {
  return `/intelligence/module/${encodeURIComponent(key)}`
}
