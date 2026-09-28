import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for LMS › Administration › Course Builder.
 *
 * Real AI here: AiCourseController (outline, deck via GammaService) and CourseQuizGenerator,
 * AiModuleRegistry key `lms_content_ai`. Report source: `lms.course_builder` (sub_std_map +
 * chapter_master + content_master). `route` is this screen's own tblmenumaster_g2g
 * access_link, which is how the backend resolves the module a report is built from.
 */
export const lmsCourseBuilderAiStack: AiStackModule = {
  key: 'lms_course_builder',
  menuSlug: 'course-builder',
  label: 'Course Builder',
  records: 'courses',
  record: 'course',
  route: '/module/lms/administration/course-builder',
  subjectEntityKey: 'course',

  copy: {
    centralRisk:
      'a generated outline, deck or quiz reaching learners unreviewed. AI drafts course content here, so every generated module, lesson and question must be read and edited by the author before a course is published — a confident but wrong lesson is taught to every learner who enrols.',
    policyNamePlaceholder: 'Course content generation policy',
    promptSystemDefault:
      'You draft course material for a corporate learning platform. Work only from the course title, audience and objectives you are given. Never invent a prerequisite, duration, regulation or fact the author did not supply, and flag anywhere the brief is too thin to draft from.',
    reportCanPrint: 'the module and lesson counts come from the course records themselves rather than from a model.',
    groundedOn: 'the course records above — titles, departments, modules and lessons.',
    capabilityAgent:
      'No agent manifest is bound to Course Builder, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the course records.',
    capabilityWorkflow: 'No workflow is bound to Course Builder, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'lms.course_builder',
    filters: [
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'status', label: 'Status (1 active, 0 inactive)', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'course_build_report',
    emptyNote: 'No courses matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Course build reader',
      description: 'Reads every course with its department and how many modules and lessons it has. Changes nothing.',
      module: 'lms_course_builder',
      tools_allowed: ['lms.course_builder'],
      instructions:
        'Report courses exactly as recorded. A course with zero modules or lessons is an unbuilt course — say so rather than describing it as complete. Never estimate a duration or passing score that is not recorded.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Course records are readable, but G2G has no domain agent or approval workflow for Course Builder — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    course_build_report: { key: 'course_build_report', label: 'Course build status report', capability: 'generative', uses: 'report_template', prefers: ['build', 'report'] },
    course_outline_draft: { key: 'course_outline_draft', label: 'Course outline drafted', capability: 'generative', uses: 'prompt', prefers: ['outline'] },
    course_builder_agent_run: { key: 'course_builder_agent_run', label: 'Course Builder agent run', capability: 'agent', uses: 'agent' },
  },
};
