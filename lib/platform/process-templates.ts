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
]

export function templatesForModule(module: string): ProcessTemplate[] {
  return PROCESS_TEMPLATES.filter((template) => template.module === module)
}
