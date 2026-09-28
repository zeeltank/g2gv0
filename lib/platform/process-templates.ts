/**
 * Canned starting procedures for Add Process, by module.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THESE LIVE HERE AND NOT IN A TABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * They are fixtures — the same handful of strings for every tenant, never edited
 * per organisation — not tenant data, so a `g2g_process_template` table would be a
 * database roundtrip standing in for a constant. `ProcedureParser` is unchanged:
 * a template is exactly the text the blank textarea used to hold, just with more
 * than one option and none of them a single hardcoded example.
 *
 * Each one uses the exact syntax `ProcedureParser` reads — numbered or dashed
 * steps, a trailing `(Actor)`, `[approval]` for a sign-off, and the
 * Objective/Trigger/Completion headers — so picking one and pressing "Read it"
 * behaves identically to a real procedure pasted by hand.
 */

export interface ProcessTemplate {
  key: string
  module: string
  name: string
  text: string
}

export const PROCESS_TEMPLATES: ProcessTemplate[] = [
  {
    key: 'hrms.onboarding',
    module: 'hrms',
    name: 'New joiner onboarding',
    text: `Objective: Onboard a new joiner before their first day
Trigger: An offer is accepted

1. Raise the IT equipment request (IT)
2. Confirm the signed contract is filed (HR)
3. [approval] Approve the seating allocation (Facilities Head)
4. Send the welcome email with the first-day schedule (HR)

Completion: The joiner has a laptop, a desk and a signed contract`,
  },
  {
    key: 'hrms.leave_exception',
    module: 'hrms',
    name: 'Leave taken during a blackout period',
    text: `Objective: Handle a leave request that falls inside a declared blackout period
Trigger: An employee submits leave that overlaps a blackout window

1. Flag the request for manual review (HR)
2. [approval] Approve or decline the exception (Department Head)
3. Record the reason against the request (HR)
4. Notify the employee of the outcome (HR)

Completion: The request carries a recorded decision and the employee has been told`,
  },
  {
    key: 'organization.department_close',
    module: 'organization',
    name: 'Closing a department',
    text: `Objective: Wind down a department that no longer has any active headcount
Trigger: The last employee in a department is transferred or offboarded

1. Confirm no active employee still reports to the department (HR)
2. Reassign any open tasks owned by the department (Department Head)
3. [approval] Approve the department's closure (HR Manager)
4. Mark the department inactive (HR)

Completion: The department is inactive and nothing active still points to it`,
  },
  {
    key: 'organization.new_department',
    module: 'organization',
    name: 'Standing up a new department',
    text: `Objective: Create a new department and get it ready to receive employees
Trigger: Leadership approves a new department

1. Create the department record (HR)
2. Assign a department head (HR)
3. [approval] Approve the department's budget code (Finance)
4. Announce the new department (HR)

Completion: The department exists, has a head, and can receive transfers`,
  },
  {
    key: 'talent.offer_withdrawal',
    module: 'talent',
    name: 'Withdrawing an accepted offer',
    text: `Objective: Withdraw an offer that has already been accepted
Trigger: A background check fails, or the role is cancelled before the start date

1. [approval] Approve the withdrawal (Talent Lead)
2. Notify the candidate in writing (Recruiter)
3. Cancel any onboarding tasks already raised (HR)
4. Close the requisition or re-open it for the role (Recruiter)

Completion: The candidate has been told, and no onboarding work remains open for them`,
  },
  {
    key: 'talent.new_requisition',
    module: 'talent',
    name: 'Opening a new job requisition',
    text: `Objective: Get a new role approved and live on the careers page
Trigger: A hiring manager requests a new headcount

1. Draft the job description (Hiring Manager)
2. [approval] Approve the headcount and budget (Finance)
3. [approval] Approve the final job posting (Talent Lead)
4. Publish the role to the careers page (Recruiter)

Completion: The role is live and accepting applications`,
  },
  {
    key: 'competency.certification_renewal',
    module: 'competency',
    name: 'Certification renewal reminder',
    text: `Objective: Get a certification renewed before it lapses
Trigger: A certification enters its renewal window

1. Notify the certificate holder (Notification)
2. Confirm the renewal booking or exam date (Employee)
3. [approval] Approve the renewal cost if one is required (Department Head)
4. Record the new certification once issued (HR)

Completion: The certification is renewed, or a lapse has been formally accepted`,
  },
  {
    key: 'competency.gap_remediation',
    module: 'competency',
    name: 'Closing a capability gap',
    text: `Objective: Address a skill or knowledge gap flagged against an employee
Trigger: A competency assessment or manager review raises a capability flag

1. Confirm the gap with the employee's manager (Department Head)
2. Assign the relevant learning or coaching (HR)
3. [approval] Approve the remediation plan (Department Head)
4. Re-assess once the plan is complete (HR)

Completion: The flag is resolved, or a follow-up review date is recorded`,
  },
  {
    key: 'lms.course_publishing',
    module: 'lms',
    name: 'Publishing a new course',
    text: `Objective: Get a newly built course ready for learners
Trigger: A course is drafted and content is uploaded

1. Review the course content for accuracy (Subject Matter Expert)
2. [approval] Approve the course for release (Learning Lead)
3. Assign the course to the relevant audience (HR)
4. Announce the course to enrolled learners (Notification)

Completion: The course is live and the intended audience has been enrolled`,
  },
  {
    key: 'lms.certificate_dispute',
    module: 'lms',
    name: 'Handling a disputed assessment result',
    text: `Objective: Resolve a learner's dispute over an assessment or certificate result
Trigger: A learner raises a dispute about a recorded score

1. Record the dispute and the learner's reasoning (Learning Admin)
2. Re-check the submission against the marking guide (Subject Matter Expert)
3. [approval] Approve any change to the recorded result (Learning Lead)
4. Notify the learner of the outcome (Notification)

Completion: The result stands or is corrected, and the learner has been told`,
  },
  {
    key: 'task.project_kickoff',
    module: 'task',
    name: 'Kicking off a new project',
    text: `Objective: Get a new project from approval to its first tasks in flight
Trigger: A project charter is proposed

1. [approval] Approve the project charter and budget (Department Head)
2. Assign a project owner (Department Head)
3. Break the charter into the first set of tasks (Project Owner)
4. Assign the first tasks to the team (Project Owner)

Completion: The project exists, has an owner, and its first tasks are assigned`,
  },
  {
    key: 'task.overdue_escalation',
    module: 'task',
    name: 'Escalating a significantly overdue task',
    text: `Objective: Get a badly overdue task either completed or formally reassigned
Trigger: A task passes a set number of days overdue with no update

1. Contact the assignee for a status update (Project Owner)
2. Record the reason for the delay (Project Owner)
3. [approval] Approve reassignment or a revised due date (Department Head)
4. Update the task with the agreed outcome (Project Owner)

Completion: The task is progressing again, reassigned, or formally closed with a reason recorded`,
  },
  {
    key: 'events.consumer_stalled',
    module: 'events',
    name: 'Investigating a stalled event consumer',
    text: `Objective: Get a consumer that has stopped processing events moving again
Trigger: The Event Bus console shows a consumer with a growing pending or failed count

1. Check the Event Bus Failures tab for the error the consumer is reporting (Platform Admin)
2. Confirm whether the underlying cause has since been fixed (Platform Admin)
3. [approval] Approve replaying the affected events, for a projector-kind consumer only (Platform Admin)
4. Confirm the pending count returns to normal (Platform Admin)

Completion: The consumer is caught up, or the failure is understood and tracked`,
  },
  {
    key: 'events.scheduled_task_failure',
    module: 'events',
    name: 'Responding to a failed scheduled task',
    text: `Objective: Get a scheduled task that failed its last run back to healthy
Trigger: The Scheduler console reports a task's last run as failed

1. Read the failure detail on the Scheduler console (Platform Admin)
2. Identify whether the cause is data, configuration, or an outage (Platform Admin)
3. [approval] Approve the fix before re-running (Platform Admin)
4. Run the task again and confirm it now succeeds (Platform Admin)

Completion: The task's last run shows success, or the failure is escalated with detail attached`,
  },
]

export function templatesForModule(module: string): ProcessTemplate[] {
  return PROCESS_TEMPLATES.filter((template) => template.module === module)
}
