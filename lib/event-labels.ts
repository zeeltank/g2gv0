/**
 * EVENT NAMES, IN ENGLISH.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A FUNCTION AND NOT JUST A MAP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The audit filter was showing people this:
 *
 *     employee.role_assigned
 *     task_execution.approved
 *     task.schedule_updated
 *
 * A hardcoded map was the obvious fix and the wrong one. `EventCatalogue`
 * defines 25 event types; `g2g_audit_log` on dev already holds 16, and SEVEN of
 * those are not in the catalogue at all — `task.created`, `task.archived`,
 * `task.legacy_updated`, `task.workspace_updated`, `candidate.assessment.graded`
 * and friends. Any map is out of date the day somebody adds an event, and the
 * failure is silent: a raw dotted string reappears in a dropdown.
 *
 * So the map handles the cases where plain English differs from the event name
 * in a way worth having ("rights.changed" is about ACCESS, not "rights"), and
 * everything else falls through to a humaniser that is always at least
 * readable. An unmapped `task.schedule_updated` reads "Task schedule updated" —
 * not perfect, but a sentence rather than a symbol.
 */

/**
 * Where plain English differs from a mechanical transform of the event name.
 *
 * Keep this short. If an entry only re-spaces the words, delete it — the
 * humaniser already does that, and a redundant entry is one more thing to keep
 * in step.
 */
const NAMED: Record<string, string> = {
  'rights.changed': 'Access changed',
  'employee.hired': 'Somebody was hired',
  'employee.offboarded': 'Somebody left',
  'employee.role_assigned': 'Somebody’s role changed',
  'leave.submitted': 'Leave requested',
  'leave.decided': 'Leave approved or declined',
  'leave.escalated': 'Leave escalated',
  'task.rejected': 'Task sent back',
  'task.reopened': 'Task reopened',
  'task.overdue': 'Task went overdue',
  'task.legacy_updated': 'Task changed (older record)',
  'task_execution.approved': 'Task work approved',
  'task_execution.reset': 'Task work reset',
  'attendance.corrected': 'Attendance corrected',
  'attendance.regularisation.decided': 'Attendance correction decided',
  'capability.flag_raised': 'A capability concern was raised',
  'capability.flag_resolved': 'A capability concern was resolved',
  'competency.gap_detected': 'A skill gap was found',
  'development_plan.approved': 'Development plan approved',
  'certification.issued': 'Certificate issued',
  'certification.expiring': 'Certificate expiring soon',
  'assessment.completed': 'Assessment completed',
  'candidate.assessment.graded': 'Candidate assessment graded',
  'course.completed': 'Course completed',
  'payroll.payslip.superseded': 'Payslip replaced',
  'readiness_gate.changed': 'A readiness gate changed',
}

/**
 * `task.schedule_updated` -> `Task schedule updated`.
 *
 * The LAST segment is usually the verb and the ones before it the subject, so
 * they are joined with a space and the whole thing sentence-cased. Underscores
 * become spaces. Three-segment names (`attendance.regularisation.decided`) fall
 * out of the same rule without a special case.
 */
function humanize(type: string): string {
  const words = type.replace(/[._]/g, ' ').trim()

  if (!words) return type

  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A readable label for any event type, mapped or not. */
export function eventLabel(type: string): string {
  return NAMED[type] ?? humanize(type)
}

/**
 * The broad area an event belongs to, from its first segment.
 *
 * Used to group a long filter list. Unknown prefixes get their own group named
 * after themselves rather than being swept into "Other", so a new module's
 * events appear together the first time one is recorded.
 */
const AREAS: Record<string, string> = {
  leave: 'Leave',
  task: 'Tasks',
  task_execution: 'Tasks',
  attendance: 'Attendance',
  employee: 'People',
  rights: 'People',
  candidate: 'Hiring',
  capability: 'Capability',
  competency: 'Capability',
  assessment: 'Capability',
  certification: 'Learning',
  course: 'Learning',
  development_plan: 'Learning',
  payroll: 'Payroll',
  readiness_gate: 'Readiness',
}

export function eventArea(type: string): string {
  const prefix = type.split('.')[0]

  return AREAS[prefix] ?? humanize(prefix)
}
