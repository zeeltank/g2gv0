/**
 * Module and dataset catalog for the Conversational AI.
 *
 * Two separate things live here:
 *
 * 1. The module list (`MODULES`), which names the m0..m6 buckets the datasets
 *    below are grouped into. The sidebar tree itself is served per-user from
 *    tblmenumaster_g2g (see useSidebarNavigation) and is not reachable from
 *    server-side code without a request, so only the stable module ids and
 *    labels are held here - never the menu/submenu tree.
 *
 * 2. The dataset registry, which maps a question-shaped dataset id onto an
 *    *existing* Laravel route. Every entry below points at a route that already
 *    exists in the backend (routes/api.php, routes/web.php) and is already used
 *    by a screen or service in this frontend - nothing here is a new API.
 *
 * Each dataset declares which resolved ids it can filter on, so the executor
 * knows to turn "Engineering" into department_id=7 before calling Laravel.
 */

export interface CatalogModule {
  id: string;
  label: string;
  short: string;
  /** Standalone modules navigate straight to their page and have no child menus. */
  standalone?: boolean;
}

/**
 * The m0..m6 module buckets every dataset below belongs to. The ids and labels
 * match what the sidebar renders for a fully-privileged profile; the menus and
 * submenus underneath them are per-user database rows and deliberately absent.
 */
export const MODULES: CatalogModule[] = [
  { id: "m0", label: "Main Dashboard", short: "Home", standalone: true },
  { id: "m1", label: "Organizational Management", short: "M1" },
  { id: "m2", label: "Competency Management", short: "M2" },
  { id: "m3", label: "Talent Management", short: "M3" },
  { id: "m4", label: "LMS", short: "M4" },
  { id: "m5", label: "HRIT Solutions", short: "M5" },
  { id: "m6", label: "Task Management", short: "M6" },
];

export type DatasetFilterKey =
  | "departmentId"
  | "employeeId"
  | "leaveTypeId"
  | "jobRoleId"
  | "userId"
  | "status"
  | "fromDate"
  | "toDate"
  | "search"
  | "limit"
  | "page"
  | "perPage"
  | "calendarYear"
  /**
   * Canonical *names*, resolved against the live directory. Needed because not
   * every endpoint filters on ids: within EmployeeSkillCoverageMatrixController,
   * /skill-gaps, /reports/skill-coverage/matrix and /reports/skill-trends all
   * compare `department` against `hrms_departments.department` (the name), while
   * /kpis compares it against `tbluser.department_id`.
   */
  | "departmentName"
  | "employeeName"
  | "leaveTypeName";

export interface DatasetFilters {
  departmentId?: string;
  employeeId?: string;
  leaveTypeId?: string;
  jobRoleId?: string;
  userId?: string;
  status?: string[];
  fromDate?: string;
  toDate?: string;
  search?: string;
  limit?: number;
  page?: number;
  perPage?: number;
  calendarYear?: string;
  /** Canonical department name as stored in the database. */
  departmentName?: string;
  employeeName?: string;
  leaveTypeName?: string;
}

export interface DatasetDefinition {
  id: string;
  /** Module id from `MODULES` (m0..m6). */
  moduleId: string;
  label: string;
  /** What a question about this dataset sounds like - used by the model. */
  description: string;
  /** The existing Laravel route, for auditing and for the "source" citation. */
  path: string;
  transport?: "api" | "web";
  method?: "GET" | "POST";
  bearer?: boolean;
  /** Filters this endpoint actually honours. Anything else is ignored. */
  supportedFilters: DatasetFilterKey[];
  /** Permission key checked against the conversation role matrix. */
  permission: string;
  /** Path segment substitution, e.g. /user-skills/{userId}. */
  pathParams?: (filters: DatasetFilters, defaults: DatasetDefaults) => Record<string, string>;
  /** Builds the endpoint specific query params from the normalised filters. */
  buildParams?: (
    filters: DatasetFilters,
    defaults: DatasetDefaults
  ) => Record<string, string | number | undefined | null>;
  buildBody?: (
    filters: DatasetFilters,
    defaults: DatasetDefaults
  ) => Record<string, unknown>;
}

export interface DatasetDefaults {
  userId?: string;
  subInstituteId?: string;
  syear?: string;
}

