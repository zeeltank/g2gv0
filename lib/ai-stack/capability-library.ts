import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for Capability Intelligence › Capability Library. Real AI: ESO generation
 * (EsoGenerator, AiModuleRegistry `eso_intelligence`) and the course-builder bridge.
 * Report sources: `capability.jobroles` (s_user_jobrole — the tenant-scoped one, not the
 * global s_jobrole catalogue) and `capability.competencies`.
 */
export const capabilityLibraryAiStack: AiStackModule = {
  key: 'capability_library',
  menuSlug: 'capability-library',
  label: 'Capability Library',
  records: 'job roles',
  record: 'job role',
  route: '/module/capability-intelligence/capability-library',
  subjectEntityKey: 'jobrole',

  copy: {
    centralRisk:
      'a generated Employee Skill Objective governing people\'s work unapproved. AI may draft an ESO from a task and its competencies, but an HR administrator must approve it before any task is measured against it — an invented standard would mark real work as failing.',
    policyNamePlaceholder: 'ESO generation policy',
    promptSystemDefault:
      'You draft an Employee Skill Objective: the observable standard a task is performed to. Work only from the task and competency data you are given, never invent a proficiency level the data does not imply, and never name or judge an individual.',
    reportCanPrint: 'the task and competency counts come from the job role records rather than from a model.',
    groundedOn: 'the job role records above — roles, departments, tasks and mapped competencies.',
    capabilityAgent:
      'No agent manifest is bound to the Capability Library, so nothing here opens a case. The tool agents on the Automations tab still read the job roles and competencies.',
    capabilityWorkflow:
      'ESO approval is done in the Library screen itself; no AI Stack workflow is bound here, so nothing on this tab pauses for an approval.',
  },

  report: {
    defaultDataSource: 'capability.jobroles',
    filters: [
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'category', label: 'Job role category', kind: 'text', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'jobrole_register_report',
    emptyNote: 'No job roles matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Job role reader',
      description: 'Reads job roles with category, level, department and how many tasks and competencies each has. Changes nothing.',
      module: 'capability_library',
      tools_allowed: ['capability.jobroles'],
      instructions:
        'Report job roles as recorded. A role with zero mapped competencies is unmapped, not simple — say so. Never infer anything about the people who hold a role.',
      status: 'active',
    },
    {
      name: 'Competency reader',
      description: 'Reads active and published competencies with code, type, criticality and framework. Changes nothing.',
      module: 'capability_library',
      tools_allowed: ['capability.competencies'],
      instructions:
        'Report competencies exactly as recorded. A blank framework means the competency is not in a framework yet; never invent one.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Job roles and competencies are readable, but G2G has no domain agent or AI Stack approval workflow for the Capability Library — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    jobrole_register_report: { key: 'jobrole_register_report', label: 'Job role and task register', capability: 'generative', uses: 'report_template', prefers: ['jobrole', 'register'] },
    eso_draft: { key: 'eso_draft', label: 'ESO drafted', capability: 'generative', uses: 'prompt', prefers: ['eso'] },
    capability_library_agent_run: { key: 'capability_library_agent_run', label: 'Capability Library agent run', capability: 'agent', uses: 'agent' },
  },
};
