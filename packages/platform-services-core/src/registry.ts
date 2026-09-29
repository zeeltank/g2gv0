/**
 * The twelve platform services, in the order the menu lists them.
 *
 * Registry order is the running order — the menu and the console index both read it, so
 * re-ordering here re-orders every surface at once and nothing sorts at render time
 * behind anyone's back.
 *
 * ── HOW THIS RELATES TO LMS K-12's LIST ─────────────────────────────────────
 *
 * The same twelve names, deliberately, so "Platform Services" is one thing across the
 * platform rather than two menus that happen to rhyme. What differs, and must:
 *
 *   `status`       what G2G offers today. LMS K-12's copy answers the same question
 *                  about LMS K-12, and the two products are at different points.
 *   `destination`  where G2G's screen is. K-12's routes are K-12's.
 *   `todayInG2g`   written from what THIS codebase does. Nothing here is aspirational.
 *
 * NOTIFICATION IS ABSENT ON PURPOSE. K-12 lists it; G2G already has the bell in the
 * navigation bar and a Notifications section in Settings, so a third door to the same
 * room would be the "two labels, one destination" problem `gtg-user-menu.tsx` records
 * having already fixed once.
 *
 * SIX OF THESE ARE ALREADY LIVE, and that was not obvious. Onboarding, Integration and
 * Mobile App Rights all have working screens reached through the module tree — the first
 * draft of this file had them as unbuilt until `lib/gtg-navigation.ts` and
 * `hooks/content-map-m4.ts` proved otherwise. Marking a working feature "coming soon" is
 * the same defect as the reverse, just in the direction nobody checks.
 */

import type { PlatformService } from './types'

/**
 * Access links, restated as literals rather than imported from `@/lib/gtg-navigation`.
 *
 * This package must not depend on the app — that is why it is in `packages/`. The app
 * checks these against its own constants in `lib/platform/access-links.ts`, so a drift
 * is a type error there rather than a dead menu entry here.
 */
const ROLE_PERMISSIONS = '/module/organizational-management/user-management/role-and-permissions'
const TALENT_ONBOARDING = '/module/talent-management/onboarding'

/**
 * The six modules with a real branch in `tblmenumaster_g2g` — `events` (the platform's
 * own event-store module) has none, so it stays reachable only from the central hub
 * above; that is a structural fact about the sidebar, not a choice made here.
 *
 * Round 3 decentralizes symmetrically: every one of these six gets a scoped tab into
 * every decentralizable service below, even where that module has nothing configured
 * for it yet — an honest empty state rather than a hidden tab, matching how this
 * console already handles an unenforced workflow point.
 */
export const DECENTRALIZED_MODULES = [
  'organization',
  'hrms',
  'talent',
  'lms',
  'competency',
  'task',
] as const