/** Repeatable Laravel filter: `status[0]=pending&status[1]=approved`. */
function indexedParams(key: string, values?: string[]) {
  if (!values?.length) return {};

  return values.reduce<Record<string, string>>((params, value, index) => {
    const normalized = String(value).trim();
    if (normalized && normalized !== "all") params[`${key}[${index}]`] = normalized;
    return params;
  }, {});
}

/**
 * The Leave/Attendance report endpoints read department_id / employee_id /
 * leave_type_id as arrays (see LeaveReportApiController), which is why the
 * leave service in services/hrms/leave.ts sends `department_id[0]`.
 */
function leaveScopeParams(filters: DatasetFilters) {
  return {
    ...(filters.departmentId ? { "department_id[0]": filters.departmentId } : {}),
    ...(filters.employeeId ? { "employee_id[0]": filters.employeeId } : {}),
    ...(filters.leaveTypeId ? { "leave_type_id[0]": filters.leaveTypeId } : {}),
    ...indexedParams("status", filters.status),
    ...(filters.fromDate ? { from_date: filters.fromDate } : {}),
    ...(filters.toDate ? { to_date: filters.toDate } : {}),
    ...(filters.limit ? { limit: filters.limit } : {}),
  };
}

function dateWindowParams(filters: DatasetFilters) {
  return {
    ...(filters.fromDate ? { from_date: filters.fromDate } : {}),
    ...(filters.toDate ? { to_date: filters.toDate } : {}),
  };
}

function scalarScopeParams(filters: DatasetFilters) {
  return {
    ...(filters.departmentId ? { department_id: filters.departmentId } : {}),
    ...(filters.employeeId ? { employee_id: filters.employeeId } : {}),
  };
}

