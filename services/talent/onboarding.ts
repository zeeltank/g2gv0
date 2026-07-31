/**
 * Onboarding & Employee Lifecycle Center service.
 *
 * Backed by the Laravel /api/onboarding/* module (token + sub_institute_id via
 * withLaravelParams, JSON envelope {status, message, data}). That module was
 * built for this screen - none of it reuses the phantom `/onboarding-tasks` and
 * `/candidates` calls in services/talent/index.ts, which point at routes that do
 * not exist in Laravel.
 *
 *   Header
 *     GET  /onboarding/overview      - the 5 KPI cards
 *     GET  /onboarding/filters       - journey / department / owner / offer options
 *
 *   Journeys (list sheet, profile sidebar, "Start onboarding")
 *     GET|POST /onboarding/journeys
 *     POST /onboarding/journeys/from-offer/{offerId}
 *     GET|PUT|DELETE /onboarding/journeys/{id}
 *     GET  /onboarding/journeys/{id}/stages, /contacts, /timeline
 *     PUT  /onboarding/stages/{id}, POST /onboarding/stages/{id}/complete
 *
 *   Tasks (Preboarding table, row actions, Add Task, integration cards)
 *     GET|POST /onboarding/tasks, PUT|DELETE /onboarding/tasks/{id}
 *     POST /onboarding/tasks/{id}/complete, POST /onboarding/tasks/bulk
 *     GET  /onboarding/workstreams
 *
 *   Documents / Notes / Probation
 *     GET|POST /onboarding/journeys/{id}/documents, PUT|DELETE /onboarding/documents/{id}
 *     GET|POST /onboarding/journeys/{id}/notes, PUT|DELETE /onboarding/notes/{id}
 *     GET  /onboarding/probation, PUT /onboarding/probation/{journeyId}
 *     POST /onboarding/probation/{journeyId}/confirm | /extend | /terminate
 *
 * NOTE: `user_id` is the CONTEXT ACTOR on every call (withLaravelParams sends the
 * signed-in user). The subject is `employee_id` on a journey and `owner_id` on a
 * task - never `user_id`.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

export interface OnbResponse<T> {
  status: number
  message: string
  data: T
}

export interface OnbPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface OnbListResponse<T> extends OnbResponse<T> {
  pagination: OnbPagination
}

export interface OnbSummaryListResponse<T, S> extends OnbListResponse<T> {
  summary: S
}

/* ------------------------------------------------------------------ *
 * Shared vocabulary (mirrors the Laravel enums exactly)
 * ------------------------------------------------------------------ */

export type JourneyStage =
  | 'preboarding' | 'first_day' | 'orientation' | 'team_integration'
  | 'probation' | 'confirmed' | 'exited'

export type JourneyStatus = 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'sent' | 'completed' | 'blocked'
export type TaskCategory = 'documents' | 'compliance' | 'it' | 'learning' | 'payroll' | 'benefits' | 'personal'
export type WorkstreamKey = 'it' | 'learning' | 'payroll' | 'benefits' | 'compliance'
export type StageKey =
  | 'offer_accepted' | 'preboarding' | 'first_day' | 'orientation'
  | 'team_integration' | 'probation' | 'confirmation'
export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type DocumentStatus = 'pending' | 'sent' | 'received' | 'verified' | 'rejected'
export type ConfirmationStatus = 'pending' | 'confirmed' | 'extended' | 'terminated'
export type NoteVisibility = 'internal' | 'shared'
export type OnboardingTab = 'preboarding' | 'journey' | 'probation' | 'timeline'

export interface OnbOption {
  value: string
  label: string
}

export interface JourneyOption extends OnbOption {
  journey_code: string | null
  position: string | null
  stage: JourneyStage
  status: JourneyStatus
  joining_date: string | null
}

export interface EmployeeOption extends OnbOption {
  employee_no: string | null
  department_id: string | null
}

/** An offer the "Start from Accepted Offer" action can seed a journey from. */
export interface OfferOption extends OnbOption {
  position: string | null
  start_date: string | null
  candidate_name: string | null
  candidate_email: string | null
  candidate_phone: string | null
  location: string | null
  department_id: string | null
  manager_id: string | null
  application_id: string | null
}

