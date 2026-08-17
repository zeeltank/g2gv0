/**
 * Deterministic question planner - the database-first entry point.
 *
 * Decides, with no LLM call at all, whether a question can be answered from G2G
 * data and which existing dataset answers it. Only questions this planner
 * cannot place fall through to the LLM.
 *
 * Nothing here contains business data. The rules map question *wording* onto
 * dataset ids that resolve to existing Laravel routes, and every entity name is
 * matched against the live directory pulled from the backend - never against a
 * hardcoded list of departments, employees or skills.
 */

import type { DatasetFilters } from "../backend/module-catalog";
import { getDataset } from "../backend/module-catalog";
import type { DirectorySnapshot } from "../backend/directory.service";

/** How the answer should read, which drives the deterministic composer. */
export type AnswerShape = "ranking" | "count" | "list" | "detail" | "summary";

/**
 * A capability that needs more than one dataset combined before it can be
 * answered. Handled by a dedicated service rather than the generic dataset loop.
 */
export type InsightKind = "department_training";

/** Metric names as returned by EmployeeSkillCoverageMatrixController::getKpiMetrics. */
export type RankMetric =
  | "trainingUrgencyIndex"
  | "avgSkillGap"
  | "criticalDeficiencies"
  | "overallSkillCoverage";

/**
 * Reads the metric out of the question when it names one, so the ranking
 * matches what was asked rather than always using the default.
 */
export function detectRankMetric(question: string): RankMetric | undefined {
  const lower = question.toLowerCase();

  if (/skill coverage|coverage/.test(lower)) return "overallSkillCoverage";
  if (/critical deficien|deficien/.test(lower)) return "criticalDeficiencies";
  if (/training urgency|urgency/.test(lower)) return "trainingUrgencyIndex";
  if (/skill gap|competency gap|gap\b/.test(lower)) return "avgSkillGap";

  return undefined;
}

export interface QuestionPlan {
  /** True when G2G data is needed to answer honestly. */
  needsData: boolean;
  /** Set when a composite insight, not a single dataset, answers the question. */
  insight?: InsightKind;
  /** True for "lowest"/"least" phrasing, which reverses the ranking. */
  ascending?: boolean;
  /**
   * The metric the question named, when it named one. "lowest skill coverage"
   * must rank on coverage, not on the default training urgency.
   */
  rankMetric?: RankMetric;
  /** True when the user asked for advice/explanation rather than records. */
  advisory: boolean;
  capability: string;
  dataset?: string;
  /** Tried in order if the primary dataset returns nothing usable. */
  fallbackDatasets: string[];
  filters: DatasetFilters;
  shape: AnswerShape;
  /** Topic the user asked about that this installation has no module for. */
  unsupportedTopic?: string;
  matchedRule?: string;
  confidence: number;
}

/* --------------------------------------------------------------------- *
 * Advisory detection
 * --------------------------------------------------------------------- */

const ADVISORY_PATTERNS = [
  /\bhow (can|could|do|would|should) (i|we|you|they|one|an? )/,
  /\bways to\b/,
  /\bhow to\b/,
  /\bwhat should\b/,
  /\bbest practice/,
  /\b(advice|tips|strategies|ideas|suggestions|recommendations) (on|for|about|to)\b/,
  /\bstrategies\b/,
  /\bwhat is the difference between\b/,
  /\bwhat are effective\b/,
  /\bexplain\b/,
  /\bwhat does .+ mean\b/,
  /\bwhy (is|are|do|does) .+ important\b/,
  /\bdefine\b/,
];

export function isAdvisoryQuestion(text: string) {
  const lower = text.toLowerCase();
  if (/\bhow (many|much)\b/.test(lower)) return false;
  return ADVISORY_PATTERNS.some((pattern) => pattern.test(lower));
}

