import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';
import type { DecentralizedModuleKey } from '@/lib/platform/access-links';

/**
 * The Centralized AI Stack — one per top-level module, reached from Platform Services.
 *
 * WHY THESE ARE NOT THE PER-SCREEN DESCRIPTORS BESIDE THEM
 *
 * `lib/ai-stack/task-my-tasks.ts` and its siblings describe ONE screen's AI, and that stack
 * used to be mounted inside the screen. This describes the whole module, keyed by the
 * module's own `ai_modules` row (`talent_management`, `lms`, …), so a module gets an AI
 * Stack whether or not any of its screens ever had one. The two are different scopes with
 * different keys: nothing saved here lands on a screen's stack and vice versa.
 *
 * WHAT IS DECLARED AND WHAT IS LOOKED UP
 *
 * Declared: the words that are genuinely different per module — the central risk, the
 * example policy name, what a report may print. Looked up, always: every record, and the
 * module's data sources themselves, which the backend derives from the menu tree
 * (`ModuleDataSourceCatalog::forModule`). Nothing below is a count, a name or an id from
 * anybody's data.
 *
 * `route` is the module's LEVEL-1 `tblmenumaster_g2g.access_link`, because the backend
 * resolves which module a report belongs to from that link. It is deliberately not
 * `MODULE_LANDING_HREF` — Capability's landing page is its dashboard, which is not a menu
 * row, so it would resolve to no module at all.
 */

interface CentralSpec {
  /** The `ai_modules` key of the top-level module. */
  key: string;
  menuSlug: string;
  route: string;
  label: string;
  records: string;
  record: string;
  subjectEntityKey: string;
  /** A read source of the module's own, used for the default agent and the report hint. */
  primarySource: string;
  /** Whether the module has a real generative consumer — decides how a report is logged. */
  generative: boolean;
  centralRisk: string;
  policyNamePlaceholder: string;
  promptSystemDefault: string;
  reportCanPrint: string;
  groundedOn: string;
}