export interface OnbFilterOptions {
  journeys: JourneyOption[]
  departments: OnbOption[]
  owners: OnbOption[]
  employees: EmployeeOption[]
  offers: OfferOption[]
  document_types: OnbOption[]
  categories: OnbOption[]
  task_statuses: OnbOption[]
  journey_statuses: OnbOption[]
  stages: OnbOption[]
  document_statuses: OnbOption[]
  confirmation_statuses: OnbOption[]
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

/** Icon keys the KPI row maps to lucide components. */
export type OnbKpiIcon = 'users' | 'user-check' | 'calendar' | 'check-circle' | 'shield'

/** The filter a KPI card's "View all" applies when drilling into the list. */
export interface OnbKpiFilter {
  stage?: JourneyStage
  status?: JourneyStatus
  joining_from?: string
  joining_to?: string
  probation_due?: string
}

export interface OnbKpi {
  id: string
  title: string
  value: string
  subtitle: string
  icon: OnbKpiIcon
  /** Present only on the "Onboarding Completion" card (the progress bar). */
  progress?: number
  filter: OnbKpiFilter
}

export interface OnbOverview {
  kpis: OnbKpi[]
  totals: {
    total_journeys: number
    open_journeys: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    completion_pct: number
    probation_due: number
    first_day_thisweek: number
  }
}

/* ------------------------------------------------------------------ *
 * Journeys
 * ------------------------------------------------------------------ */

export interface OnbJourney {
  id: number
  journey_code: string | null
  name: string
  initials: string
  email: string | null
  employee_no: string | null
  image: string | null
  employee_id: number | null
  offer_id: number | null
  application_id: number | null
  position: string | null
  department_id: number | null
  department: string | null
  location: string | null
  joining_date: string | null
  joining_date_label: string | null
  stage: JourneyStage
  stage_label: string | null
  status: JourneyStatus
  status_label: string | null
  manager_id: number | null
  manager_name: string | null
  buddy_id: number | null
  buddy_name: string | null
  probation_start: string | null
  probation_end: string | null
  probation_label: string | null
  extension_end: string | null
  confirmation_status: ConfirmationStatus
  confirmation_label: string | null
  confirmed_on: string | null
  completed_at: string | null
  task_total: number
  task_completed: number
  progress_pct: number
  created_at: string | null
  /** Detail-only fields, present on show / store / update. */
  candidate_name?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  confirmation_notes?: string | null
  notes?: string | null
}

export interface JourneyFilters {
  search?: string
  stage?: string
  status?: string
  department_id?: string
  confirmation_status?: string
  joining_from?: string
  joining_to?: string
  probation_due?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface JourneyPayload {
  employee_id?: number | null
  candidate_name?: string | null
  candidate_email?: string | null
  candidate_phone?: string | null
  offer_id?: number | null
  application_id?: number | null
  department_id?: number | null
  location?: string | null
  position?: string | null
  joining_date?: string | null
  stage?: JourneyStage
  status?: JourneyStatus
  buddy_id?: number | null
  manager_id?: number | null
  probation_start?: string | null
  probation_end?: string | null
  notes?: string | null
}

export interface OnbStage {
  id: number
  journey_id: number
  stage_key: StageKey
  title: string
  start_date: string | null
  end_date: string | null
  date_label: string | null
  status: StageStatus
  status_label: string | null
  sort_order: number
  completed_at: string | null
  notes: string | null
}

export interface OnbStageList {
  stages: OnbStage[]
  total: number
  completed: number
  progress_pct: number
}

export interface StagePayload {
  title?: string
  start_date?: string | null
  end_date?: string | null
  status?: StageStatus
  notes?: string | null
}

export interface OnbContact {
  id: string
  role: string
  name: string
  email: string | null
  mobile: string | null
  initials: string
  user_id: number
  designation: string | null
  department: string | null
}

export interface OnbTimelineEntry {
  id: string
  type: string
  title: string
  detail: string | null
  date: string
  date_label: string | null
  source: 'milestone' | 'activity'
  actor?: string | null
  changes?: Array<{ field: string; label: string; old: unknown; new: unknown }> | null
}

export interface OnbTimeline {
  milestones: OnbTimelineEntry[]
  activity: OnbTimelineEntry[]
}

/* ------------------------------------------------------------------ *
 * Tasks
 * ------------------------------------------------------------------ */

export interface OnbTask {
  id: number
  journey_id: number
  title: string
  description: string | null
  category: TaskCategory | null
  category_label: string | null
  owner_id: number | null
  owner_label: string | null
  owner_name: string | null
  owner_initials: string
  owner_image: string | null
  due_date: string | null
  due_date_label: string | null
  status: TaskStatus
  status_label: string | null
  is_overdue: boolean
  completed_at: string | null
  sort_order: number
}

export interface TaskFilters {
  journey_id?: string
  category?: string
  status?: string
  owner_id?: string
  search?: string
  overdue_only?: boolean
  due_from?: string
  due_to?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface TaskSummary {
  total: number
  completed: number
  pending: number
  sent: number
}

export interface TaskPayload {
  journey_id: number
  title: string
  description?: string | null
  category?: TaskCategory | null
  owner_id?: number | null
  owner_label?: string | null
  due_date?: string | null
  status?: TaskStatus
}

export type TaskUpdatePayload = Partial<Omit<TaskPayload, 'journey_id'>>

export type BulkTaskAction = 'complete' | 'reopen' | 'delete' | 'reassign' | 'remind'

export interface OnbWorkstream {
  id: WorkstreamKey
  category: WorkstreamKey
  title: string
  icon: WorkstreamKey
  description: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  total: number
  completed: number
  progress_pct: number
}

/* ------------------------------------------------------------------ *
 * Documents / Notes / Probation
 * ------------------------------------------------------------------ */

export interface OnbDocument {
  id: number
  journey_id: number
  title: string
  document_type_id: number | null
  document_type: string | null
  file_name: string | null
  file_path: string | null
  url: string | null
  status: DocumentStatus
  status_label: string | null
  is_mandatory: boolean
  due_date: string | null
  due_date_label: string | null
  requested_at: string | null
  submitted_at: string | null
  verified_at: string | null
  remarks: string | null
  sort_order: number
}

export interface DocumentSummary {
  total: number
  pending: number
  sent: number
  received: number
  verified: number
}

export interface DocumentPayload {
  title: string
  document_type_id?: number | null
  status?: DocumentStatus
  is_mandatory?: boolean
  due_date?: string | null
  remarks?: string | null
}

export interface OnbNote {
  id: number
  journey_id: number
  note: string
  visibility: NoteVisibility
  author_name: string | null
  author_id: number | null
  initials: string
  created_at: string | null
  created_label: string | null
}

export interface NotePayload {
  note: string
  visibility?: NoteVisibility
}

export interface OnbProbation {
  id: number
  journey_code: string | null
  name: string
  initials: string
  email: string | null
  employee_id: number | null
  employee_no: string | null
  position: string | null
  department: string | null
  department_id: number | null
  manager_name: string | null
  joining_date: string | null
  joining_date_label: string | null
  probation_start: string | null
  probation_end: string | null
  probation_label: string | null
  extension_end: string | null
  days_remaining: number | null
  is_overdue: boolean
  confirmation_status: ConfirmationStatus
  confirmation_label: string | null
  confirmed_on: string | null
  confirmed_on_label: string | null
  confirmed_by: number | null
  confirmed_by_name: string | null
  confirmation_notes: string | null
}

export interface ProbationFilters {
  confirmation_status?: string
  department_id?: string
  due_in_days?: string
  search?: string
  overdue_only?: boolean
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface ProbationSummary {
  total: number
  pending: number
  confirmed: number
  extended: number
  terminated: number
}

export interface ProbationDecisionPayload {
  effective_date?: string | null
  notes?: string | null
  /** Required by /extend only. */
  extension_end?: string
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

function params(context: LaravelContext, extra?: Record<string, string | undefined>) {
  const merged: Record<string, string> = {}

  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') merged[key] = String(value)
  })