/* --------------------------------------------------------------------- *
 * Topics this installation has no module for
 *
 * Verified against the backend: there is no fees, admissions or student
 * enrolment API in routes/*.php. Saying so is the honest answer; guessing a
 * near-miss dataset would be worse than admitting the gap.
 * --------------------------------------------------------------------- */

const UNSUPPORTED_TOPICS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "fees", pattern: /\bfee\b|\bfees\b|fee defaulter|pending fees|fee status/ },
  { topic: "admissions", pattern: /\badmission|\benquiry\b|\benquiries\b/ },
  { topic: "payroll", pattern: /\bpayroll\b|\bsalary\b|\bpayslip\b|form ?16/ },
];

/**
 * "Student" is only unsupported when it is not really a learner-in-LMS question.
 * Checked separately so "student attendance" still reports the right gap.
 */
const STUDENT_PATTERN = /\bstudent|\bstandard \d|\bdivision [a-z]\b|\bclass\b/;

/* --------------------------------------------------------------------- *
 * Dataset routing rules
 *
 * Ordered, first match wins. Each entry names an existing dataset from
 * module-catalog.ts, which in turn names an existing Laravel route.
 * --------------------------------------------------------------------- */

interface RoutingRule {
  id: string;
  pattern: RegExp;
  /** Used instead of `pattern` when the condition needs more than one signal. */
  match?: (lowerQuestion: string) => boolean;
  capability: string;
  dataset: string;
  fallbackDatasets?: string[];
  shape: AnswerShape;
  /** Default filters, e.g. status=pending for "pending leave requests". */
  filters?: DatasetFilters;
  /** Answered by a composite insight instead of a single dataset. */
  insight?: InsightKind;
}