function build(spec: CentralSpec): AiStackModule {
  const reportOperation = `${spec.key}_register_report`;
  const agentOperation = `${spec.key}_agent_run`;

  return {
    key: spec.key,
    menuSlug: spec.menuSlug,
    label: spec.label,
    records: spec.records,
    record: spec.record,
    route: spec.route,
    subjectEntityKey: spec.subjectEntityKey,

    copy: {
      centralRisk: spec.centralRisk,
      policyNamePlaceholder: spec.policyNamePlaceholder,
      promptSystemDefault: spec.promptSystemDefault,
      reportCanPrint: spec.reportCanPrint,
      groundedOn: spec.groundedOn,
      capabilityAgent: `No domain agent is bound to ${spec.label}. The tool agent on the Automations tab still reads ${spec.label} data, read-only.`,
      capabilityWorkflow: `Approvals for ${spec.label} happen in ${spec.label} itself; no workflow is bound to this AI Stack, so nothing here pauses for an approval.`,
    },

    report: {
      defaultDataSource: spec.primarySource,
      filters: [{ key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' }],
      operation: reportOperation,
      emptyNote: `No ${spec.records} matched, so no report was created.`,
    },

    presets: [
      {
        name: `${spec.label} reader`,
        description: `Reads ${spec.label} ${spec.records} for your organisation. Changes nothing.`,
        module: spec.key,
        tools_allowed: [spec.primarySource],
        instructions: `Report ${spec.records} exactly as recorded. Never infer anything about a person from a list of ${spec.records} alone.`,
        status: 'active',
      },
    ],

    boundAgent: null,
    noAgentReason: `${spec.label} has no backend domain agent or approval workflow bound to it. The agent here is the read-only tool agent below, which runs in G2G Agentic AI.`,

    operations: {
      [reportOperation]: {
        key: reportOperation,
        label: `${spec.label} register`,
        capability: spec.generative ? 'generative' : null,
        uses: 'report_template',
        prefers: ['register'],
      },
      [agentOperation]: {
        key: agentOperation,
        label: `${spec.label} agent run`,
        capability: 'agent',
        uses: 'agent',
      },
    },
  };
}

const SPECS: Record<DecentralizedModuleKey, CentralSpec> = {
  organization: {
    key: 'organizational_management',
    menuSlug: 'organizational-management',
    route: '/module/organizational-management',
    label: 'Organisation',
    records: 'employees and departments',
    record: 'employee',
    subjectEntityKey: 'employee',
    primarySource: 'organization.employees',
    generative: false,
    centralRisk:
      'an answer about a person that the record does not support. AI may summarise who sits where; it may not infer performance, pay or suitability from the org chart.',
    policyNamePlaceholder: 'Employee record disclosure policy',
    promptSystemDefault:
      'You answer questions about the organisation structure. Use only the employee and department records you are given, never expose pay, bank or identity-document details, and never judge a person.',
    reportCanPrint: 'the names, departments, managers and headcounts come from the employee and department records rather than from a model.',
    groundedOn: 'the employee and department records — who is in which department and who reports to whom.',
  },
  hrms: {
    key: 'hrit_management',
    menuSlug: 'hrit-solutions',
    route: '/module/hrit-solutions',
    label: 'HRMS',
    records: 'leave and attendance records',
    record: 'leave request',
    subjectEntityKey: 'leave_request',
    primarySource: 'hrms.leave_requests',
    generative: false,
    centralRisk:
      'a leave or attendance pattern being read as a verdict on a person. AI may report what was recorded; it may not approve, reject or score anyone.',
    policyNamePlaceholder: 'Leave and attendance disclosure policy',
    promptSystemDefault:
      'You answer questions about leave and attendance. Use only the records you are given, never decide a request, and never describe a person as unreliable from their attendance alone.',
    reportCanPrint: 'the dates, leave types, days charged and statuses come from the leave and attendance records rather than from a model.',
    groundedOn: 'the leave requests and attendance punches recorded for your organisation.',
  },
  talent: {
    key: 'talent_management',
    menuSlug: 'talent-management',
    route: '/module/talent-management',
    label: 'Talent',
    records: 'candidates, job postings and workflows',
    record: 'application',
    subjectEntityKey: 'application',
    primarySource: 'talent.pipeline',
    generative: true,
    centralRisk:
      'a candidate being ranked or rejected by a model. AI may analyse a job description and draft assessments; it may not decide who advances.',
    policyNamePlaceholder: 'Candidate assessment policy',
    promptSystemDefault:
      'You support hiring. Work only from the job posting and application records you are given, never rank or reject a candidate, and never use a protected characteristic.',
    reportCanPrint: 'the stages, dates and offer statuses come from the recruitment records rather than from a model.',
    groundedOn: 'the applications, job postings and talent workflows recorded for your organisation.',
  },
  lms: {
    key: 'lms',
    menuSlug: 'lms',
    route: '/module/lms',
    label: 'Learning',
    records: 'courses, assessments and enrolments',
    record: 'course',
    subjectEntityKey: 'course',
    primarySource: 'lms.catalog',
    generative: true,
    centralRisk:
      'generated course or quiz content being published as if it were reviewed. AI may draft; a person must review before a learner sees it.',
    policyNamePlaceholder: 'Generated learning content policy',
    promptSystemDefault:
      'You draft learning content. Stay within the course topic you are given, mark anything you are unsure of, and never present a draft as reviewed.',
    reportCanPrint: 'the course titles, counts and completion figures come from the learning records rather than from a model.',
    groundedOn: 'the courses, assessment cycles and enrolments recorded for your organisation.',
  },
  competency: {
    key: 'capability_intelligence',
    menuSlug: 'capability-intelligence',
    route: '/module/capability-intelligence',
    label: 'Capability',
    records: 'job roles, competencies and mappings',
    record: 'job role',
    subjectEntityKey: 'jobrole',
    primarySource: 'capability.jobroles',
    generative: true,
    centralRisk:
      'a generated competency or skill objective being treated as the organisation\'s standard. AI may propose; the framework stays whatever a person approved.',
    policyNamePlaceholder: 'Competency framework policy',
    promptSystemDefault:
      'You support capability frameworks. Use only the job roles and competencies you are given, never invent a competency that is not in the framework, and mark every proposal as a draft.',
    reportCanPrint: 'the roles, competencies and mappings come from the capability records rather than from a model.',
    groundedOn: 'the job roles, competencies and entity mappings recorded for your organisation.',
  },
  task: {
    key: 'task_management',
    menuSlug: 'task-management',
    route: '/module/task-management',
    label: 'Task management',
    records: 'tasks',
    record: 'task',
    subjectEntityKey: 'task',
    primarySource: 'tasks.my_tasks',
    generative: true,
    centralRisk:
      'a classification becoming a performance judgement. AI may classify how closely a task matched its expected standard, but it may not close a task, rate a person or trigger any action.',
    policyNamePlaceholder: 'Task execution classification policy',
    promptSystemDefault:
      'You classify task execution against a defined standard. Work only from the task record you are given, never assign a score the standard does not define, and never judge the person who did the work.',
    reportCanPrint: 'the dates, priorities, statuses and assignees come from the task records rather than from a model.',
    groundedOn: 'the task records — what was assigned, to whom, and where it stands.',
  },
};

/** The Centralized AI Stack descriptor for one Platform Services module. */
export const CENTRAL_AI_STACKS: Record<DecentralizedModuleKey, AiStackModule> = Object.fromEntries(
  Object.entries(SPECS).map(([key, spec]) => [key, build(spec)]),
) as Record<DecentralizedModuleKey, AiStackModule>;