  return withLaravelParams(context, merged)
}

/**
 * Filter objects carry numbers and booleans; the query string needs strings.
 * Typed as the union of the screen's filter shapes rather than an index
 * signature, so a typo in a filter key is still a compile error at the call site.
 */
function queryOf(
  filters: JourneyFilters | TaskFilters | ProbationFilters | { status?: string; search?: string } | undefined,
) {
  const query: Record<string, string> = {}

  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
  })

  return query
}

export const onboardingService = {
  /* Header ---------------------------------------------------------- */
  getOverview(context: LaravelContext, departmentId?: string) {
    return apiClient.get<OnbResponse<OnbOverview>>(
      '/onboarding/overview',
      params(context, { department_id: departmentId }),
    )
  },
  getFilters(context: LaravelContext) {
    return apiClient.get<OnbResponse<OnbFilterOptions>>('/onboarding/filters', params(context))
  },

  /* Journeys -------------------------------------------------------- */
  getJourneys(context: LaravelContext, filters?: JourneyFilters) {
    return apiClient.get<OnbListResponse<OnbJourney[]>>(
      '/onboarding/journeys',
      params(context, queryOf(filters)),
    )
  },
  getJourney(context: LaravelContext, id: number) {
    return apiClient.get<OnbResponse<OnbJourney>>(`/onboarding/journeys/${id}`, params(context))
  },
  createJourney(context: LaravelContext, payload: JourneyPayload) {
    return apiClient.post<OnbResponse<OnbJourney>>('/onboarding/journeys', {
      ...payload, ...params(context),
    })
  },
  createJourneyFromOffer(context: LaravelContext, offerId: number) {
    return apiClient.post<OnbResponse<OnbJourney>>(
      `/onboarding/journeys/from-offer/${offerId}`,
      params(context),
    )
  },
  updateJourney(context: LaravelContext, id: number, payload: Partial<JourneyPayload>) {
    return apiClient.put<OnbResponse<OnbJourney>>(`/onboarding/journeys/${id}`, {
      ...payload, ...params(context),
    })
  },
  deleteJourney(context: LaravelContext, id: number) {
    return apiClient.delete<OnbResponse<{ id: number }>>(`/onboarding/journeys/${id}`, params(context))
  },

  /* Journey stages -------------------------------------------------- */
  getStages(context: LaravelContext, journeyId: number) {
    return apiClient.get<OnbResponse<OnbStageList>>(
      `/onboarding/journeys/${journeyId}/stages`,
      params(context),
    )
  },
  updateStage(context: LaravelContext, id: number, payload: StagePayload) {
    return apiClient.put<OnbResponse<OnbStage>>(`/onboarding/stages/${id}`, {
      ...payload, ...params(context),
    })
  },
  completeStage(context: LaravelContext, id: number, reopen = false) {
    return apiClient.post<OnbResponse<OnbStage>>(`/onboarding/stages/${id}/complete`, {
      ...params(context), reopen: reopen ? '1' : '0',
    })
  },

  /* Contacts / timeline --------------------------------------------- */
  getContacts(context: LaravelContext, journeyId: number) {
    return apiClient.get<OnbResponse<OnbContact[]>>(
      `/onboarding/journeys/${journeyId}/contacts`,
      params(context),
    )
  },
  getTimeline(context: LaravelContext, journeyId: number) {
    return apiClient.get<OnbResponse<OnbTimeline>>(
      `/onboarding/journeys/${journeyId}/timeline`,
      params(context),
    )
  },

  /* Tasks ------------------------------------------------------------ */
  getTasks(context: LaravelContext, filters?: TaskFilters) {
    return apiClient.get<OnbSummaryListResponse<OnbTask[], TaskSummary>>(
      '/onboarding/tasks',
      params(context, queryOf(filters)),
    )
  },
  createTask(context: LaravelContext, payload: TaskPayload) {
    return apiClient.post<OnbResponse<OnbTask>>('/onboarding/tasks', {
      ...payload, ...params(context),
    })
  },
  updateTask(context: LaravelContext, id: number, payload: TaskUpdatePayload) {
    return apiClient.put<OnbResponse<OnbTask>>(`/onboarding/tasks/${id}`, {
      ...payload, ...params(context),
    })
  },
  completeTask(context: LaravelContext, id: number, reopen = false) {
    return apiClient.post<OnbResponse<OnbTask>>(`/onboarding/tasks/${id}/complete`, {
      ...params(context), reopen: reopen ? '1' : '0',
    })
  },
  deleteTask(context: LaravelContext, id: number) {
    return apiClient.delete<OnbResponse<{ id: number }>>(`/onboarding/tasks/${id}`, params(context))
  },
  bulkTasks(
    context: LaravelContext,
    action: BulkTaskAction,
    taskIds: number[],
    extra?: { owner_id?: number; owner_label?: string },
  ) {
    return apiClient.post<OnbResponse<{ affected: number }>>('/onboarding/tasks/bulk', {
      action, task_ids: taskIds, ...extra, ...params(context),
    })
  },
  getWorkstreams(context: LaravelContext, journeyId?: string) {
    return apiClient.get<OnbResponse<OnbWorkstream[]>>(
      '/onboarding/workstreams',
      params(context, { journey_id: journeyId }),
    )
  },

  /* Documents -------------------------------------------------------- */
  getDocuments(context: LaravelContext, journeyId: number, filters?: { status?: string; search?: string }) {
    return apiClient.get<OnbSummaryListResponse<OnbDocument[], DocumentSummary> | (OnbResponse<OnbDocument[]> & { summary: DocumentSummary })>(
      `/onboarding/journeys/${journeyId}/documents`,
      params(context, queryOf(filters)),
    )
  },
  createDocument(context: LaravelContext, journeyId: number, payload: DocumentPayload) {
    return apiClient.post<OnbResponse<OnbDocument>>(`/onboarding/journeys/${journeyId}/documents`, {
      ...payload, ...params(context),
    })
  },
  /** Multipart create - the Documents sheet's file picker. */
  uploadDocument(context: LaravelContext, journeyId: number, form: FormData) {
    Object.entries(params(context)).forEach(([key, value]) => form.set(key, value))
    return apiClient.postForm<OnbResponse<OnbDocument>>(
      `/onboarding/journeys/${journeyId}/documents`,
      form,
    )
  },
  updateDocument(context: LaravelContext, id: number, payload: Partial<DocumentPayload>) {
    return apiClient.put<OnbResponse<OnbDocument>>(`/onboarding/documents/${id}`, {
      ...payload, ...params(context),
    })
  },
  /** Replacing the file on an existing request (multipart, spoofed PUT). */
  uploadDocumentFile(context: LaravelContext, id: number, form: FormData) {
    Object.entries(params(context)).forEach(([key, value]) => form.set(key, value))
    return apiClient.putForm<OnbResponse<OnbDocument>>(`/onboarding/documents/${id}`, form)
  },
  deleteDocument(context: LaravelContext, id: number) {
    return apiClient.delete<OnbResponse<{ id: number }>>(`/onboarding/documents/${id}`, params(context))
  },

  /* Notes ------------------------------------------------------------ */
  getNotes(context: LaravelContext, journeyId: number) {
    return apiClient.get<OnbResponse<OnbNote[]>>(
      `/onboarding/journeys/${journeyId}/notes`,
      params(context),
    )
  },
  createNote(context: LaravelContext, journeyId: number, payload: NotePayload) {
    return apiClient.post<OnbResponse<OnbNote>>(`/onboarding/journeys/${journeyId}/notes`, {
      ...payload, ...params(context),
    })
  },
  updateNote(context: LaravelContext, id: number, payload: Partial<NotePayload>) {
    return apiClient.put<OnbResponse<OnbNote>>(`/onboarding/notes/${id}`, {
      ...payload, ...params(context),
    })
  },
  deleteNote(context: LaravelContext, id: number) {
    return apiClient.delete<OnbResponse<{ id: number }>>(`/onboarding/notes/${id}`, params(context))
  },

  /* Probation -------------------------------------------------------- */
  getProbation(context: LaravelContext, filters?: ProbationFilters) {
    return apiClient.get<OnbSummaryListResponse<OnbProbation[], ProbationSummary>>(
      '/onboarding/probation',
      params(context, queryOf(filters)),
    )
  },
  updateProbation(
    context: LaravelContext,
    journeyId: number,
    payload: { probation_start: string; probation_end: string },
  ) {
    return apiClient.put<OnbResponse<OnbProbation>>(`/onboarding/probation/${journeyId}`, {
      ...payload, ...params(context),
    })
  },
  decideProbation(
    context: LaravelContext,
    journeyId: number,
    decision: 'confirm' | 'extend' | 'terminate',
    payload: ProbationDecisionPayload = {},
  ) {
    return apiClient.post<OnbResponse<OnbProbation>>(
      `/onboarding/probation/${journeyId}/${decision}`,
      { ...payload, ...params(context) },
    )
  },
}
