import type { AgentModuleKey } from './types';

/**
 * Module and tool catalogues for G2G's AI Stack agents.
 *
 * SAME SHAPE AND HELPERS AS LMS_K12's `lib/agents/registry.ts`, because the shared AI
 * Stack screens (Automations, Guardrails, Create Agent, Run Agent) import these by name.
 * WHAT IS IN THEM IS G2G's:
 *
 *   AGENT_MODULES  the nine G2G submodules that have an AI Stack — the same `ai_modules`
 *                  keys the backend scopes every tab by.
 *   AGENT_TOOLS    exactly the read-only data sources in hp_erp's
 *                  `App\Domain\AI\Reports\ModuleDataSourceCatalog`, key for key. An agent
 *                  runs one by calling `POST /api/ai/tool-agents/{id}/run`, and the server
 *                  re-checks the tool belongs to the agent's module and is on its
 *                  allow-list, so this list can narrow a form but never widen access.
 *
 * Every G2G tool is `read` risk and `mcp` kind — each reads its module's records for the
 * caller's organisation and changes nothing. There are no G2G write or draft tools, and
 * none is listed as "coming soon": a tool here has an executor or it is not here.
 */

export interface AgentModule {
  key: AgentModuleKey;
  label: string;
  description: string;
}

export type ToolRisk = 'read' | 'draft' | 'write';
export type ToolKind = 'local' | 'mcp' | 'intelligence';

export interface AgentTool {
  key: string;
  label: string;
  description: string;
  /** Owning module, or `shared` for tools every module may use. */
  module: AgentModuleKey | 'shared';
  /** read = looks at data · draft = produces text, changes nothing · write = changes records. */
  risk: ToolRisk;
  /** local = runs in this engine · mcp = governed read tool · intelligence = backend domain agent. */
  kind: ToolKind;
  /** False until an executor exists. Never selectable. */
  available: boolean;
  /** Example arguments, pre-filled in the Run dialog so the operator sees the shape. */
  exampleInput: Record<string, unknown>;
}

export const SHARED_MODULE = 'shared';

export const AGENT_MODULES: AgentModule[] = [
  // The six top-level modules — the Centralized AI Stack (Platform Services). Each owns
  // every tool of the screens beneath it; see ROLLS_UP_TO.
  { key: 'organizational_management', label: 'Organisation', description: 'Organizational Management' },
  { key: 'hrit_management', label: 'HRMS', description: 'HRIT Management' },
  { key: 'talent_management', label: 'Talent', description: 'Talent Management' },
  { key: 'lms', label: 'Learning', description: 'LMS' },
  { key: 'capability_intelligence', label: 'Capability', description: 'Capability Intelligence' },
  { key: 'task_management', label: 'Task management', description: 'Task Management' },
  { key: 'lms_course_builder', label: 'Course Builder', description: 'LMS › Administration › Course Builder' },
  { key: 'lms_assessments', label: 'Assessments', description: 'LMS › Assessments' },
  { key: 'lms_my_learning', label: 'My Learning', description: 'LMS › Learning › My Learning' },
  { key: 'lms_learning_catalog', label: 'Learning Catalog', description: 'LMS › Learning › Learning Catalog' },
  { key: 'capability_library', label: 'Capability Library', description: 'Capability Intelligence › Capability Library' },
  { key: 'capability_explorer', label: 'Capability Explorer', description: 'Capability Intelligence › Capability Explorer' },
  { key: 'talent_recruitment', label: 'Recruitment', description: 'Talent Management › Recruitment' },
  { key: 'talent_administration', label: 'Talent Administration', description: 'Talent Management › Administration' },
  { key: 'task_my_tasks', label: 'My Tasks', description: 'Task Management › My Tasks' },
];

/**
 * Which top-level module each screen-level module sits under — the menu tree
 * (`tblmenumaster_g2g` parents) as hp_erp's `ModuleDataSourceCatalog` reports it in each
 * source's `rolls_up_to`. A top-level module's tools are its own plus its screens'.
 */
export const ROLLS_UP_TO: Record<string, AgentModuleKey> = {
  lms_course_builder: 'lms',
  lms_assessments: 'lms',
  lms_my_learning: 'lms',
  lms_learning_catalog: 'lms',
  capability_library: 'capability_intelligence',
  capability_explorer: 'capability_intelligence',
  talent_recruitment: 'talent_management',
  talent_administration: 'talent_management',
  task_my_tasks: 'task_management',
};

