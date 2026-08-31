/**
 * THE EMPLOYEE'S OWN DASHBOARD CONTRACT.
 *
 * Mirrors GET /api/dashboard/me/*. Three things in here are load-bearing and
 * should not be "tidied" into something simpler:
 *
 * 1. `number | null` MEANS NOT MEASURED, and it is a different fact from 0.
 *    A competency nobody has rated is not a competency scored zero; a review
 *    with no rating yet is not a review rated nothing. Every nullable value
 *    ships with the reason beside it.
 *
 * 2. `empty_reason` appears on individual widget payloads AS WELL AS on the
 *    envelope. The envelope answers "is this whole section expected to be
 *    empty"; the widget field answers "why is THIS box empty", and on live
 *    those are usually different sentences.
 *
 * 3. `not_started` is a real status bucket, not a rendering accident. A fifth
 *    of the showcase tenant's tasks have no status recorded at all, and the
 *    donut must name that rather than draw an unlabelled slice.
 */

export interface MeEnvelope<T> {
  status: number
  message: string
  data: T
  empty_is_expected: boolean
  empty_reason: string | null
  truncated: boolean
  /** Always 'self' from these routes. */
  scope: string
  meta?: { as_of: string; syear: string } | null
}

/* ── summary ──────────────────────────────────────────────────────────── */

export interface MeProfile {
  user_id: number
  name: string | null
  email: string | null
  jobrole_id: number | null
  jobrole: string | null
  /** null when the stored value is MariaDB's zero-date. */
  joined: string | null
  department: string | null
  jobrole_note: string | null
}

export interface MeTaskSlice {
  label: string
  value: number
  key?: string
}

export interface MeTasks {
  total: number
  completed: number
  in_progress: number
  on_hold: number
  pending: number
  /** Tasks with NO status recorded. Named, never hidden. */
  not_started: number
  other: number

  /** Late work that someone actually started. Excludes `not_started`. */
  overdue: number
  /** Past its date with no status ever set — a record-keeping gap, not lateness. */
  past_due_untracked: number
  due_next_7_days: number

  /** null when there are no tasks at all, never 0%. */
  completion_rate: number | null

  status_breakdown: MeTaskSlice[]
  priority_breakdown: MeTaskSlice[]
  untracked_note: string | null
}

export interface MeSummarySection {
  me: MeProfile
  tasks: MeTasks
  /** key -> access_link from tblmenumaster_g2g; null means not in this tenant. */
  links: Record<string, string | null>
}

/* ── growth ───────────────────────────────────────────────────────────── */

export interface MeCapabilityAxis {
  competency_id: number
  competency: string
  required: number | null
  /** null = never rated. NOT a score of zero. */
  current: number | null
  items_total: number
  items_rated: number
  mandatory: boolean
}

export interface MeCapability {
  axes: MeCapabilityAxis[]
  axes_total?: number
  axes_measured?: number
  axes_below_target?: number
  /** 'bars' below three measured axes — a two-axis radar is a line. */
  chart?: 'radar' | 'bars'
  empty_reason: string | null
  action_key: string | null
}

export interface MeExecution {
  total: number
  modes: { key: string; label: string; value: number }[]
  risks?: { label: string; value: number }[]
  reviewed?: number
  proposed?: number
  effort_current_min?: number
  effort_target_min?: number
  effort_released_min?: number
  review_note?: string | null
  empty_reason: string | null
}

export interface MeProcedures {
  items: {
    id: number
    title: string | null
    task: string | null
    status: string | null
    mode: string | null
    version: string | number | null
  }[]
  total: number
}

export interface MeLearning {
  enrolled: {
    id: number
    title: string
    code: string | null
    status: string | null
    proficiency: string | null
    start: string | null
    end: string | null
  }[]
  enrolled_total: number
  recommended: {
    course_id: number
    title: string
    code: string | null
    level: string | number | null
    competency: string | null
  }[]
  catalogue_total: number
  /**
   * Set when mappings EXIST for the caller's gaps but none resolve to a course.
   * That is a broken import, and it must not be reported as "no suggestions".
   */
  mapping_note: string | null
  empty_reason: string | null
}

export interface MeGrowthSection {
  capability: MeCapability
  execution: MeExecution
  procedures: MeProcedures
  learning: MeLearning
  assessments: {
    items: {
      id: number
      title: string
      jobrole: string | null
      status: string | null
      due: string | null
      completed: string | null
      score: number | null
    }[]
    open: number
    empty_reason: string | null
  }
  performance: {
    review: {
      id: number
      stage: string | null
      status: string | null
      overall: number | null
      label: string | null
      self: number | null
      manager: number | null
      due: string | null
      final: string | null
    } | null
    goals: number
    empty_reason: string | null
  }
  certifications: {
    items: {
      id: number
      name: string | null
      body: string | null
      status: string | null
      expires: string | null
      state: 'valid' | 'expiring' | 'expired' | 'no_expiry'
    }[]
    total: number
    expiring_90d: number
    expired: number
    empty_reason: string | null
  }
}

/* ── signals ──────────────────────────────────────────────────────────── */

export interface MeAttendanceMonth {
  month: string
  /** null = nothing recorded that month. Not zero attendance. */
  present: number | null
  leave: number
  absent: number | null
  attendance: number | null
  expected_working_days: number | null
  active_employees: number
}

export interface MeSignalsSection {
  attendance: {
    months: MeAttendanceMonth[]
    weekly_pattern: Record<string, number> | never[]
    calendar_available: boolean
    note: string | null
    /**
     * How much of the period was logged at all. When `partial`, the chart shows
     * DAYS RECORDED — a percentage there would describe the import rather than
     * the person.
     */
    recording: {
      days_logged: number
      working_days: number | null
      coverage_percent: number | null
      partial: boolean
      months_recorded: number
      note: string | null
    }
  }
  leave: {
    requests: {
      id: number
      type: string
      status: string
      from: string | null
      to: string | null
      day_type: string | null
    }[]
    pending: number
    /** null = no entitlement recorded. Not "zero days". */
    allocated_days: number | null
    /** 'employee' or 'department' — says which shape the figure came from. */
    allocated_by: 'employee' | 'department' | null
    year: number
    allocation_note: string | null
    empty_reason: string | null
  }
  activity: { id: string; type: string; text: string; context: string; actor: string | null; at: string }[]
  upcoming: {
    id: number
    title: string
    due: string | null
    priority: string | null
    status: string
    overdue: boolean
  }[]
  upcoming_note: string | null
}
