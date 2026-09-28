import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for LMS › Learning › Learning Catalog. Real AI: the Build-with-AI sheet
 * (ai-course-sheet.tsx → AiCourseController), AiModuleRegistry `lms_content_ai`.
 * Report source: `lms.catalog`.
 */
export const lmsLearningCatalogAiStack: AiStackModule = {
  key: 'lms_learning_catalog',
  menuSlug: 'learning-catalog',
  label: 'Learning Catalog',
  records: 'catalogue courses',
  record: 'course',
  route: '/module/lms/learning/learning-catalog',
  subjectEntityKey: 'course',

  copy: {
    centralRisk:
      'a generated course being published straight into the catalogue. The Build-with-AI sheet can draft a whole course from one line; it must be reviewed and confirmed by an author before anyone can enrol, or the catalogue fills with plausible but untested material.',
    policyNamePlaceholder: 'Catalogue quick-create policy',
    promptSystemDefault:
      'You expand a short course idea into a structured brief — audience, objectives and module count — for an author to approve. Never invent a constraint, regulation or fact the author did not state.',
    reportCanPrint: 'the categories and learner counts come from the catalogue records rather than from a model.',
    groundedOn: 'the catalogue records above — courses, categories and how many people are learning each.',
    capabilityAgent:
      'No agent manifest is bound to the Learning Catalog, so nothing here opens a case. The tool agents on the Automations tab still read the catalogue.',
    capabilityWorkflow: 'No workflow is bound to the Learning Catalog, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'lms.catalog',
    filters: [
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'all' },
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'catalogue_overview_report',
    emptyNote: 'No active courses matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Catalogue reader',
      description: 'Reads active catalogue courses with category, department and learner counts. Changes nothing.',
      module: 'lms_learning_catalog',
      tools_allowed: ['lms.catalog'],
      instructions:
        'Report the catalogue as recorded. A course with no learners is available, not unpopular — do not rank courses by quality from their enrolment counts.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The catalogue is readable, but G2G has no domain agent or approval workflow for it — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    catalogue_overview_report: { key: 'catalogue_overview_report', label: 'Course catalogue overview', capability: 'generative', uses: 'report_template', prefers: ['catalogue', 'overview'] },
    quick_create_brief: { key: 'quick_create_brief', label: 'Quick-create brief drafted', capability: 'generative', uses: 'prompt', prefers: ['brief'] },
    learning_catalog_agent_run: { key: 'learning_catalog_agent_run', label: 'Learning Catalog agent run', capability: 'agent', uses: 'agent' },
  },
};