const ROUTING_RULES: RoutingRule[] = [
  /* ---------------- Competency / skill gap ---------------- */
  {
    /**
     * Department-ranking competency questions. Matched before the generic
     * skill-gap rule so these get the department name and the department level
     * metric, not just the institute-wide numbers.
     *
     * Requires all three signals so it stays narrow: a department reference, a
     * competency/training subject, and a ranking word. Without the subject test
     * it would swallow "which departments have the most employees"; without the
     * ranking test it would swallow "what skills are available in each
     * department".
     */
    id: "competency.department_training_need",
    pattern: /department/,
    match: (lower) =>
      /\bdepartments?\b|\bdepartment-wise\b/.test(lower) &&
      /\b(training|upskilling|skills?|competenc\w*|urgency|coverage|deficien\w*|gaps?)\b/.test(
        lower
      ) &&
      /\b(need|needs|needed|require|requires|most|least|highest|lowest|biggest|smallest|worst|top|rank|priorit\w*|urgent\w*|development)\b/.test(
        lower
      ),
    capability: "department_training_need",
    // Named so follow-ups can reuse it; the insight decides the real endpoints.
    dataset: "competency.skill_coverage_kpis",
    shape: "ranking",
    insight: "department_training",
  },
  {
    id: "skill_gap.by_department",
    pattern:
      /(skill|competency|competence)\s*(gap|gaps|deficien|shortfall)|biggest .*gap|highest .*gap|gap.*by department|departments? .*(need|needs) .*training|which department .*training/,
    capability: "skill_gap",
    dataset: "competency.skill_gaps",
    fallbackDatasets: ["competency.skill_coverage_kpis", "reports.skill_coverage_matrix"],
    shape: "ranking",
  },
  {
    id: "skill_gap.lacking_skills",
    pattern:
      /(which|what) skills? (are|is) .*(lack|missing|weak|low)|skills? .*(most lacking|weakest|missing)|prioriti[sz]e .*skills?|skills? .*prioriti[sz]e|top (competency|skill) gaps?/,
    capability: "skill_gap",
    dataset: "competency.skill_gaps",
    fallbackDatasets: ["competency.skill_heatmap"],
    shape: "ranking",
  },
  {
    id: "competency.coverage",
    pattern:
      /skill coverage|competency (status|coverage|health)|competenc(y|ies) (strongest|weakest)|training urgency|critical deficienc/,
    capability: "competency_coverage",
    dataset: "competency.skill_coverage_kpis",
    fallbackDatasets: ["competency.skill_gaps"],
    shape: "summary",
  },
  {
    id: "competency.heatmap",
    pattern: /skill heatmap|heatmap|skills?\b.*\bin each department|skills? (of|for|in) (each|every|all) department|department skills/,
    capability: "competency_coverage",
    dataset: "competency.department_skills",
    fallbackDatasets: ["competency.skill_heatmap"],
    shape: "list",
  },
  {
    id: "competency.employee_skills",
    pattern:
      /(skills?|competenc(y|ies)) (of|for) [a-z]|my skills|employee .*skills?|which employees .*(need training|skill gap)/,
    capability: "employee_skills",
    dataset: "competency.user_skills",
    fallbackDatasets: ["competency.skill_gaps"],
    shape: "list",
  },
  {
    id: "competency.jobroles",
    pattern: /job ?roles?|designation/,
    capability: "job_roles",
    dataset: "competency.jobroles_by_department",
    fallbackDatasets: ["reports.job_role_distribution"],
    shape: "list",
  },

  /* ---------------- Leave ---------------- */
  {
    id: "leave.pending",
    pattern: /pending .*leave|leave .*pending|leave requests? .*(awaiting|approval)|awaiting approval/,
    capability: "leave_requests",
    dataset: "leave.requests",
    fallbackDatasets: ["leave.dashboard"],
    shape: "count",
    filters: { status: ["pending"] },
  },
  {
    id: "leave.on_leave_today",
    pattern: /on leave today|who is on leave|absent on leave/,
    capability: "leave_dashboard",
    dataset: "leave.dashboard",
    shape: "summary",
  },
  {
    id: "leave.balance",
    pattern: /leave balance|remaining leave|leave entitlement/,
    capability: "leave_balance",
    dataset: "leave.balances",
    fallbackDatasets: ["leave.report_balance"],
    shape: "summary",
  },
  {
    id: "leave.by_department",
    pattern: /leave .*by department|department .*leave|which departments? .*leave/,
    capability: "leave_reports",
    dataset: "leave.department_summary",
    fallbackDatasets: ["leave.report_summary"],
    shape: "ranking",
  },
  {
    id: "leave.by_type",
    pattern: /leave type|type of leave|which leaves? .*(used|taken) most/,
    capability: "leave_reports",
    dataset: "leave.type_distribution",
    fallbackDatasets: ["leave.types"],
    shape: "ranking",
  },
  {
    id: "leave.holidays",
    pattern: /holiday|upcoming holidays?/,
    capability: "leave_config",
    dataset: "leave.upcoming_holidays",
    fallbackDatasets: ["leave.holidays"],
    shape: "list",
  },
  {
    id: "leave.requests_generic",
    pattern: /leave requests?|leave applications?|applied for leave|leave register/,
    capability: "leave_requests",
    dataset: "leave.requests",
    fallbackDatasets: ["leave.dashboard"],
    shape: "list",
  },
  {
    id: "leave.generic",
    pattern: /\bleave\b/,
    capability: "leave_dashboard",
    dataset: "leave.dashboard",
    fallbackDatasets: ["leave.requests"],
    shape: "summary",
  },

  /* ---------------- Attendance ---------------- */
  {
    id: "attendance.my",
    pattern: /my attendance|am i present|my punch/,
    capability: "attendance_self",
    dataset: "attendance.my_attendance",
    shape: "summary",
  },
  {
    id: "attendance.absent_today",
    pattern: /absent today|today'?s absent|absenteeism|highest absent/,
    capability: "attendance_data",
    dataset: "attendance.kpi",
    fallbackDatasets: ["attendance.weekly_summary"],
    shape: "summary",
  },
  {
    id: "attendance.rate",
    pattern:
      /attendance (percentage|rate|%)|attendance for|low attendance|highest attendance|attendance summary|attendance report/,
    capability: "attendance_data",
    dataset: "attendance.kpi",
    fallbackDatasets: ["attendance.weekly_summary"],
    shape: "summary",
  },
  {
    id: "attendance.generic",
    pattern: /\battendance\b|\bpunch|check.?in|check.?out|\bpresent\b/,
    capability: "attendance_data",
    dataset: "attendance.kpi",
    fallbackDatasets: ["attendance.weekly_summary"],
    shape: "summary",
  },

  /* ---------------- Organization / employees ---------------- */
  {
    id: "org.employees_per_department",
    pattern:
      /employees? (are )?(in|per|by) each department|which departments? have the most employees|department .*(headcount|size)|employees? per department|department distribution/,
    capability: "organization_data",
    dataset: "reports.department_sizes",
    fallbackDatasets: ["reports.department_distribution", "organization.departments"],
    shape: "ranking",
  },
  {
    id: "org.department_count",
    pattern: /how many departments|number of departments|list .*departments|show .*departments|all departments/,
    capability: "organization_data",
    dataset: "organization.departments",
    shape: "count",
  },
  {
    id: "org.employee_count",
    pattern:
      /how many employees|number of employees|total employees|headcount|employee count/,
    capability: "organization_data",
    dataset: "reports.kpi",
    fallbackDatasets: ["organization.employees"],
    shape: "count",
  },
  {
    id: "org.recent_joiners",
    pattern: /joined most recently|recent (joiners|hires)|new hires|newly joined/,
    capability: "reports_data",
    dataset: "reports.employee_directory_kpis",
    fallbackDatasets: ["reports.kpi"],
    shape: "summary",
  },
  {
    id: "org.employees",
    pattern:
      /employees?|staff list|team list|employee (directory|list|details|records)|who works/,
    capability: "organization_data",
    dataset: "organization.employees",
    fallbackDatasets: ["attendance.employees"],
    shape: "list",
  },
  {
    id: "org.profile",
    pattern: /organi[sz]ation (profile|information|details)|company (profile|details)|about (the|our) (organi|company)/,
    capability: "organization_data",
    dataset: "organization.profile",
    shape: "detail",
  },

  /* ---------------- Reports / analytics ---------------- */
  {
    id: "reports.attrition",
    pattern: /attrition|turnover|churn|employees? who left|exits?\b/,
    capability: "reports_data",
    dataset: "reports.employee_directory_attrition",
    fallbackDatasets: ["reports.kpi", "reports.employee_lifecycle"],
    shape: "summary",
  },
  {
    id: "reports.growth",
    pattern: /growth|headcount trend|organi[sz]ation growth|grown over/,
    capability: "reports_data",
    dataset: "reports.organization_growth",
    fallbackDatasets: ["reports.employee_directory_growth"],
    shape: "summary",
  },
  {
    id: "reports.lifecycle",
    pattern: /lifecycle|joiners and exits/,
    capability: "reports_data",
    dataset: "reports.employee_lifecycle",
    shape: "summary",
  },
  {
    id: "reports.kpi",
    pattern: /\bkpi|workforce (metrics|kpis)|hr metrics/,
    capability: "reports_data",
    dataset: "reports.kpi",
    shape: "summary",
  },

  /* ---------------- Talent ---------------- */
  {
    id: "talent.pipeline",
    pattern: /candidate|applicant|pipeline|shortlist|hiring pipeline/,
    capability: "talent_data",
    dataset: "talent.job_applications",
    fallbackDatasets: ["talent.candidate_pipeline", "talent.funnel"],
    shape: "count",
  },
  {
    id: "talent.jobs",
    pattern: /job posting|open (role|position|requisition)|requisition|vacanc/,
    capability: "talent_data",
    dataset: "talent.job_postings",
    fallbackDatasets: ["talent.requisitions"],
    shape: "list",
  },
  {
    id: "talent.interviews",
    pattern: /interview/,
    capability: "talent_data",
    dataset: "talent.interviews",
    fallbackDatasets: ["talent.pending_feedback"],
    shape: "list",
  },
  {
    id: "talent.offers",
    pattern: /\boffer/,
    capability: "talent_data",
    dataset: "talent.offers",
    shape: "list",
  },
  {
    id: "talent.hiring",
    pattern: /hiring|recruit/,
    capability: "talent_data",
    dataset: "talent.team_overview",
    fallbackDatasets: ["reports.hiring_analytics", "talent.funnel"],
    shape: "summary",
  },

  /* ---------------- Learning / LMS ---------------- */
  {
    // Checked before the course rule so "learning progress" is not swallowed
    // by the broader course pattern.
    id: "lms.progress",
    pattern: /learning progress|learning streak|weekly goal|achievements?|learning calendar|skill development/,
    capability: "learning_data",
    dataset: "lms.skill_development_progress",
    fallbackDatasets: ["lms.learning_streak", "lms.enrolled_courses"],
    shape: "summary",
  },
  {
    id: "lms.courses",
    pattern:
      /courses?|enrol|enroll|learning catalog|training (courses?|programs?)|incomplete courses?/,
    capability: "learning_data",
    dataset: "lms.enrolled_courses",
    fallbackDatasets: ["lms.skill_development_progress"],
    shape: "list",
  },

  /* ---------------- Tasks ---------------- */
  {
    id: "task.counts",
    pattern: /how many tasks|task count|pending tasks?|tasks? .*(pending|completed|status)/,
    capability: "task_data",
    dataset: "task.counts",
    fallbackDatasets: ["task.daily"],
    shape: "summary",
  },
  {
    id: "task.generic",
    pattern: /\btasks?\b/,
    capability: "task_data",
    dataset: "task.counts",
    fallbackDatasets: ["task.weekly"],
    shape: "summary",
  },
];

