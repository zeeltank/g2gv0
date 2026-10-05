import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for Talent Management › Administration — configures the workflows and
 * assessment test types Recruitment's AI uses (TalentAssessmentController). Report
 * source: `talent.workflows`. (Assessment test-type blueprints hold no rows yet, so they
 * are not offered as a source.)
 */
export const talentAdministrationAiStack: AiStackModule = {
  key: 'talent_administration',
  menuSlug: 'talent-administration',
  label: 'Talent Administration',
  records: 'talent workflows',
  record: 'workflow',
  route: '/module/talent-management/administration',
  subjectEntityKey: 'talent_workflow',

  copy: {
    centralRisk:
      'changing what Recruitment\'s AI may offer without a trace. This screen decides which workflows and assessment types are live; a change here alters every hire that follows, so each change must be an administrator\'s deliberate, audited act.',
    policyNamePlaceholder: 'Talent configuration integrity policy',
    promptSystemDefault:
      'You summarise talent configuration for an administrator. List only what the records you are given show as configured, and never suggest enabling or disabling anything on your own.',
    reportCanPrint: 'the process, status, version and stage counts come from the workflow records rather than from a model.',
    groundedOn: 'the workflow records above — processes, statuses and stages.',
    capabilityAgent:
      'No agent manifest is bound to Talent Administration. The tool agent on the Automations tab still reads the workflows.',
    capabilityWorkflow: 'The workflows listed here are the talent processes themselves; none is bound to this AI Stack, so nothing on this tab pauses for an approval.',
  },

  report: {
    defaultDataSource: 'talent.workflows',
    filters: [
      { key: 'module', label: 'Process', kind: 'text', placeholder: 'e.g. Recruitment' },
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'Active or Draft' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'workflow_register_report',
    emptyNote:
      'No talent workflows matched those filters, so no report was created. An organisation that has not configured any workflow returns nothing rather than a template set.',
  },

  presets: [
    {
      name: 'Workflow reader',
      description: 'Reads talent workflows with the process they govern, status, version and stage count. Changes nothing.',
      module: 'talent_administration',
      tools_allowed: ['talent.workflows'],
      instructions: 'Report workflows exactly as configured. A Draft workflow is not in use — say so rather than describing it as live.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Workflows are readable, but G2G has no domain agent for Talent Administration — the agent here is the read-only tool agent below, which runs in G2G Agentic AI.',

  operations: {
    workflow_register_report: { key: 'workflow_register_report', label: 'Talent workflow register', capability: 'generative', uses: 'report_template', prefers: ['workflow'] },
    test_type_note: { key: 'test_type_note', label: 'Configuration change noted', capability: 'generative', uses: 'prompt', prefers: ['note'] },
    talent_administration_agent_run: { key: 'talent_administration_agent_run', label: 'Talent Administration agent run', capability: 'agent', uses: 'agent' },
  },
};
