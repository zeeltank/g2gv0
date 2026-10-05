import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for Task Management › My Tasks. Real AI: task-execution classification against
 * the ESO a duty defines (TaskExecutionClassifier, AiModuleRegistry `eso_intelligence`).
 * Report source: `tasks.my_tasks`.
 */
export const taskMyTasksAiStack: AiStackModule = {
  key: 'task_my_tasks',
  menuSlug: 'my-tasks',
  label: 'My Tasks',
  records: 'tasks',
  record: 'task',
  route: '/module/task-management/my-tasks',
  subjectEntityKey: 'task',

  copy: {
    centralRisk:
      'a classification becoming a performance judgement. AI may classify how closely a task matched its expected standard, but it is advisory only — it may not close a task, rate a person or trigger any action.',
    policyNamePlaceholder: 'Task execution classification policy',
    promptSystemDefault:
      'You classify task execution against a defined standard (ESO). Work only from the task record and ESO text you are given, never assign a score the ESO does not define, and never judge the person who did the work.',
    reportCanPrint: 'the dates, priorities, statuses and assignees come from the task records rather than from a model.',
    groundedOn: 'the task records above — what was assigned, to whom, and where it stands.',
    capabilityAgent:
      'No agent manifest is bound to My Tasks, so nothing here opens a case. The tool agent on the Automations tab still reads the tasks.',
    capabilityWorkflow: 'Task approvals happen in Task Management itself; no workflow is bound to this AI Stack, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'tasks.my_tasks',
    filters: [
      { key: 'user_id', label: 'Assignee (user id)', kind: 'number', placeholder: 'everyone' },
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'PENDING, IN-PROGRESS, COMPLETED' },
      { key: 'priority', label: 'Priority', kind: 'text', placeholder: 'High, Medium, Low' },
      { key: 'syear', label: 'Year', kind: 'text', placeholder: 'e.g. 2026' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'task_register_report',
    emptyNote: 'No tasks matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Task reader',
      description: 'Reads tasks with date, priority, status, approval, assignee and department. Changes nothing.',
      module: 'task_my_tasks',
      tools_allowed: ['tasks.my_tasks'],
      instructions:
        'Report tasks exactly as recorded. A task with no status is pending. Never describe a person as slow or late from the task list alone.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Tasks are readable, but G2G has no domain agent or AI Stack approval workflow for My Tasks — the agent here is the read-only tool agent below, which runs in G2G Agentic AI.',

  operations: {
    task_register_report: { key: 'task_register_report', label: 'Task register', capability: 'generative', uses: 'report_template', prefers: ['task', 'register'] },
    execution_classification: { key: 'execution_classification', label: 'Task execution classified', capability: 'generative', uses: 'prompt', prefers: ['classification'] },
    my_tasks_agent_run: { key: 'my_tasks_agent_run', label: 'My Tasks agent run', capability: 'agent', uses: 'agent' },
  },
};