export const AGENT_TOOLS: AgentTool[] = [
  {
    key: 'organization.employees',
    label: 'Employees',
    description: 'Reads employees with job title, department, reporting manager, join date and status — no pay, bank or ID fields. Changes nothing.',
    module: 'organizational_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { department_id: null, status: null, limit: 50 },
  },
  {
    key: 'organization.departments',
    label: 'Departments',
    description: 'Reads departments with code, parent, head and employee count. Changes nothing.',
    module: 'organizational_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: null, limit: 50 },
  },
  {
    key: 'hrms.leave_requests',
    label: 'Leave requests',
    description: 'Reads leave requests with employee, leave type, dates, days charged and status. Changes nothing.',
    module: 'hrit_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { user_id: null, status: 'pending', from_date: null, limit: 50 },
  },
  {
    key: 'hrms.attendance',
    label: 'Attendance',
    description: 'Reads daily punch-in and punch-out records with work mode and status. Changes nothing.',
    module: 'hrit_management',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { user_id: null, from_date: null, limit: 50 },
  },
  {
    key: 'lms.course_builder',
    label: 'Courses — build status',
    description: 'Reads every course with its department, category and how many modules and lessons it has. Changes nothing.',
    module: 'lms_course_builder',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { department_id: null, status: 1, limit: 50 },
  },
  {
    key: 'lms.assessment_cycles',
    label: 'Assessment cycles',
    description: 'Reads each assessment cycle with participants, completions, overdue count and average score. Changes nothing.',
    module: 'lms_assessments',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: 'active', limit: 50 },
  },
  {
    key: 'lms.my_enrolments',
    label: 'Learner enrolments',
    description: 'Reads course enrolments with learner, department, course and status. Changes nothing.',
    module: 'lms_my_learning',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { user_id: null, status: 'enrolled', department_id: null, limit: 50 },
  },
  {
    key: 'lms.catalog',
    label: 'Course catalogue',
    description: 'Reads active catalogue courses with category, department and learner counts. Changes nothing.',
    module: 'lms_learning_catalog',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { category: null, department_id: null, limit: 50 },
  },
  {
    key: 'capability.jobroles',
    label: 'Job roles and their tasks',
    description: "Reads the organisation's job roles with category, level, department, task and competency counts. Changes nothing.",
    module: 'capability_library',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { department_id: null, category: null, limit: 50 },
  },
  {
    key: 'capability.competencies',
    label: 'Competencies',
    description: 'Reads active and published competencies with code, type, criticality and framework. Changes nothing.',
    module: 'capability_library',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: null, limit: 50 },
  },
  {
    key: 'capability.entity_mappings',
    label: 'Entity mappings (knowledge graph)',
    description: "Reads how the organisation's source records map onto the knowledge graph's universal entities. Changes nothing.",
    module: 'capability_explorer',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { universal_entity: null, source_system: null, limit: 50 },
  },
  {
    key: 'talent.pipeline',
    label: 'Candidate pipeline',
    description: 'Reads applications with candidate, job, department, stage, latest interview and offer status. Changes nothing.',
    module: 'talent_recruitment',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { job_id: null, status: 'Shortlisted', department_id: null, limit: 50 },
  },
  {
    key: 'talent.job_postings',
    label: 'Job postings',
    description: 'Reads job postings with department, status, positions, deadline and applicant count. Changes nothing.',
    module: 'talent_recruitment',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { status: null, limit: 50 },
  },
  {
    key: 'talent.workflows',
    label: 'Hiring and talent workflows',
    description: 'Reads talent workflows with the process they govern, status, version and stage count. Changes nothing.',
    module: 'talent_administration',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { module: 'Recruitment', status: null, limit: 50 },
  },
  {
    key: 'tasks.my_tasks',
    label: 'Tasks',
    description: 'Reads tasks with date, priority, status, approval, assignee and department. Changes nothing.',
    module: 'task_my_tasks',
    risk: 'read',
    kind: 'mcp',
    available: true,
    exampleInput: { user_id: null, status: 'PENDING', priority: null, syear: null, limit: 50 },
  },
];

export function findModule(key: string): AgentModule | undefined {
  return AGENT_MODULES.find((module) => module.key === key);
}

export function isKnownModule(key: string): boolean {
  return Boolean(findModule(key));
}

/** The permission key an agent in this module is gated on. */
export function rbacModuleKey(module: AgentModuleKey): string {
  return `agents.${module}`;
}

/** Tools a Create Agent form may offer for one module: the module's own plus shared. */
export function toolsForModule(module: AgentModuleKey): AgentTool[] {
  return AGENT_TOOLS.filter(
    (tool) => tool.module === module || ROLLS_UP_TO[tool.module] === module || tool.module === SHARED_MODULE,
  );
}

export function findTool(key: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.key === key);
}

/** The reason an allow-list is not acceptable for a module, or null if it is. */
export function validateToolsForModule(module: AgentModuleKey, toolKeys: string[]): string | null {
  const unique = Array.from(new Set(toolKeys));
  if (!unique.length) return 'Choose at least one tool.';

  const offered = new Set(toolsForModule(module).map((tool) => tool.key));
  for (const key of unique) {
    const tool = findTool(key);
    if (!tool) return `Unknown tool "${key}".`;
    if (!offered.has(key)) return `"${tool.label}" belongs to ${tool.module}, not ${module}.`;
    if (!tool.available) return `"${tool.label}" is not available yet.`;
  }
  return null;
}