export const PLATFORM_SERVICES: readonly PlatformService[] = [
  {
    id: 'platform.rbac',
    slug: 'rbac',
    name: 'RBAC',
    section: 'services',
    icon: 'ShieldCheck',
    purpose: 'Decide which screens each role can open, and what it may do on them.',
    whyCentral:
      'Every module asks the same question about access, and an answer that differed per module would be a permission system per module.',
    todayInG2g:
      'Role & Permissions writes tblgroupwise_rights_g2g through /user/save_groupwiserights_g2g, gated by profile:admin. The matrix covers view, add, edit, delete, dashboard and mobile.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'existing-screen', accessLink: ROLE_PERMISSIONS },
    phase: 1,
  },
  {
    id: 'platform.workflow',
    slug: 'workflow',
    name: 'Workflow',
    section: 'services',
    icon: 'Workflow',
    purpose: 'Define the approval chains that sit in front of a module action.',
    whyCentral:
      'Four modules have each grown their own approval model, so "who signs this off" is answered in four shapes and can be asked in none.',
    todayInG2g:
      'Eight approval points are declared in config/platform_services.php, and chains against them are stored in g2g_platform_workflows. Seven of the eight are genuinely enforced. hrms.leave.approval was first, its own LeaveApprovalWorkflow. Round 4 added a generic ApprovalEngine over a shared g2g_platform_approval_steps table and wired it to the other six real domains: attendance regularisation, task execution approval, competency mapping review, talent offers (a real fix rode along — offer creation no longer sends the letter itself; a chain holds it for a decision), offboarding case closure, and mobility transfer completion (paired with a real security fix — creating a transfer can no longer set its own status to Completed). One shared approvals:escalate sweep handles all six. The four older per-module paths still exist and are unchanged: Talent has talent_workflows, Leave falls back to hrms_leave_workflow_settings only when no platform chain is configured, Agentic has agentic_workflows, and Competency has its own mapping review path alongside the new one.',
    toBuild: [
      'talent.recruitment.requisition has no enforcement because it has no real underlying object yet — job postings only carry a flat active/inactive toggle, not a pending requisition a chain could attach to. This needs a real feature built first, not wiring.',
      'Migrating the four per-module paths onto these points, so there is one answer to "who signs this off" rather than five',
    ],
    // IN PROGRESS, NOT LIVE. Seven of eight declared points are really
    // enforced; the eighth has no feature to enforce yet, and the four legacy
    // paths are unmigrated. See the status note at the top of this file.
    status: 'in-progress',
    destination: { kind: 'own-route', href: '/platform-services/workflow' },
    decentralizedModules: DECENTRALIZED_MODULES,
    phase: 3,
  },
  {
    id: 'platform.scheduler',
    slug: 'scheduler',
    name: 'Scheduler',
    section: 'services',
    icon: 'CalendarClock',
    purpose: 'See what the platform runs on a timer, when it last ran, and what failed.',
    whyCentral:
      'Six commands drain the event store, recompute gates and escalate approvals. Nothing in the product shows that they exist, so a stalled one is invisible until somebody notices the symptom.',
    todayInG2g:
      'The console reads Laravel’s live schedule, so a task added to routes/console.php appears without a code change here. Runs are recorded in g2g_platform_task_runs by a listener on the framework’s own scheduler events, which covers every task registered now and later. Next-run is computed on read; a task with no recorded run reports unknown rather than "never". Two of the six tasks (leave:escalate, readiness:recompute) genuinely run per organisation — the other four drain the whole installation in one pass and correctly refuse a per-tenant override with the reason why, rather than accepting one silently. For those two, an organisation can switch the task off, run it now, and set a full custom cron expression (minute/hour/day/month/day-of-week), not just enable or disable.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'own-route', href: '/platform-services/scheduler' },
    decentralizedModules: DECENTRALIZED_MODULES,
    phase: 2,
  },
  {
    id: 'platform.integration',
    slug: 'integration',
    name: 'Integration',
    section: 'services',
    icon: 'Plug',
    purpose: 'Connect and monitor the third-party services the platform talks to.',
    whyCentral:
      'Credentials and connection state are the same problem for every provider, and a per-module answer means a per-module place to leak one.',
    todayInG2g:
      'One console over every declared provider: real env-backed status for Gemini/n8n/FCM, the honest Google OAuth stub, a summary of and link to LMS Administration & Governance (which still owns lms_integrations), and two genuinely new, configurable providers — SMTP email and an outbound webhook — backed by g2g_integration_credentials, an encrypted vault. "Test connection" makes a real SMTP handshake or a real signed HTTP POST; there is no provider here that fakes a result.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'own-route', href: '/platform-services/integration' },
    decentralizedModules: DECENTRALIZED_MODULES,
    phase: 3,
  },
  {
    id: 'platform.audit',
    slug: 'audit',
    name: 'Audit',
    section: 'services',
    icon: 'ClipboardCheck',
    purpose: 'Read the record of what changed, who changed it, and when.',
    whyCentral:
      'A trail that each module wrote its own way could not be searched across modules, which is the only way the question is ever actually asked.',
    todayInG2g:
      'g2g_audit_log is projected from the event store by AuditLogProjector and read at /settings?s=audit. Read-only by construction: the endpoint behind it is a single GET, because a trail the product can edit is not one.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'existing-route', href: '/settings?s=audit' },
    phase: 1,
  },
  {
    id: 'platform.event-bus',
    slug: 'event-bus',
    name: 'Event Bus',
    section: 'services',
    icon: 'Waypoints',
    purpose: 'Watch the event store drain: what was recorded, who consumed it, what failed.',
    whyCentral:
      'Ten projectors and reactors run off one event stream. When one stalls, every screen downstream of it goes quietly stale, and nothing currently reports that.',
    todayInG2g:
      'g2g_event and g2g_event_delivery hold a real event store with a per-consumer delivery ledger, read back by seven endpoints (summary, stream, consumers, failures, catalogue, options, and a scoped replay for stuck projectors). The console has four real tabs — Stream, Consumers, Failures, Catalogue — plus honest KPI tiles: unavailable is shown as unavailable, never a fabricated zero. "Last drain pass" reads TaskRunLedger\'s own run history for events:project, the same ledger the Scheduler console shows.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'own-route', href: '/platform-services/event-bus' },
    phase: 2,
  },

  // ── Setup & configuration ─────────────────────────────────────────────────

  {
    id: 'platform.onboarding',
    slug: 'onboarding',
    name: 'Onboarding',
    section: 'setup',
    icon: 'UserPlus',
    purpose: 'Run a new joiner through their journey, tasks and documents.',
    whyCentral:
      'Onboarding touches talent, learning and access at once, so it cannot belong to any one of them.',
    todayInG2g:
      'Talent Management > Onboarding is live, backed by eight Api/Onboarding controllers over the talent_onboarding tables. The product first-run checklist is a separate thing, at /api/onboarding/next-steps.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'existing-screen', accessLink: TALENT_ONBOARDING },
    phase: 1,
  },
  {
    id: 'platform.add-process',
    slug: 'add-process',
    name: 'Add Process',
    section: 'setup',
    icon: 'CirclePlus',
    purpose: 'Turn a written procedure into a process, its workflow and its tasks.',
    whyCentral:
      'A procedure stored as a document is unqueryable and unassignable; the same procedure stored as a structure can be given to somebody.',
    todayInG2g:
      'A written procedure is read into steps and derived tasks by a deterministic parser — no AI, and lines it cannot read are reported rather than guessed at. Publishing raises real rows in task management, tenant-scoped, and g2g_process_task records what it created so a second publish raises only what is missing.',
    toBuild: [
      'Saving the derived workflow as a chain against a declared approval point, which would connect this screen to Workflow',
    ],
    // The conversion and the publish both work. `live` is held back only because
    // the workflow half of the four steps is rendered and not yet savable as a
    // chain — the screen does what it says, and does not yet do everything the
    // four-step shape implies.
    status: 'in-progress',
    destination: { kind: 'own-route', href: '/platform-services/add-process' },
    decentralizedModules: DECENTRALIZED_MODULES,
    phase: 3,
  },
  {
    id: 'platform.fields-configuration',
    slug: 'fields-configuration',
    name: 'Fields Configuration',
    section: 'setup',
    icon: 'SlidersHorizontal',
    purpose: 'Add the fields this organisation needs to records the product ships.',
    whyCentral:
      'Every tenant needs a slightly different record, and a code change per tenant is not a product.',
    todayInG2g:
      'tblcustom_fields and tblfields_data are managed through /api/platform/fields, scoped to the signed-in organisation. The record a field can be added to is checked against an allowlist in config/platform_services.php (two today — the employee record and the leave request), and no DDL is run — values live in the existing key-value store rather than in a new column per field. Both allowlisted records render and save their fields for real: the employee edit form\'s Personal Info tab, and the leave request drawer\'s Additional Details tab.',
    toBuild: [],
    // Both allowlisted records — employee, leave request — have a real rendering
    // surface with real save. A third record widening the allowlist with no
    // rendering surface of its own would be the thing that reopens this.
    status: 'live',
    destination: { kind: 'own-route', href: '/platform-services/fields-configuration' },
    decentralizedModules: DECENTRALIZED_MODULES,
    phase: 3,
  },
  {
    id: 'platform.mobile-app-rights',
    slug: 'mobile-app-rights',
    name: 'Mobile App Rights',
    section: 'setup',
    icon: 'Smartphone',
    purpose: 'Decide which screens a role can reach from the mobile app.',
    whyCentral:
      'Mobile access is a property of a screen-and-role pair, which is what the permissions matrix already is. A separate store would be a second answer to one question.',
    todayInG2g:
      'The Mobile column in Role & Permissions writes tblgroupwise_rights_g2g.is_mobile through the same endpoint as every other right. The legacy mobile_app_menu_rights web routes are session-guarded and unreachable from this frontend.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'existing-screen', accessLink: ROLE_PERMISSIONS },
    phase: 1,
  },
  {
    id: 'platform.administration',
    slug: 'platform-administration',
    name: 'Platform Administration',
    section: 'setup',
    icon: 'LayoutDashboard',
    purpose: 'One view of every platform service and AI capability, and what state each is in.',
    whyCentral:
      'It describes the platform rather than any one module, so it has no module to live under.',
    todayInG2g: 'This console.',
    toBuild: [],
    status: 'live',
    destination: { kind: 'existing-route', href: '/platform-services' },
    phase: 1,
  },
  {
    id: 'platform.whats-coming',
    slug: 'whats-coming',
    name: "What's Coming",
    section: 'setup',
    icon: 'Map',
    purpose: 'What is not built yet, across the platform services and the AI capabilities.',
    whyCentral:
      'A roadmap maintained beside the placeholders drifts from them. This one is derived from the same records the placeholders render.',
    todayInG2g: 'Derived from the services and capabilities whose status is not live.',
    toBuild: [],
    status: 'live',
    /*
     * The href is the slug's own page, not a separate `/roadmap` route.
     *
     * An earlier draft pointed this at `/platform-services/roadmap` while the console
     * index linked every row to `/platform-services/<slug>` — so What's Coming had two
     * working URLs showing two different screens, and which one you got depended on
     * where you clicked. One address per screen.
     */
    destination: { kind: 'own-route', href: '/platform-services/whats-coming' },
    phase: 1,
  },
]
