import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for LMS › Learning › My Learning. Real AI: course recommendations
 * (courseRecommandation, AiModuleRegistry `recommendation_ai`). Report source:
 * `lms.my_enrolments`.
 */
export const lmsMyLearningAiStack: AiStackModule = {
  key: 'lms_my_learning',
  menuSlug: 'my-learning',
  label: 'My Learning',
  records: 'learner enrolments',
  record: 'enrolment',
  route: '/module/lms/learning/my-learning',
  subjectEntityKey: 'enrolment',

  copy: {
    centralRisk:
      'enrolling or ranking a person without their knowledge. AI may suggest which course to take next, but it may not enrol anyone, and the reason for a recommendation must be visible — a silent ranking decides what a person learns.',
    policyNamePlaceholder: 'Course recommendation transparency policy',
    promptSystemDefault:
      'You explain course recommendations to the employee they were made for. Base every reason only on the learning history you are given, never enrol anyone, and never compare one person with another.',
    reportCanPrint: 'the learner, course and status come from the enrolment records rather than from a model.',
    groundedOn: 'the enrolment records above — who is enrolled in what, and where it stands.',
    capabilityAgent:
      'No agent manifest is bound to My Learning, so nothing here opens a case. The tool agents on the Automations tab still read the enrolment records.',
    capabilityWorkflow: 'No workflow is bound to My Learning, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'lms.my_enrolments',
    filters: [
      { key: 'user_id', label: 'Learner (user id)', kind: 'number', placeholder: 'everyone' },
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'enrolled, in-progress, completed' },
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'enrolment_register_report',
    emptyNote: 'No enrolments matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Enrolment reader',
      description: 'Reads course enrolments with learner, department, course and status. Changes nothing.',
      module: 'lms_my_learning',
      tools_allowed: ['lms.my_enrolments'],
      instructions:
        'Report enrolments as recorded. "enrolled" is not "in progress" — repeat the recorded status. Never infer a person\'s ability from what they are enrolled in.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Enrolments are readable, but G2G has no domain agent or approval workflow for My Learning — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    enrolment_register_report: { key: 'enrolment_register_report', label: 'Learner enrolment register', capability: 'generative', uses: 'report_template', prefers: ['enrolment', 'register'] },
    recommendation_reason: { key: 'recommendation_reason', label: 'Recommendation explained', capability: 'generative', uses: 'prompt', prefers: ['why', 'recommendation'] },
    my_learning_agent_run: { key: 'my_learning_agent_run', label: 'My Learning agent run', capability: 'agent', uses: 'agent' },
  },
};
