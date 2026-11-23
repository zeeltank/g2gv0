// G2G sales presentation, problem-led and branching. Every product statement comes from the G2G v1 documentation
// (lms-k12.vercel.app/docs/1.0.0/ccb, HRIT pages, REPORTS catalog, ROLES-PERMISSIONS) or the portfolio seed
// (hp_erp/config/portfolio_seed_data.json). Customer lines are typical situations written for this deck, not quotes
// from a real customer. No price, saving, ROI, client name, client count or competitor comparison is claimed, because none is documented.
const sales = require('./g2g-sales')
const mod = (id) => sales.modules.find((m) => m.id === id)
const rolesOf = (id, n = 4) => mod(id).roles.slice(0, n)

module.exports = {
  title: { name: 'G2G', line: 'Start with the problem. See how G2G solves it.', sub: 'Pick the challenge that matters most to you. We will go straight to the answer.' },
  paths: [
    {
      key: 'A', color: '0E9F8E', tile: 'Month-end HR work takes too long', tileSub: 'Attendance, leave and payroll', img: ['problems', 'problems'], native: 'attendance',
      challenge: {
        title: 'Month-end HR work takes too long',
        quote: '"Every month we chase registers, leave slips and salary sheets."',
        points: ['Attendance kept on paper registers or spreadsheets', 'Hard to see who is in, late or missing today', 'Missed punches fixed by back-and-forth', 'Salary sheets rebuilt in Excel every month'],
        cost: 'HR time goes on chasing and re-typing, and errors are easy to miss.',
      },
      ask: {
        say: '"Our Excel sheets and registers work. Why should we change?"',
        options: [
          { r: 'partial', text: 'List every feature: calendar, alerts, corrections, leave types, salary heads, Form 16, certificates and more.', react: '"That is a lot. I am not sure which part is for us."', coach: 'A feature list answers a question the customer did not ask. Start from their month-end pain.' },
          { r: 'best', text: 'Ask what month-end looks like today, then show one flow: staff punch in, corrections are approved, attendance feeds payroll, HR verifies.', react: '"That is exactly where we lose time. Show me that."', coach: 'You linked the product to their problem and used only documented steps.' },
          { r: 'poor', text: 'Promise that payroll will run by itself from day one.', react: '"By itself? We cannot risk promises like that on salaries."', coach: 'The monthly payroll run screens are still being completed, and HR verifies payroll before payment. Never promise automation that is not finished.' },
        ],
      },
      solution: {
        title: 'One flow from punch-in to payroll',
        how: [['Attendance', 'Staff punch in and out. Alerts for late arrivals, missed punches and pending corrections.'], ['Corrections', 'A correction request goes to the manager or HR for approval.'], ['Leave', 'Employees apply, managers approve, balances are kept, HR sets the policy.'], ['Payroll', 'Salary structure, Form 16 and salary certificates. Payroll is linked to attendance and HR verifies before payment.']],
        status: ['Monthly payroll run and deduction screens are still being completed', 'warn'],
        modules: 'Attendance, Leave, Payroll',
      },
      value: {
        title: 'What changes for you',
        gains: ['One live record of attendance for everyone', 'Corrections handled in one place, with approval', 'Attendance data flows into payroll', 'HR stays in control with a verification step'],
        roles: [...rolesOf('attendance', 3), ['Finance Admin', 'Works payroll processing and the monthly payroll report']],
        src: 'v1 docs: attendance-tracking, leave-management, payroll-processing, salary-structure; REPORTS catalog',
      },
    },
    {
      key: 'B', color: '0E7C86', tile: 'We do not know our people\'s skills and gaps', tileSub: 'Competency, KASBA and gap assessment', img: ['competency', 'module'], native: 'competency',
      challenge: {
        title: 'We do not know which skills our people have or need',
        quote: '"Everyone knows who is good at what, but nothing is written down."',
        points: ['No shared description of the skills each role needs', 'Skills known to individuals, not recorded anywhere', 'Role descriptions written from scratch', 'Training decided without knowing the gaps'],
        cost: 'Training and hiring decisions rest on opinion, not on a common scale.',
      },
      ask: {
        say: '"We have no skills framework. Where would we even start?"',
        options: [
          { r: 'poor', text: 'Say AI will build your whole framework for you.', react: '"AI? Show me. I do not want to start a project on a promise."', coach: 'Generative AI is planned and not yet implemented. Do not present it as available.' },
          { r: 'partial', text: 'Say G2G has a competency module and move on to the next topic.', react: '"Okay... but what would I actually do on day one?"', coach: 'Too vague. Give them a concrete starting point.' },
          { r: 'best', text: 'Show the ready KASBA library to start from, then the six-level gap assessment. Mention that some entries are still thin.', react: '"Starting from a ready library is much easier than a blank page."', coach: 'You gave a concrete start, used documented numbers, and were honest about thin entries.' },
        ],
      },
      solution: {
        title: 'Start from a ready library, then measure the gap',
        how: [['KASBA library', 'Knowledge, Ability, Skill, Behaviour, Attitude. A ready library of 3,572 job-role tasks across 268 job roles and 128 skills.'], ['Framework', 'Competency library, capability library and competency framework. Can follow the FRAC approach used in government capacity building.'], ['Gap assessment', 'Rate competencies on a six-level scale, set the expected level per role, self-rating plus a question-based assessment.'], ['Reports', 'Skills matrix, employee skills report and competency gap report.']],
        status: ['Built, no production client yet. Knowledge, ability, attitude and behaviour entries are still thin (about 10 each)', 'warn'],
        modules: 'Competency management, KASBA framework, Gap assessment',
      },
      value: {
        title: 'What changes for you',
        gains: ['One framework of roles and competencies', 'Start from a ready library, not a blank page', 'A common scale for everyone', 'Gaps visible by person and by team'],
        roles: [['Employee', 'Does a self-rating and takes the assessment'], ['Manager', 'Reviews the competency gaps of the team'], ['HR Admin', 'Sees the Competency Gap Report across the organisation']],
        src: 'portfolio seed G2G-01, G2G-02, G2G-03; v1 docs overview; REPORTS catalog',
      },
    },
    {
      key: 'C', color: '1F6FEB', tile: 'Training and appraisals are not joined up', tileSub: 'Learning and talent management', img: ['lms', 'module'], native: null,
      challenge: {
        title: 'Training and appraisals are not joined up',
        quote: '"We run courses and appraisals, but we cannot see the whole picture."',
        points: ['Training tracked on paper or in separate tools', 'Hard to know who completed what', 'Recruitment, onboarding and appraisals in separate files', 'Appraisals without a clear process'],
        cost: 'HR cannot easily show progress, and staff development stays generic.',
      },
      ask: {
        say: '"Can training be assigned automatically from each person\'s skill gaps?"',
        options: [
          { r: 'best', text: 'Be straight: courses, assignments and certificates work today, and gap reports show who needs what. Linking courses to skills is in development.', react: '"I appreciate the honesty. So I can start now and the link comes later."', coach: 'You separated built from in-development, which builds trust.' },
          { r: 'poor', text: 'Say yes, it does that today.', react: '"Good. We will plan on that being in place."', coach: 'Competency-linked learning is in development, so this creates a false expectation that will hurt delivery.' },
          { r: 'partial', text: 'Say it is coming soon, without saying what is built today.', react: '"Soon is not a date. What can I use now?"', coach: 'Honest, but incomplete. Say what works today and what is in development.' },
        ],
      },
      solution: {
        title: 'Learning and talent in one place',
        how: [['Learning', 'Course catalog and My Learning for each person. Assignments, assessments and certifications.'], ['Course Builder', 'HR and Admin create courses. Reports on progress, certificates, assignments and assessment results.'], ['Appraisals', 'A multi-step flow: self, peer, evaluator, then management confirmation.'], ['Talent', 'Recruitment, onboarding roadmaps and goal setting, succession, and offboarding.']],
        status: ['Courses linked to skills are in development', 'warn'],
        modules: 'Learning (LMS), Talent',
      },
      value: {
        title: 'What changes for you',
        gains: ['Staff learn in one place', 'HR sees progress and certificates', 'One flow from joining to leaving', 'A clear, multi-step appraisal process'],
        roles: [rolesOf('lms')[0], ['Manager', 'Follows assignment completion for the team; reviews performance in appraisals'], rolesOf('lms')[2], ['Recruiter', 'Follows the recruitment pipeline']],
        src: 'v1 docs overview and index; REPORTS catalog; portfolio G2G-04, G2G-05',
      },
    },
    {
      key: 'D', color: '0369A1', tile: 'No clear view, and wrong access for people', tileSub: 'Reports, tasks and access control', img: ['org', 'module'], native: 'reports',
      challenge: {
        title: 'Nobody has one clear view of the workforce',
        quote: '"Managers wait for HR to send numbers, and everyone sees too much or too little."',
        points: ['Numbers pulled by hand from different files', 'Managers wait for HR to send reports', 'Work delegated by calls and messages', 'Everyone sees too much, or too little'],
        cost: 'Decisions wait for reports, and sensitive records are harder to protect.',
      },
      ask: {
        say: '"Our HR data is sensitive. Who gets to see what?"',
        options: [
          { r: 'partial', text: 'Say the platform is secure and leave it there.', react: '"Secure how? I need to know who sees salaries."', coach: 'Too vague. Answer the real question: who sees what.' },
          { r: 'poor', text: 'Say everything is encrypted and certified compliant.', react: '"Certified by whom? Please put that in writing."', coach: 'No security certification or encryption statement is documented. Do not claim it.' },
          { r: 'best', text: 'Explain access by role: HR and payroll are limited by default to Super Admin, Admin, HR Manager and approve-only Principal, and your organisation can adjust the rights.', react: '"That is what I needed. Can we set it up for our own roles?"', coach: 'You answered with documented defaults and stayed within what is known.' },
        ],
      },
      solution: {
        title: 'One view, the right access for each role',
        how: [['Reports', 'A catalog across attendance, leave, payroll, talent, skills, learning and tasks. Filters by department, employee, date range and status. Export to Excel or PDF.'], ['Tasks', 'Projects, My Tasks, task calendar, department delegation, task report and an audit log.'], ['Access', 'Roles and permissions set for your organisation. Employee directory and organisation structure.'], ['Defaults', 'HR and payroll are limited to HR, admin and approvers.']],
        status: ['AI-assisted task execution is in development', 'warn'],
        modules: 'Reports and analytics, Tasks, Organisation and access',
      },
      value: {
        title: 'What changes for you',
        gains: ['One place for HR, talent, skills, learning and task reports', 'Each report shown to the roles listed for it', 'A clear owner and status for every task', 'Each role sees only what it should'],
        roles: [...rolesOf('reports', 3), ['Super Admin / Admin', 'Full access by default; adjusts rights for the organisation']],
        src: 'v1 docs REPORTS; ROLES-PERMISSIONS; portfolio G2G-06, G2G-07',
      },
    },
  ],
  concerns: [
    { id: 'price', q: 'What will it cost?', say: 'Pricing has not been fixed yet, so I will not quote a number. Let us agree the modules and the number of people, and I will bring you a written proposal by an agreed date.', why: ['Portfolio: pricing, deal band and effort are all "To fill"', 'Docs: pricing is TBD'] },
    { id: 'clients', q: 'Who else uses it?', say: 'I will be straight with you: none of the G2G modules is in production at a client yet. That is why we propose a pilot, and I will not quote client numbers I cannot back.', why: ['Portfolio: no G2G offer is "Live with client"', 'No testimonial or client count is documented'] },
    { id: 'pilot', q: 'Can we start small?', say: 'Yes, that is what we recommend: a small pilot, one or two modules, on your own data, with success measures that you choose.', why: ['This is our proposed approach, not a documented product feature'] },
  ],
  status: sales.status,
  close: {
    say: '"This looks relevant. What happens next?"',
    options: [
      { r: 'partial', text: 'Say you will send some details and check back sometime.', to: 'stalled' },
      { r: 'best', text: 'Propose a small pilot: one or two modules, your own data, success measures you choose, and a written scope by an agreed date.', to: 'won' },
      { r: 'poor', text: 'Offer a discount and ask them to sign this week.', to: 'lost' },
    ],
  },
  outcomes: {
    won: { title: 'Next step: a scoped pilot', text: 'The customer agrees to talk about a small pilot. Everything promised matches what is built today.', steps: ['Agree the one or two modules and the number of people', 'Run the pilot on your own data', 'You choose the success measures', 'We send a written proposal by an agreed date'], note: 'This is our proposed approach, not a documented product feature. Pricing is not fixed, so no number is quoted.' },
    stalled: { title: 'The deal stalls', text: 'The customer stays polite but nothing is agreed. Without a dated next step, momentum is left to chance.', lessons: ['An open-ended follow-up has no owner and no date', 'Offer a specific pilot and a date', 'Replay the closing and try again'] },
    lost: { title: 'The customer steps back', text: 'A discount nobody has authorised, and pressure to sign, make the customer doubt everything said so far.', lessons: ['Pricing is not fixed, so a discount is an invented promise', 'Pressure to sign damages trust', 'Replay the closing and try a pilot proposal'] },
  },
  // Roles that exist in the G2G v1 docs (ROLES-PERMISSIONS and the module pages). "Department Head" is not a documented G2G role; team-level work sits with Manager.
  clusterOf: { attendance: 'A', leave: 'A', payroll: 'A', competency: 'B', kasba: 'B', gap: 'B', lms: 'C', talent: 'C', tasks: 'D', reports: 'D', org: 'D' },
  roles: [
    { key: 'hr', name: 'HR Admin', color: '0E9F8E', sub: 'Runs people operations, talent and learning', match: ['HR Admin', 'HR Manager'], modules: ['attendance', 'leave', 'payroll', 'talent', 'gap', 'lms', 'reports'] },
    { key: 'mgr', name: 'Manager', color: '2F6FB0', sub: 'Leads a team: approvals, appraisals, work', match: ['Manager'], modules: ['attendance', 'leave', 'talent', 'gap', 'lms', 'tasks', 'reports'] },
    { key: 'emp', name: 'Employee', color: '7C3AED', sub: 'Punches in, applies for leave, learns', match: ['Employee'], modules: ['attendance', 'leave', 'payroll', 'gap', 'lms', 'reports'] },
    { key: 'fin', name: 'Finance Admin', color: 'C77700', sub: 'Works payroll processing and reports', match: ['Finance Admin'], modules: ['payroll', 'reports'] },
    { key: 'prin', name: 'Principal', color: '0369A1', sub: 'Leadership: approve-only access to HR and payroll', match: ['Principal'], modules: ['attendance', 'payroll', 'org'] },
    { key: 'adm', name: 'Super Admin / Admin', color: '0B1F3A', sub: 'Sets up the organisation, rights and policy', match: ['Super Admin', 'Super Admin / Admin', 'Admin'], modules: ['leave', 'org', 'tasks'] },
  ],
  find: [
    ['Attendance corrections and alerts', 'A:sol'], ['Leave approval and balances', 'A:sol'], ['Payroll, Form 16 and certificates', 'A:sol'],
    ['KASBA library and framework', 'B:sol'], ['Six-level gap assessment', 'B:sol'], ['Skills matrix and gap reports', 'B:val'],
    ['Courses, assignments and certificates', 'C:sol'], ['Appraisal flow', 'C:sol'], ['Who does what in learning and talent', 'C:val'],
    ['Reports and export', 'D:sol'], ['Tasks and audit log', 'D:sol'], ['Access by role', 'D:ask'],
    ['What will it cost?', 'q:price'], ['What is not ready yet?', 'status'],
  ],
  moduleById: Object.fromEntries(sales.modules.map((m) => [m.id, m])),
  related: {
    A: [['Reports: see the numbers', 'D:sol'], ['Skills and gaps', 'B:sol']],
    B: [['Learning and talent', 'C:sol'], ['Attendance and payroll', 'A:sol']],
    C: [['Skills and gaps', 'B:sol'], ['Reports: see the numbers', 'D:sol']],
    D: [['Attendance and payroll', 'A:sol'], ['Learning and talent', 'C:sol']],
  },
  pathUsed: { A: ['hr', 'mgr', 'emp', 'fin', 'prin'], B: ['hr', 'mgr', 'emp'], C: ['hr', 'mgr', 'emp'], D: ['adm', 'hr', 'mgr', 'fin', 'emp'] },
  sources: 'G2G v1 documentation (CCB, HRIT, REPORTS, ROLES-PERMISSIONS) and portfolio seed G2G-01 to G2G-10.',
}