export const DATASETS: DatasetDefinition[] = [
  /* ------------------------------------------------------------------ *
   * M5 - HRIT Solutions / Leave Management  (routes/api.php: /api/leave/*)
   * ------------------------------------------------------------------ */
  {
    id: "leave.dashboard",
    moduleId: "m5",
    label: "Leave dashboard KPIs",
    description:
      "Leave request counts by status (total, pending, approved, rejected, cancelled), how many people are on leave today, the caller's available balance and recent leave activity.",
    path: "/leave/dashboard",
    supportedFilters: ["departmentId"],
    permission: "leave:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "leave.trend",
    moduleId: "m5",
    label: "Leave trend by month",
    description:
      "Requests / approved / rejected for each of the 12 months of the April-March leave year.",
    path: "/leave/trend",
    supportedFilters: ["departmentId"],
    permission: "leave:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "leave.department_summary",
    moduleId: "m5",
    label: "Leave summary per department",
    description:
      "Per department leave request totals split into approved, rejected and pending.",
    path: "/leave/department-summary",
    supportedFilters: [],
    permission: "leave:data:read",
  },
  {
    id: "leave.type_distribution",
    moduleId: "m5",
    label: "Leave distribution by leave type",
    description:
      "How many leaves were taken per leave type, split into full day and half day.",
    path: "/leave/type-distribution",
    supportedFilters: ["departmentId"],
    permission: "leave:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "leave.upcoming_holidays",
    moduleId: "m5",
    label: "Upcoming holidays",
    description: "The next holidays on the leave calendar.",
    path: "/leave/holidays/upcoming",
    supportedFilters: ["limit"],
    permission: "leave:data:read",
    buildParams: (filters) => ({ limit: filters.limit ?? 5 }),
  },
  {
    id: "leave.requests",
    moduleId: "m5",
    label: "Leave requests",
    description:
      "The leave request register with employee name, department, leave type, dates, days, status, reason and approver. Use this to list or count individual leave requests, including pending approvals.",
    path: "/leave/requests",
    supportedFilters: [
      "departmentId",
      "employeeId",
      "leaveTypeId",
      "status",
      "fromDate",
      "toDate",
      "search",
      "page",
      "perPage",
    ],
    permission: "leave:data:read",
    buildParams: (filters) => ({
      ...leaveScopeParams(filters),
      ...(filters.search ? { search: filters.search } : {}),
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 25,
    }),
  },
  {
    id: "leave.balances",
    moduleId: "m5",
    label: "Leave balance for one employee",
    description:
      "Per leave type total / used / remaining balance for a single employee. Defaults to the signed in user when no employee is given.",
    path: "/leave/balances",
    supportedFilters: ["employeeId"],
    permission: "leave:data:read",
    buildParams: (filters, defaults) => ({
      employee_id: filters.employeeId ?? defaults.userId,
    }),
  },
  {
    id: "leave.report_summary",
    moduleId: "m5",
    label: "Leave report summary",
    description:
      "Leave totals per leave type with status breakdown and days, plus a department share breakdown.",
    path: "/leave/reports/summary",
    supportedFilters: [
      "departmentId",
      "employeeId",
      "leaveTypeId",
      "status",
      "fromDate",
      "toDate",
    ],
    permission: "leave:reports:read",
    buildParams: (filters) => leaveScopeParams(filters),
  },
  {
    id: "leave.report_register",
    moduleId: "m5",
    label: "Leave register report",
    description:
      "Flat row-per-leave register: employee, department, leave type, dates, days, status, approver.",
    path: "/leave/reports/register",
    supportedFilters: [
      "departmentId",
      "employeeId",
      "leaveTypeId",
      "status",
      "fromDate",
      "toDate",
      "limit",
    ],
    permission: "leave:reports:read",
    buildParams: (filters) => leaveScopeParams(filters),
  },
  {
    id: "leave.report_balance",
    moduleId: "m5",
    label: "Leave balance report for all employees",
    description:
      "Every employee with their per leave type total / used / remaining balance. Use this for questions about who has balance left across the organisation.",
    path: "/leave/reports/balance",
    supportedFilters: ["departmentId", "employeeId", "leaveTypeId", "limit"],
    permission: "leave:reports:read",
    buildParams: (filters) => leaveScopeParams(filters),
  },
  {
    id: "leave.types",
    moduleId: "m5",
    label: "Configured leave types",
    description:
      "Leave type configuration: name, code, annual quota, carry forward, status and per department allocation.",
    path: "/leave/leave-types",
    supportedFilters: [],
    permission: "leave:config:read",
  },
  {
    id: "leave.holidays",
    moduleId: "m5",
    label: "Holiday calendar",
    description: "The full configured holiday list with dates, day type and departments.",
    path: "/leave/holidays",
    supportedFilters: ["departmentId", "calendarYear"],
    permission: "leave:config:read",
    buildParams: (filters) => ({
      department_id: filters.departmentId,
      calendar_year: filters.calendarYear,
    }),
  },
  {
    id: "leave.weekdays",
    moduleId: "m5",
    label: "Weekly off pattern",
    description: "Which weekdays are full working, half day or weekend off.",
    path: "/leave/weekdays",
    supportedFilters: [],
    permission: "leave:config:read",
  },
  {
    id: "leave.distribution",
    moduleId: "m5",
    label: "Leave distribution analytics",
    description: "Leave distribution analytics across the institute.",
    path: "/leave/distribution",
    supportedFilters: ["departmentId", "fromDate", "toDate"],
    permission: "leave:reports:read",
    buildParams: (filters) => ({
      department_id: filters.departmentId,
      ...dateWindowParams(filters),
    }),
  },

  /* ------------------------------------------------------------------ *
   * M5 - HRIT Solutions / Attendance Management  (/api/attendance/*)
   * ------------------------------------------------------------------ */
  {
    id: "attendance.kpi",
    moduleId: "m5",
    label: "Attendance KPIs",
    description:
      "Present today percentage, leave utilisation and active employee count.",
    path: "/attendance/kpi",
    supportedFilters: ["departmentId", "employeeId", "fromDate", "toDate"],
    permission: "attendance:data:read",
    buildParams: (filters) => ({
      ...scalarScopeParams(filters),
      ...dateWindowParams(filters),
    }),
  },
  {
    id: "attendance.weekly_summary",
    moduleId: "m5",
    label: "Weekly attendance summary",
    description:
      "Day by day present / absent / late counts for a week, plus the punch in and punch out times behind them.",
    path: "/attendance/weekly-summary",
    supportedFilters: ["departmentId", "employeeId", "fromDate", "toDate"],
    permission: "attendance:data:read",
    buildParams: (filters) => ({
      ...scalarScopeParams(filters),
      ...dateWindowParams(filters),
    }),
  },
  {
    id: "attendance.my_attendance",
    moduleId: "m5",
    label: "My attendance calendar",
    description:
      "The signed in user's own attendance: working days, present, late, leave, absent, percentage and a day by day calendar with punch times.",
    path: "/attendance/my-attendance",
    supportedFilters: ["fromDate", "toDate"],
    permission: "attendance:self:read",
    buildParams: (filters) => dateWindowParams(filters),
  },
  {
    id: "attendance.employees",
    moduleId: "m5",
    label: "Attendance employee list",
    description:
      "Active employees available for attendance reporting, optionally within one department.",
    path: "/attendance/employees",
    supportedFilters: ["departmentId"],
    permission: "attendance:reports:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "attendance.report_filters",
    moduleId: "m5",
    label: "Attendance report filters",
    description:
      "The departments and default date window the attendance reports are scoped by.",
    path: "/attendance/report-filters",
    supportedFilters: [],
    permission: "attendance:reports:read",
  },

  /* ------------------------------------------------------------------ *
   * M1 - Organizational Management
   * ------------------------------------------------------------------ */
  {
    id: "organization.profile",
    moduleId: "m1",
    label: "Organization profile",
    description:
      "Legal name, CIN, GSTIN, PAN, registered address, industry, employee count, work week, contact details and sister organizations.",
    path: "/settings/organization_data",
    transport: "web",
    supportedFilters: [],
    permission: "organization:data:read",
  },
  {
    id: "organization.departments",
    moduleId: "m1",
    label: "Departments",
    description:
      "The department tree: main departments and their sub departments with ids.",
    path: "/departments-management",
    supportedFilters: [],
    permission: "organization:data:read",
    // DepartmentManagementController checks `type == "api"` in lower case.
    buildParams: () => ({ type: "api" }),
  },
  {
    id: "organization.employees",
    moduleId: "m1",
    label: "Employee directory",
    description:
      "Active employee records for the institute (name, employee number, email, mobile, department), optionally filtered to one department.",
    path: "/table_data",
    transport: "web",
    supportedFilters: ["departmentId"],
    permission: "organization:data:read",
    buildParams: (filters, defaults) => ({
      table: "tbluser",
      "filters[sub_institute_id]": defaults.subInstituteId,
      "filters[status]": "1",
      ...(filters.departmentId
        ? { "filters[department_id]": filters.departmentId }
        : {}),
      sort_order: "first_name",
    }),
  },

  /* ------------------------------------------------------------------ *
   * Reports & organization analytics  (/api/reports/*)
   * ------------------------------------------------------------------ */
  {
    id: "reports.kpi",
    moduleId: "m1",
    label: "Workforce KPIs",
    description:
      "Total employees, new hires in the last quarter, attrition rate and growth percentage.",
    path: "/reports/kpi",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.department_distribution",
    moduleId: "m1",
    label: "Department distribution",
    description: "How employees are distributed across departments.",
    path: "/reports/departments/distribution",
    supportedFilters: [],
    permission: "reports:data:read",
  },
  {
    id: "reports.department_summary",
    moduleId: "m1",
    label: "Department summary",
    description: "Summary statistics per department.",
    path: "/reports/departments/summary",
    supportedFilters: [],
    permission: "reports:data:read",
  },
  {
    id: "reports.department_sizes",
    moduleId: "m1",
    label: "Department sizes",
    description: "Headcount per department.",
    path: "/reports/departments/sizes",
    supportedFilters: [],
    permission: "reports:data:read",
  },
  {
    id: "reports.employee_lifecycle",
    moduleId: "m1",
    label: "Employee lifecycle",
    description: "Joiners and exits over time across the employee lifecycle.",
    path: "/reports/employees/lifecycle",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.organization_growth",
    moduleId: "m1",
    label: "Organization growth",
    description: "Headcount growth of the organization over time.",
    path: "/reports/organization/growth",
    supportedFilters: [],
    permission: "reports:data:read",
  },
  {
    id: "reports.hiring_analytics",
    moduleId: "m3",
    label: "Hiring trends",
    description: "Hiring trend analytics from job applications and postings.",
    path: "/reports/hiring-analytics",
    supportedFilters: [],
    permission: "reports:data:read",
  },
  {
    id: "reports.employee_directory_kpis",
    moduleId: "m1",
    label: "Employee directory KPIs",
    description:
      "Total employees, new hires, attrition rate and their period-over-period trends.",
    path: "/reports/employee-directory-analytics",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.employee_directory_growth",
    moduleId: "m1",
    label: "Employee directory growth",
    description: "Employee headcount growth series.",
    path: "/reports/employee-directory/growth",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.employee_directory_attrition",
    moduleId: "m1",
    label: "Attrition breakdown",
    description: "How attrition breaks down across the organization.",
    path: "/reports/employee-directory/attrition",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.job_role_distribution",
    moduleId: "m1",
    label: "Job role distribution",
    description: "How employees are distributed across job roles.",
    path: "/reports/employee-directory/job-roles/distribution",
    supportedFilters: ["departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "reports.skill_coverage_matrix",
    moduleId: "m2",
    label: "Skill coverage matrix",
    description: "Employee by skill coverage matrix with proficiency levels.",
    path: "/reports/skill-coverage/matrix",
    // Matched against hrms_departments.department - send the name.
    supportedFilters: ["departmentName", "departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department: filters.departmentName ?? "all" }),
  },
  {
    id: "reports.skill_trends",
    moduleId: "m2",
    label: "Skill trends",
    description: "How skill levels trend over time.",
    path: "/reports/skill-trends",
    // Matched against employee_skill_analytics.department - send the name.
    supportedFilters: ["departmentName", "departmentId"],
    permission: "reports:data:read",
    buildParams: (filters) => ({ department: filters.departmentName }),
  },

  /* ------------------------------------------------------------------ *
   * M2 - Competency Management
   * ------------------------------------------------------------------ */
  {
    id: "competency.skill_coverage_kpis",
    moduleId: "m2",
    label: "Skill coverage KPIs",
    description:
      "Overall skill coverage percentage, average skill gap, critical deficiencies and training urgency.",
    path: "/kpis",
    // Unlike /skill-gaps in the same controller, this one compares `department`
    // against tbluser.department_id - so the id goes out here.
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department: filters.departmentId ?? "all" }),
  },
  {
    id: "competency.skill_gaps",
    moduleId: "m2",
    label: "Skill gaps",
    description:
      "Where measured skill levels fall below the expected proficiency, per skill and department.",
    path: "/skill-gaps",
    // `department` here is matched against hrms_departments.department, so the
    // resolved *name* goes out, not the id.
    supportedFilters: ["departmentName", "departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department: filters.departmentName ?? "all" }),
  },
  {
    id: "competency.skill_heatmap",
    moduleId: "m2",
    label: "Skill heatmap",
    description: "Departments by skills heatmap of proficiency coverage.",
    path: "/skill-heatmap",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "competency.department_skills",
    moduleId: "m2",
    label: "Department skills",
    description: "Which skills are mapped to which departments.",
    path: "/department-skills",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    // DepartmentSkillController, like DepartmentManagementController, compares
    // `type` against the lower case "api" before validating the token.
    buildParams: (filters) => ({
      type: "api",
      department_id: filters.departmentId,
    }),
  },
  {
    id: "competency.user_skills",
    moduleId: "m2",
    label: "Skills of one employee",
    description:
      "The recorded skills and proficiency levels of a single employee. Requires an employee.",
    path: "/user-skills/{userId}",
    supportedFilters: ["employeeId", "userId"],
    permission: "competency:data:read",
    pathParams: (filters, defaults) => ({
      userId: filters.employeeId ?? filters.userId ?? defaults.userId ?? "",
    }),
  },
  {
    id: "competency.industries",
    moduleId: "m2",
    label: "Industries",
    description: "The industry taxonomy used by the competency library.",
    path: "/industries",
    supportedFilters: [],
    permission: "competency:data:read",
  },
  {
    id: "competency.jobroles_by_department",
    moduleId: "m2",
    label: "Job roles per department",
    description: "How job roles are distributed department by department.",
    path: "/jobroles-by-department",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "competency.department_jobroles",
    moduleId: "m2",
    label: "Job roles of one department",
    description: "The job roles that belong to a specific department.",
    path: "/department/{departmentId}/jobroles",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    pathParams: (filters) => ({ departmentId: filters.departmentId ?? "" }),
  },
  {
    id: "competency.dashboard_kpi",
    moduleId: "m2",
    label: "Competency KPI",
    description: "Competency dashboard KPI metrics computed from mapped roles and skills.",
    path: "/competency/kpi",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },
  {
    id: "competency.workload_heatmap",
    moduleId: "m2",
    label: "Workload heatmap",
    description: "Workload index per job role.",
    path: "/competency/workload-heatmap",
    supportedFilters: ["departmentId"],
    permission: "competency:data:read",
    buildParams: (filters) => ({ department_id: filters.departmentId }),
  },

  /* ------------------------------------------------------------------ *
   * M3 - Talent Management
   * ------------------------------------------------------------------ */
  {
    id: "talent.job_postings",
    moduleId: "m3",
    label: "Job postings",
    description:
      "Open and closed job postings (requisitions) with department, status and deadline.",
    path: "/job-postings",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.job_applications",
    moduleId: "m3",
    label: "Job applications",
    description:
      "Candidate applications with status (applied, shortlisted, interview, offered, hired, rejected).",
    path: "/job-applications",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.shortlisted",
    moduleId: "m3",
    label: "Shortlisted candidates",
    description: "Candidates that have been shortlisted.",
    path: "/job-applications/shortlisted",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.candidate_pipeline",
    moduleId: "m3",
    label: "Candidate pipeline",
    description: "Candidates grouped by recruitment stage.",
    path: "/candidate",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.interviews",
    moduleId: "m3",
    label: "Interview schedules",
    description: "Scheduled interviews with candidate, panel and time.",
    path: "/interview-details",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.offers",
    moduleId: "m3",
    label: "Offers",
    description: "Offers extended to candidates and their status.",
    path: "/offers",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.team_overview",
    moduleId: "m3",
    label: "Hiring team overview",
    description: "Hiring status overview and recent team updates.",
    path: "/talent/team-overview",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.acquisition_kpis",
    moduleId: "m3",
    label: "Talent acquisition KPIs",
    description: "Time to hire, offer acceptance and other acquisition KPIs.",
    path: "/talent-acquisition/kpis",
    method: "POST",
    bearer: true,
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.funnel",
    moduleId: "m3",
    label: "Recruitment funnel",
    description: "Candidate counts at each stage of the recruitment funnel.",
    path: "/talent-acquisition/funnel",
    method: "POST",
    bearer: true,
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.dropoff",
    moduleId: "m3",
    label: "Candidate drop-off",
    description: "Where candidates drop out of the hiring process.",
    path: "/talent-acquisition/dropoff",
    method: "POST",
    bearer: true,
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.requisitions",
    moduleId: "m3",
    label: "Open requisitions",
    description: "Open requisitions with ageing, paginated.",
    path: "/talent-acquisition/requisitions",
    method: "POST",
    bearer: true,
    supportedFilters: ["page", "limit"],
    permission: "talent:data:read",
    buildBody: (filters) => ({
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
      sortBy: "age",
      order: "desc",
    }),
  },
  {
    id: "talent.pending_feedback",
    moduleId: "m3",
    label: "Pending interview feedback",
    description: "Interview evaluations that are still awaiting feedback.",
    path: "/pending-feedback",
    supportedFilters: [],
    permission: "talent:data:read",
  },
  {
    id: "talent.feedback",
    moduleId: "m3",
    label: "Interview feedback",
    description: "Submitted interview evaluations and their scores.",
    path: "/feedback",
    supportedFilters: [],
    permission: "talent:data:read",
  },

  /* ------------------------------------------------------------------ *
   * M4 - LMS
   * ------------------------------------------------------------------ */
  {
    id: "lms.enrolled_courses",
    moduleId: "m4",
    label: "Enrolled courses",
    description:
      "Courses the employee is enrolled in with enrollment status and start / end dates. Defaults to the signed in user.",
    path: "/enrolled_courses",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.skill_development_progress",
    moduleId: "m4",
    label: "Skill development progress",
    description: "Learning progress against the employee's skill development plan.",
    path: "/skill-development/progress",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.learning_streak",
    moduleId: "m4",
    label: "Learning streak",
    description: "The employee's consecutive learning day streak.",
    path: "/skill-development/streak",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.weekly_goal",
    moduleId: "m4",
    label: "Weekly learning goal",
    description: "Progress against the weekly learning goal.",
    path: "/skill-development/weekly-goal",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.achievements",
    moduleId: "m4",
    label: "Learning achievements",
    description: "Badges and achievements the employee has earned.",
    path: "/skill-development/achievements",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.peer_comparison",
    moduleId: "m4",
    label: "Peer learning comparison",
    description: "How the employee's learning compares with peers.",
    path: "/skill-development/peer-comparison",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "lms.learning_calendar",
    moduleId: "m4",
    label: "Learning calendar",
    description: "Scheduled learning activities on the calendar.",
    path: "/skill-development/calendar",
    supportedFilters: ["employeeId", "userId", "fromDate", "toDate"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
      ...dateWindowParams(filters),
    }),
  },
  {
    id: "lms.rejected_task_courses",
    moduleId: "m4",
    label: "Courses for rejected task skills",
    description:
      "Courses that close the skills behind an employee's rejected tasks.",
    path: "/user-rejected-tasks-courses",
    supportedFilters: ["employeeId", "userId"],
    permission: "learning:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },

  /* ------------------------------------------------------------------ *
   * M6 - Task Management
   * ------------------------------------------------------------------ */
  {
    id: "task.counts",
    moduleId: "m6",
    label: "Task counts",
    description:
      "Daily, weekly and monthly task counts by status (Completed, In Progress, Pending).",
    path: "/tasks/counts",
    supportedFilters: ["employeeId", "userId"],
    permission: "task:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "task.daily",
    moduleId: "m6",
    label: "Daily tasks",
    description: "Tasks created today with their status and assignee.",
    path: "/tasks/daily",
    supportedFilters: ["employeeId", "userId"],
    permission: "task:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "task.weekly",
    moduleId: "m6",
    label: "Weekly tasks",
    description: "Tasks for the current week with status and assignee.",
    path: "/tasks/weekly",
    supportedFilters: ["employeeId", "userId"],
    permission: "task:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "task.monthly",
    moduleId: "m6",
    label: "Monthly tasks",
    description: "Tasks for the current month with status and assignee.",
    path: "/tasks/monthly",
    supportedFilters: ["employeeId", "userId"],
    permission: "task:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
  {
    id: "task.employee_tasks",
    moduleId: "m6",
    label: "Employee task mappings",
    description: "Which tasks are mapped to which employees.",
    path: "/get-employee-tasks",
    supportedFilters: ["employeeId", "userId"],
    permission: "task:data:read",
    buildParams: (filters, defaults) => ({
      user_id: filters.employeeId ?? filters.userId ?? defaults.userId,
    }),
  },
];

const datasetsById = new Map(DATASETS.map((dataset) => [dataset.id, dataset]));

export function getDataset(id: string) {
  return datasetsById.get(id);
}

export function listDatasetIds() {
  return DATASETS.map((dataset) => dataset.id);
}

export interface ModuleSummary {
  moduleId: string;
  label: string;
  short: string;
  standalone: boolean;
  datasets: { id: string; label: string; description: string }[];
}

/** The module list joined with the datasets each module can answer from. */
export function describeModules(): ModuleSummary[] {
  return MODULES.map((navModule) => ({
    moduleId: navModule.id,
    label: navModule.label,
    short: navModule.short,
    standalone: Boolean(navModule.standalone),
    datasets: DATASETS.filter((dataset) => dataset.moduleId === navModule.id).map(
      (dataset) => ({
        id: dataset.id,
        label: dataset.label,
        description: dataset.description,
      })
    ),
  }));
}

/** Compact dataset index for the system prompt: `id - description`. */
export function describeDatasetsForPrompt(allowedIds?: string[]) {
  const modules = describeModules();

  return modules
    .map((navModule) => {
      const datasets = navModule.datasets.filter(
        (dataset) => !allowedIds || allowedIds.includes(dataset.id)
      );

      if (!datasets.length) return null;

      const lines = datasets.map(
        (dataset) => `  - ${dataset.id}: ${dataset.description}`
      );

      return `${navModule.moduleId} ${navModule.label}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildDatasetPath(
  dataset: DatasetDefinition,
  filters: DatasetFilters,
  defaults: DatasetDefaults
) {
  if (!dataset.pathParams) {
    return { path: dataset.path, missing: [] as string[] };
  }

  const values = dataset.pathParams(filters, defaults);
  const missing: string[] = [];

  const path = dataset.path.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (!value) {
      missing.push(key);
      return "";
    }
    return encodeURIComponent(value);
  });

  return { path, missing };
}