/* --------------------------------------------------------------------- *
 * Filter extraction from raw text
 * --------------------------------------------------------------------- */

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Relative date windows, resolved against the real clock, never hardcoded. */
export function extractDateRange(
  text: string,
  now = new Date()
): { fromDate?: string; toDate?: string } {
  const lower = text.toLowerCase();

  const explicit = lower.match(/(\d{4}-\d{2}-\d{2}).{0,12}?(\d{4}-\d{2}-\d{2})/);
  if (explicit) return { fromDate: explicit[1], toDate: explicit[2] };

  const single = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (single) return { fromDate: single[1], toDate: single[1] };

  if (/\btoday\b/.test(lower)) {
    const today = toIsoDate(now);
    return { fromDate: today, toDate: today };
  }

  if (/\byesterday\b/.test(lower)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = toIsoDate(yesterday);
    return { fromDate: day, toDate: day };
  }

  if (/\bthis month\b|\bcurrent month\b/.test(lower)) {
    return {
      fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }

  if (/\blast month\b|\bprevious month\b/.test(lower)) {
    return {
      fromDate: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      toDate: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }

  if (/\bthis week\b|\bcurrent week\b/.test(lower)) {
    const start = new Date(now);
    // Monday-start week, matching the attendance controllers.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { fromDate: toIsoDate(start), toDate: toIsoDate(end) };
  }

  if (/\blast week\b|\bprevious week\b/.test(lower)) {
    const start = new Date(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { fromDate: toIsoDate(start), toDate: toIsoDate(end) };
  }

  if (/\bthis year\b/.test(lower)) {
    return {
      fromDate: `${now.getFullYear()}-01-01`,
      toDate: `${now.getFullYear()}-12-31`,
    };
  }

  return {};
}

const STATUS_WORDS: Array<{ status: string; pattern: RegExp }> = [
  { status: "pending", pattern: /\bpending\b|\bawaiting\b|\bunapproved\b/ },
  { status: "approved", pattern: /\bapproved\b/ },
  { status: "rejected", pattern: /\brejected\b|\bdeclined\b/ },
  { status: "cancelled", pattern: /\bcancelled\b|\bcanceled\b/ },
];

export function extractStatuses(text: string): string[] | undefined {
  const lower = text.toLowerCase();
  const found = STATUS_WORDS.filter((entry) => entry.pattern.test(lower)).map(
    (entry) => entry.status
  );

  return found.length ? found : undefined;
}

export function extractLimit(text: string): number | undefined {
  const match = text.toLowerCase().match(/\btop\s+(\d{1,3})\b|\bfirst\s+(\d{1,3})\b/);
  if (!match) return undefined;

  const value = Number(match[1] ?? match[2]);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 100) : undefined;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Finds department / employee / leave type names inside the question by
 * matching against the live directory that came from the backend. Longest name
 * wins so "Human Resources" is not shadowed by a shorter entry.
 */
/**
 * Words that appear in questions and must never be mistaken for a person, even
 * if an employee record happens to share the spelling.
 */
const NAME_STOPWORDS = new Set([
  "show", "list", "give", "find", "what", "which", "who", "how", "many", "much",
  "the", "for", "and", "all", "are", "is", "was", "were", "has", "have", "with",
  "pending", "approved", "rejected", "leave", "leaves", "attendance", "skill",
  "skills", "gap", "gaps", "department", "departments", "employee", "employees",
  "today", "yesterday", "week", "month", "year", "report", "reports", "top",
  "status", "details", "detail", "data", "count", "total", "me", "my", "our",
]);

export function extractEntityNames(
  text: string,
  directory: DirectorySnapshot | null
): Pick<DatasetFilters, "departmentName" | "employeeName" | "leaveTypeName"> {
  if (!directory) return {};

  const haystack = ` ${normalizeToken(text)} `;
  const result: Record<string, string> = {};

  const buckets: Array<[keyof DatasetFilters, { name: string }[]]> = [
    ["departmentName", directory.departments],
    ["employeeName", directory.employees],
    ["leaveTypeName", directory.leaveTypes],
  ];

  for (const [key, entries] of buckets) {
    const match = [...entries]
      .filter((entry) => entry.name && normalizeToken(entry.name).length >= 2)
      .sort((left, right) => right.name.length - left.name.length)
      .find((entry) => haystack.includes(` ${normalizeToken(entry.name)} `));

    if (match) result[key as string] = match.name;
  }

  /**
   * A partial person reference ("show attendance for Rahul") never matches a
   * full name. Fall back to a single name *part* drawn from the directory, and
   * hand the raw token on so resolveEntity can report the ambiguity when more
   * than one employee shares it - which is exactly the "which Rahul?" case.
   */
  if (!result.employeeName) {
    const questionTokens = normalizeToken(text)
      .split(" ")
      .filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token));

    const nameParts = new Map<string, number>();
    for (const employee of directory.employees) {
      for (const part of normalizeToken(employee.name).split(" ")) {
        if (part.length < 3) continue;
        nameParts.set(part, (nameParts.get(part) ?? 0) + 1);
      }
    }

    // Department and leave type names are not people - do not claim them.
    const nonPersonTokens = new Set(
      [...directory.departments, ...directory.leaveTypes].flatMap((entry) =>
        normalizeToken(entry.name).split(" ")
      )
    );

    const hit = questionTokens.find(
      (token) => nameParts.has(token) && !nonPersonTokens.has(token)
    );

    if (hit) result.employeeName = hit;
  }

  return result as Pick<
    DatasetFilters,
    "departmentName" | "employeeName" | "leaveTypeName"
  >;
}

function detectShapeOverride(text: string, ruleShape: AnswerShape): AnswerShape {
  const lower = text.toLowerCase();

  if (/\bhow many\b|\bhow much\b|\bcount\b|\btotal number\b/.test(lower)) {
    return "count";
  }

  if (/\bbiggest\b|\bhighest\b|\blowest\b|\bmost\b|\bleast\b|\btop\b|\brank\b|\bworst\b|\bbest\b/.test(lower)) {
    return "ranking";
  }

  if (/\blist\b|\bshow me\b|\bshow all\b|\bwhich .*(are|have)\b/.test(lower)) {
    return ruleShape === "count" ? "list" : ruleShape;
  }

  return ruleShape;
}

export interface PlanQuestionOptions {
  directory?: DirectorySnapshot | null;
  now?: Date;
  /** Datasets the caller's role may read; unreadable ones are skipped. */
  allowedDatasets?: string[];
}

export function planQuestion(
  question: string,
  options: PlanQuestionOptions = {}
): QuestionPlan {
  const { directory = null, now = new Date(), allowedDatasets } = options;
  const lower = question.toLowerCase();

  const advisory = isAdvisoryQuestion(question);

  /**
   * Extracted up front, not inside the matching branch, so that a follow-up
   * which matches no rule of its own ("what about Sales?") still carries the
   * filter it introduced. Without this the follow-up merge would silently reuse
   * the previous department.
   */
  const extractedFilters: DatasetFilters = {
    ...extractDateRange(question, now),
    ...(extractStatuses(question) ? { status: extractStatuses(question) } : {}),
    ...(extractLimit(question) ? { limit: extractLimit(question) } : {}),
    ...extractEntityNames(question, directory),
  };

  const basePlan: QuestionPlan = {
    needsData: false,
    advisory,
    capability: advisory ? "contextual_guidance" : "general_conversation",
    fallbackDatasets: [],
    filters: extractedFilters,
    shape: "summary",
    confidence: advisory ? 0.8 : 0.3,
  };

  if (advisory) return basePlan;

  // Modules this installation genuinely does not have.
  for (const entry of UNSUPPORTED_TOPICS) {
    if (entry.pattern.test(lower)) {
      return {
        ...basePlan,
        needsData: true,
        capability: `${entry.topic}_unsupported`,
        unsupportedTopic: entry.topic,
        confidence: 0.9,
      };
    }
  }

  const isAllowed = (dataset: string) =>
    !allowedDatasets || allowedDatasets.includes(dataset);

  for (const rule of ROUTING_RULES) {
    const matched = rule.match ? rule.match(lower) : rule.pattern.test(lower);
    if (!matched) continue;

    const candidates = [rule.dataset, ...(rule.fallbackDatasets ?? [])].filter(
      (dataset) => getDataset(dataset) && isAllowed(dataset)
    );

    if (!candidates.length) continue;

    // Rule defaults first, so anything the question actually said wins.
    const filters: DatasetFilters = {
      ...rule.filters,
      ...extractedFilters,
    };

    return {
      needsData: true,
      advisory: false,
      insight: rule.insight,
      // "lowest skill coverage" / "least training" invert the ranking.
      ascending: /\blowest\b|\bleast\b|\bsmallest\b|\bbest\b(?!\s+practice)/.test(lower),
      rankMetric: detectRankMetric(question),
      capability: rule.capability,
      dataset: candidates[0],
      fallbackDatasets: candidates.slice(1),
      filters,
      shape: detectShapeOverride(question, rule.shape),
      matchedRule: rule.id,
      confidence: 0.85,
    };
  }

  // "students in standard 7" only reaches here when no other rule matched.
  if (STUDENT_PATTERN.test(lower)) {
    return {
      ...basePlan,
      needsData: true,
      capability: "students_unsupported",
      unsupportedTopic: "students",
      confidence: 0.75,
    };
  }

  return basePlan;
}
