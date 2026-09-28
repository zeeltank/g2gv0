import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for LMS › Assessments — the competency assessment-cycle workspace
 * (CmAssessmentWorkspace, AssessmentCycleController). Real AI: AI-generated assessment
 * questions (AiAssessmentController / CourseQuizGenerator). Report source:
 * `lms.assessment_cycles`.
 */
export const lmsAssessmentsAiStack: AiStackModule = {
  key: 'lms_assessments',
  menuSlug: 'assessments',
  label: 'Assessments',
  records: 'assessment cycles',
  record: 'assessment cycle',
  route: '/module/lms/assessments',
  subjectEntityKey: 'assessment_cycle',

  copy: {
    centralRisk:
      'a model deciding a person\'s result. AI may draft assessment questions, but scoring is rule-based and a proficiency rating is a person\'s decision — a generated score or a model-judged answer on someone\'s record is the failure this module must never allow.',
    policyNamePlaceholder: 'Assessment integrity policy',
    promptSystemDefault:
      'You draft assessment questions strictly from the competency or course content you are given. Never introduce a fact the content does not contain, mark exactly one option correct, and never state or estimate how a person scored.',
    reportCanPrint: 'the participant, completion and average-score figures come from the assessment records rather than from a model.',
    groundedOn: 'the assessment cycle records above — participants, completions and scores.',
    capabilityAgent:
      'No agent manifest is bound to Assessments, so nothing here opens a case. The tool agents on the Automations tab still read the cycle records.',
    capabilityWorkflow: 'No workflow is bound to Assessments, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'lms.assessment_cycles',
    filters: [
      { key: 'status', label: 'Cycle status', kind: 'text', placeholder: 'active, scheduled or closed' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'assessment_cycle_report',
    emptyNote: 'No assessment cycles matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Assessment cycle reader',
      description: 'Reads each assessment cycle with participants, completions, overdue count and average score. Changes nothing.',
      module: 'lms_assessments',
      tools_allowed: ['lms.assessment_cycles'],
      instructions:
        'Report cycles and their figures exactly as recorded. An empty average score means nobody has been scored yet — say so rather than reporting zero. Never rank or judge an individual.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Assessment cycles are readable, but G2G has no domain agent or approval workflow for Assessments — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    assessment_cycle_report: { key: 'assessment_cycle_report', label: 'Assessment cycle report', capability: 'generative', uses: 'report_template', prefers: ['cycle', 'report'] },
    assessment_question_draft: { key: 'assessment_question_draft', label: 'Assessment questions drafted', capability: 'generative', uses: 'prompt', prefers: ['question'] },
    assessments_agent_run: { key: 'assessments_agent_run', label: 'Assessments agent run', capability: 'agent', uses: 'agent' },
  },
};
