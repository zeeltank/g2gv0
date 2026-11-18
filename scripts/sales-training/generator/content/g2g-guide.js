// Salesperson guide for the G2G sales presentation. Every product statement comes from the G2G v1 documentation
// (lms-k12.vercel.app/docs/1.0.0/ccb, HRIT pages, REPORTS catalog, ROLES-PERMISSIONS) or the portfolio seed
// (hp_erp/config/portfolio_seed_data.json); the module facts themselves live in ./g2g-sales.js.
// "why" and "ask" lines are talking points for the salesperson, not product claims. No price, saving, ROI, client
// name, client count or competitor comparison appears, because none is documented.

module.exports = {
  // Per module: why the customer needs it, a discovery question to ask, and three features to demonstrate.
  // Each feature: [name, what to show (documented), why it matters to the customer]
  mod: {
    attendance: {
      why: 'Paper registers and spreadsheets make it hard to see who is in, late or missing today.',
      ask: 'How do you track attendance today, and how do you fix a missed punch?',
      features: [
        ['Punch in and out, with a calendar', 'Staff punch in and out; each person has their own calendar and history.', 'One live record for everyone'],
        ['Alerts', 'Alerts for late arrivals, missed punches and pending corrections.', 'Problems are visible the same day'],
        ['Corrections with approval', 'A missed punch becomes a correction request that the manager or HR approves.', 'Fixes happen in one place, not by back-and-forth'],
      ],
    },
    leave: {
      why: 'Leave requests and balances are tracked by hand, and approvals are scattered across managers.',
      ask: 'Who approves leave today, and how do people see their balance?',
      features: [
        ['Apply and approve', 'Employees apply; managers approve, reject or send back.', 'Everyone sees the status of a request'],
        ['Policy set-up', 'HR sets leave types, holidays, weekly offs and the approval chain.', 'The policy lives in the system, not in files'],
        ['Balances and reports', 'A balance for each person, bulk decisions for managers, and a dashboard with summary, register and balance reports.', 'Managers decide in one place; HR keeps the record'],
      ],
    },
    payroll: {
      why: 'Salary sheets are rebuilt in Excel every month, and salary heads and deductions sit in different files.',
      ask: 'How is monthly salary prepared today, and who checks it before payment?',
      features: [
        ['Salary structure', 'Earning and deduction heads (fixed or percentage), and one salary grid per department.', 'The structure is kept in one place'],
        ['Linked to attendance', 'Payroll is built from attendance data, and HR verifies it before payment.', 'Payroll from real attendance, with a control step'],
        ['Form 16 and certificates', 'Form 16 and salary certificates.', 'Documents come from the same data'],
      ],
    },
    competency: {
      why: 'There is no shared description of the skills each role needs; skills sit with individuals and are not recorded.',
      ask: 'How do you define the skills each role needs today?',
      features: [
        ['Competency library and framework', 'Competency library, capability library and competency framework.', 'One framework of roles and competencies'],
        ['Capability Explorer', 'Browse roles and their skills in the Capability Explorer.', 'Find what a role needs quickly'],
        ['Skills matrix and gap report', 'The skills matrix and the competency gap report.', 'See who has which skill at a glance'],
      ],
    },
    kasba: {
      why: 'Role descriptions get written from scratch, and there is no common language for skills across roles.',
      ask: 'Do you already have role descriptions and skill lists, or would you start from a blank page?',
      features: [
        ['What KASBA stands for', 'Knowledge, Ability, Skill, Behaviour and Attitude.', 'A common language for skills'],
        ['A ready library', '3,572 job-role tasks across 268 job roles and 128 skills, already in the platform.', 'Start from a ready library, not a blank page'],
        ['Tasks by work function', 'Tasks are grouped by critical work function.', 'Roles described by tasks and skills in one structure'],
      ],
    },
    gap: {
      why: 'Training is decided without knowing the gaps, and opinion rather than a common scale decides who needs what.',
      ask: 'How do you decide who needs training in which skill?',
      features: [
        ['Six-level scale', 'Competencies are rated on a six-level scale.', 'A common scale for everyone'],
        ['Expected level per role', 'The expected level is set for each role.', 'Gaps are measured against what the role needs'],
        ['Self-rating and assessment', 'The employee rates themselves and takes a question-based assessment; gap reports show who falls short.', 'Gaps by person and by team'],
      ],
    },
    lms: {
      why: 'Training is tracked on paper or in separate tools, so it is hard to know who completed what.',
      ask: 'How do you assign training today, and how do you know who has completed it?',
      features: [
        ['Catalog and My Learning', 'A course catalog, and My Learning for each person.', 'Staff learn in one place'],
        ['Assignments and certificates', 'Assignments, assessments and certifications.', 'HR sees progress and certificates'],
        ['Course Builder', 'HR and Admin create courses in the Course Builder.', 'Your own content, built in the platform'],
      ],
    },
    talent: {
      why: 'Recruitment, onboarding and appraisals sit in separate files, and appraisals lack a clear process.',
      ask: 'How do appraisals run today, from self-review to the final decision?',
      features: [
        ['Appraisal flow', 'Self, peer, evaluator, then management confirmation.', 'A clear, multi-step process'],
        ['Recruitment and onboarding', 'Recruitment, onboarding roadmaps and goal setting.', 'One flow from joining'],
        ['Succession and exit', 'Succession and mobility, and offboarding.', 'The same flow carries through to leaving'],
      ],
    },
    tasks: {
      why: 'Work is delegated by calls and messages, and there is no shared view of who owns what.',
      ask: 'How do you assign work and follow it up today?',
      features: [
        ['Projects and workstreams', 'Projects and workstreams with dependencies.', 'Structure for bigger pieces of work'],
        ['My Tasks and calendar', 'My Tasks and a task calendar, with delegation at department level.', 'Each person sees their own work'],
        ['Task report and audit log', 'A task report and an audit log of changes.', 'A record of who changed what'],
      ],
    },
    reports: {
      why: 'Numbers are pulled by hand from different files, and managers wait for HR to send reports.',
      ask: 'How long does it take you to get the numbers you need?',
      features: [
        ['One report catalog', 'A catalog across attendance, leave, payroll, talent, skills, learning and tasks.', 'One place for HR, skills and learning reports'],
        ['Filters', 'Filters such as department, employee, date range and status.', 'Each manager sees their own slice'],
        ['Export', 'Export to Excel or PDF (CSV on some screens).', 'Reports can be shared and filed'],
      ],
    },
    org: {
      why: 'Everyone sees too much or too little, and staff records are spread across files.',
      ask: 'Who should be able to see salaries and HR records in your organisation?',
      features: [
        ['Directory and structure', 'An employee directory and the organisation structure.', 'One directory of people'],
        ['Rights per role', 'Roles and permissions are set for your organisation.', 'Each role sees only what it should'],
        ['Safe defaults', 'By default HR and payroll are limited to HR, admin and approvers.', 'A sensible start that you can adjust'],
      ],
    },
  },

  // Live product pages for "Show live demo". Paths are real access links from the g2gv0 project (hooks/content-map-*.ts).
  // Per module: the page to open for the module, and one page per feature (null where no matching page was found).
  demoBase: 'https://g2gv0.vercel.app',
  demo: {
    attendance: { page: '/module/hrit-solutions/attendance-management/attendance-tracking', features: ['/module/hrit-solutions/attendance-management/attendance-tracking', '/module/hrit-solutions/attendance-management/attendance-tracking', '/module/hrit-solutions/attendance-management/attendance-tracking'] },
    leave: { page: '/module/hrit-solutions/leave-management/leave-dashboard', features: ['/module/hrit-solutions/leave-management/leave-requests', '/module/hrit-solutions/leave-management/leave-configuration', '/module/hrit-solutions/leave-management/leave-dashboard'] },
    payroll: { page: '/module/hrit-solutions/payroll-management/salary-structure', features: ['/module/hrit-solutions/payroll-management/salary-structure', '/module/hrit-solutions/payroll-management/monthly-payroll-report', '/module/hrit-solutions/payroll-management/form-16'] },
    competency: { page: '/module/capability-intelligence/competency-library', features: ['/module/capability-intelligence/competency-framework', '/module/capability-intelligence/capability-explorer', '/module/capability-intelligence/dashboard'] },
    kasba: { page: '/module/capability-intelligence/capability-library', features: ['/module/capability-intelligence/capability-library', '/module/capability-intelligence/capability-library', '/module/capability-intelligence/capability-library'] },
    gap: { page: '/module/talent-management/my-capability', features: ['/module/talent-management/my-capability', '/module/capability-intelligence/competency-framework', '/module/lms/training-and-records/capability-gap-inbox'] },
    lms: { page: '/module/lms/learning/learning-dashboard', features: ['/module/lms/learning/my-learning', '/module/lms/training-and-records/assignments', '/module/lms/administration/course-builder'] },
    talent: { page: '/module/talent-management/talent-dashboard', features: ['/module/talent-management/performance-reviews-and-appraisals', '/module/talent-management/recruitment', '/module/talent-management/mobility-and-succession'] },
    tasks: { page: '/module/task-management/task-management-dashboard', features: ['/module/task-management/projects-and-workstreams', '/module/task-management/my-tasks', '/module/task-management/task-audit-logs'] },
    reports: { page: '/module/hrit-solutions/attendance-management/attendance-reports', features: ['/module/hrit-solutions/attendance-management/attendance-reports', '/module/hrit-solutions/attendance-management/attendance-reports', '/module/hrit-solutions/leave-management/leave-reports'] },
    org: { page: '/module/talent-management/employee-profiles', features: ['/module/talent-management/employee-profiles', null, null] },
  },

  // Diagrams drawn for the deck, one per module, from documented facts only (v1 docs, portfolio seed, ROLES-PERMISSIONS).
  // kind 'flow' = boxes joined by arrows; 'chips' = a grid of labels; 'list' = rows without arrows.
  diagrams: {
    attendance: { title: 'A day in Attendance', kind: 'flow', steps: ['Staff punch in and out', 'Missed punch? Send a correction request', 'Manager or HR approves', 'Attendance flows into payroll'] },
    leave: { title: 'How a leave request moves', kind: 'flow', steps: ['Employee applies', 'Manager approves, rejects or sends back', 'Balance and record are kept', 'HR sets types, holidays, weekly offs and the approval chain'] },
    payroll: { title: 'From salary structure to payslip documents', kind: 'flow', steps: ['Earning and deduction heads', 'One salary grid per department', 'Payroll built from attendance', 'HR verifies before payment'], foot: 'Form 16 and salary certificates' },
    competency: { title: 'From role to skills picture', kind: 'flow', steps: ['A role', 'Competency framework: what the role needs', 'Skills matrix and gap report: who has it, who does not'] },
    kasba: { title: 'KASBA', kind: 'list', steps: ['K  Knowledge', 'A  Ability', 'S  Skill', 'B  Behaviour', 'A  Attitude'], foot: '3,572 tasks | 268 job roles | 128 skills' },
    gap: { title: 'Measuring a skills gap', kind: 'flow', steps: ['Rate competencies on six levels', 'Set the expected level for each role', 'Self-rating plus a question-based assessment', 'Gap reports by person and team'] },
    lms: { title: 'Learning in one place', kind: 'flow', steps: ['Course catalog and My Learning', 'Assignments', 'Assessments', 'Certifications and progress reports'], foot: 'Courses linked to skills: in development' },
    talent: { title: 'From joining to leaving', kind: 'flow', steps: ['Recruitment', 'Onboarding roadmap and goals', 'Appraisal: self, peer, evaluator, management', 'Succession and mobility', 'Offboarding'] },
    tasks: { title: 'From project to audit log', kind: 'flow', steps: ['Project or workstream', 'Tasks with an owner (My Tasks, calendar)', 'Status and dependencies', 'Task report and audit log'] },
    reports: { title: 'One catalog of reports', kind: 'chips', steps: ['Attendance', 'Leave', 'Payroll', 'Talent', 'Skills', 'Learning', 'Tasks'], foot: 'Filter by department, employee, date range and status. Export to Excel or PDF.' },
    org: { title: 'HR and payroll access by default', kind: 'list', steps: ['Super Admin / Admin: full access', 'HR Manager: full access', 'Principal: approve-only', 'Teacher / Accountant / Student: none'], foot: 'Rights can be adjusted for your organisation' },
  },

  // Solutions matrix: one row per business problem
  areas: {
    A: { name: 'Run HR day to day', problem: 'Month-end HR work takes too long', mods: ['attendance', 'leave', 'payroll'], value: ['One live attendance record', 'Payroll built from real attendance', 'HR verifies before payment'] },
    B: { name: 'Know and grow skills', problem: 'No clear picture of skills and gaps', mods: ['competency', 'kasba', 'gap'], value: ['A common scale for skills', 'Start from a ready library', 'Training needs based on evidence'] },
    C: { name: 'Learning and talent', problem: 'Training and appraisals are not joined up', mods: ['lms', 'talent'], value: ['HR sees progress and certificates', 'A clear appraisal process', 'One flow from joining to leaving'] },
    D: { name: 'Reports, tasks and access', problem: 'No one clear view, and the wrong access', mods: ['reports', 'tasks', 'org'], value: ['One place for reports', 'A clear owner for every task', 'Each role sees only what it should'] },
  },

  // Live conversation: the salesperson asks, then clicks what the customer says. Every option opens a different slide.
  conv: {
    A: { ask: 'How does month-end HR work run today?', c: [
      ['"Attendance is on registers, and corrections are a mess."', 'Attendance corrections', 'feat:attendance'],
      ['"We rebuild salary sheets in Excel every month."', 'Payroll from attendance', 'feat:payroll'],
      ['"Leave approvals are scattered across managers."', 'Leave approval and policy', 'feat:leave'],
      ['"Show me the whole flow."', 'The HR day-to-day solution', 'solutions'],
    ] },
    B: { ask: 'What is your biggest challenge in managing employee competencies?', c: [
      ['"We have no framework for the skills each role needs."', 'Competency management', 'mod:competency'],
      ['"We do not know where to start. There are no role descriptions."', 'The ready KASBA library', 'feat:kasba'],
      ['"We cannot tell who is short of which skill."', 'Six-level gap assessment', 'feat:gap'],
      ['"Show me the complete picture."', 'The skills solution', 'solutions'],
    ] },
    C: { ask: 'How do you run training and appraisals today?', c: [
      ['"We cannot tell who has completed which course."', 'Assignments and certificates', 'feat:lms'],
      ['"Appraisals have no clear process."', 'The appraisal flow', 'feat:talent'],
      ['"Can training follow each person\'s skill gaps?"', 'Honest answer: linking courses to skills is in development', 'mod:lms'],
      ['"Show me the complete picture."', 'The learning and talent solution', 'solutions'],
    ] },
    D: { ask: 'How do managers get their numbers, and who sees what?', c: [
      ['"Managers wait for HR to send reports."', 'Reports and filters', 'feat:reports'],
      ['"We delegate work by phone and messages."', 'Tasks and the audit log', 'feat:tasks'],
      ['"Who gets to see salaries?"', 'Access by role', 'feat:org'],
      ['"Show me the complete picture."', 'The reports, tasks and access solution', 'solutions'],
    ] },
  },

  // Customer questions: what the salesperson says (all from documented facts)
  questions: [
    { q: 'What will it cost?', say: 'Pricing has not been fixed, so I will not quote a number. Let us agree the modules and the number of people, and I will bring a written proposal by an agreed date.', why: 'Portfolio: pricing is "To fill". Docs: pricing is TBD.' },
    { q: 'Who else uses it?', say: 'None of the G2G modules is in production at a client yet. That is why we propose a small pilot, and I will not quote client numbers I cannot back.', why: 'Portfolio: no offer is "Live with client". No testimonial or client count is documented.' },
    { q: 'What is ready today?', say: 'Attendance, leave, salary structure, skills library and gap assessment are built. The monthly payroll run, courses linked to skills, and AI assistance are still being completed.', why: 'v1 docs status and the portfolio readiness list.' },
  ],
}
