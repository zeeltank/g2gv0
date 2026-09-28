import type { AiStackModule } from '@/components/ai-stack/ai-stack-module';

/**
 * AI Stack for Talent Management › Recruitment. Real AI: JD analysis (AnalyzeJDController)
 * and candidate assessment generation (RecruitmentAssessmentGenerator) — AiModuleRegistry
 * `recruitment_ai` and `assessment_ai`. Report sources: `talent.pipeline`,
 * `talent.job_postings`.
 */
export const talentRecruitmentAiStack: AiStackModule = {
  key: 'talent_recruitment',
  menuSlug: 'recruitment',
  label: 'Recruitment',
  records: 'candidate applications',
  record: 'application',
  route: '/module/talent-management/recruitment',
  subjectEntityKey: 'job_application',

  copy: {
    centralRisk:
      'a model screening out a candidate. AI may flag unclear or biased job-description language and draft assessment questions, but it may not reject, rank or recommend hiring anyone — a hiring decision made by a model is both unfair and unexplainable.',
    policyNamePlaceholder: 'Recruitment AI use policy',
    promptSystemDefault:
      'You support a recruiter. Work only from the job description or role skills you are given. Flag problems with a reason; never rank, reject or recommend a candidate, and never infer anything about a person from their name, gender or background.',
    reportCanPrint: 'the stage, interview and offer details come from the recruitment records rather than from a model.',
    groundedOn: 'the application records above — candidates, jobs, stages, interviews and offers.',
    capabilityAgent:
      'No agent manifest is bound to Recruitment, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the pipeline and postings.',
    capabilityWorkflow: 'Hiring workflows are configured under Talent Administration; none is bound to this AI Stack, so nothing here pauses for an approval.',
  },

  report: {
    defaultDataSource: 'talent.pipeline',
    filters: [
      { key: 'job_id', label: 'Job posting id', kind: 'number', placeholder: 'all' },
      { key: 'status', label: 'Stage', kind: 'text', placeholder: 'e.g. Shortlisted' },
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'pipeline_report',
    emptyNote: 'No applications matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Pipeline reader',
      description: 'Reads applications with candidate, job, department, stage, latest interview and offer status. Changes nothing.',
      module: 'talent_recruitment',
      tools_allowed: ['talent.pipeline'],
      instructions:
        'Report the pipeline exactly as recorded. Never score, rank or compare candidates, and never suggest who should be hired or rejected.',
      status: 'active',
    },
    {
      name: 'Job posting reader',
      description: 'Reads job postings with department, status, positions, deadline and applicant count. Changes nothing.',
      module: 'talent_recruitment',
      tools_allowed: ['talent.job_postings'],
      instructions: 'Report postings as recorded. Most postings are Inactive — repeat the recorded status rather than assuming a posting is open.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The pipeline and postings are readable, but G2G has no domain agent or AI Stack approval workflow for Recruitment — agents here are the read-only tool agents below, which run in G2G Agentic AI.',

  operations: {
    pipeline_report: { key: 'pipeline_report', label: 'Candidate pipeline report', capability: 'generative', uses: 'report_template', prefers: ['pipeline'] },
    jd_analysis: { key: 'jd_analysis', label: 'Job description analysed', capability: 'generative', uses: 'prompt', prefers: ['jd', 'analysis'] },
    recruitment_agent_run: { key: 'recruitment_agent_run', label: 'Recruitment agent run', capability: 'agent', uses: 'agent' },
  },
};
