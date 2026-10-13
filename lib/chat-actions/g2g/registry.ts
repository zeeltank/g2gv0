import { recordModuleActivitySafely } from '@/lib/intelligence/ai-module'
import { createTemplate, fetchTemplateOptions } from '@/lib/intelligence/ai-templates'
import type { LeaveStatus } from '@/services/hrms'
import { leaveService } from '@/services/hrms'
import { assignmentApprovalService, assignmentService, lmsCatalogService } from '@/services/lms'
import { competencyLibrariesService } from '@/services/competency/libraries'
import { competencyLibraryService } from '@/services/competency/library'
import { organizationService } from '@/services/organization'
import { recruitmentService } from '@/services/talent'
import { taskService } from '@/services/task'
import type { BacklogType } from '@/types/task-management'

import { isChatActionApprovalEnabled } from '@/lib/ai-core/flag'
import { ActionRegistry } from '../registry'
import type { ChatActionDefinition } from '../types'
import { createDepartmentAction, type G2gActionApp } from './actions'
import { createCompetencyAction } from './actions-capability'
import {
  createJobRoleAction,
  createKasaEntryAction,
  createSkillAction,
  type CapabilityLibraryDeps,
} from './actions-capability-library'
import {
  changeDepartmentHeadAction,
  mergeDepartmentsAction,
  reorderDepartmentAction,
  type DepartmentStructureDeps,
} from './actions-department-structure'
import { applyLeaveAction, decideLeaveAction, type LeaveActionDeps } from './actions-hrit'
import { requestEnrollmentAction, reviewEnrollmentRequestAction, type LmsActionDeps } from './actions-lms'
import {
  assignCourseAction,
  deleteCourseAction,
  editCourseAction,
  type CourseRow,
  type LmsCourseActionDeps,
} from './actions-lms-courses'
import {
  addBacklogItemAction,
  reviewTaskAction,
  updateMyTaskStatusAction,
  type TaskActionDeps,
} from './actions-task'
import { createJobPostingAction } from './actions-talent'
import { createTemplateAction } from './actions-templates'
import { defaultSendReportDeps, sendReportAction } from './actions-report-send'

const record = (moduleKey: string, entry: Record<string, unknown>) => recordModuleActivitySafely(moduleKey, entry as never)

/**
 * G2G's registry, wired to G2G's own services. Add an action by adding a definition here -
 * the flow, the card and the confirmation rules are shared.
 *
 * Every action calls the same service function the page's own button calls, as the signed-in
 * user. An action is listed here only when the server enforces who may do it (see each
 * `actions-<module>.ts` header for how); never because the UI hides a button.
 */
export function createG2gActionRegistry(): ActionRegistry<G2gActionApp> {
  const needsApproval = isChatActionApprovalEnabled()
  // Behind NEXT_PUBLIC_CHAT_ACTION_APPROVALS every write waits for an administrator's approval.
  const gate = (definition: ChatActionDefinition<G2gActionApp>): ChatActionDefinition<G2gActionApp> =>
    needsApproval && definition.risk === 'write' ? { ...definition, requiresApproval: true } : definition

  const listDepartments = async (context: Parameters<typeof organizationService.getDepartmentsManagement>[0]) => {
    const response = await organizationService.getDepartmentsManagement(context)
    const all = response.departments ?? [
      ...response.main_departments,
      ...Object.values(response.sub_departments).flat(),
    ]

    return all.map((department) => ({ id: department.id, department: department.department }))
  }

  const leave: LeaveActionDeps = {
    listLeaveTypes: async (context) =>
      (await leaveService.getOptions(context)).data.leave_types.map(({ value, label }) => ({ value, label })),
    listDecisionStatuses: async (context) =>
      (await leaveService.getOptions(context)).data.statuses.map(({ value, label }) => ({ value, label })),
    listAwaitingMe: async (context) =>
      (await leaveService.getRequests(context, { awaitingMe: true, status: ['pending'], perPage: 50 })).data.map((row) => ({
        id: row.id,
        employee_name: row.employee_name,
        leave_type: row.leave_type,
        from_date: row.from_date,
        to_date: row.to_date,
        days: row.days,
        reason: row.reason,
      })),
    applyLeave: (context, payload) => leaveService.applyLeave(context, payload),
    decideRequest: (context, id, payload) =>
      leaveService.decideRequest(context, id, { status: payload.status as LeaveStatus, hrRemarks: payload.hrRemarks }),
    record,
  }

  const task: TaskActionDeps = {
    listStatuses: async (context) =>
      (await taskService.getStatusOptions(context)).data.statuses
        .filter((status) => status.active)
        .map((status) => ({ value: status.name, label: status.name })),
    listMyOpenTasks: async (context) =>
      (await taskService.getMyTasks(context, { perPage: 50 })).data.tasks
        .filter((row) => row.status !== 'COMPLETED')
        .map((row) => ({ id: row.id, title: row.title, status: row.status_label ?? row.status })),
    updateMyTaskStatus: (context, id, status, remarks) => taskService.updateMyTaskStatus(context, id, status, remarks),
    listBacklogOptions: async (context) => {
      const { options } = (await taskService.getBacklog(context)).data

      return {
        types: options.types.map((value) => ({ value, label: value })),
        priorities: options.priorities.map((value) => ({ value, label: value })),
      }
    },
    createBacklogItem: (context, payload) =>
      taskService.createBacklogItem(context, { ...payload, type: payload.type as BacklogType | undefined }),
    listTasksToReview: async (context) =>
      (await taskService.getWorkspace(context, { status: 'COMPLETED', perPage: 50 })).data.tasks
        .filter((row) => row.approve_status !== 'approved')
        .map((row) => ({ id: row.id, title: row.title, status: row.status_label ?? row.status, assignee: row.assignee })),
    decideTask: (context, id, decision, remarks) => taskService.decideWorkspaceTask(context, id, decision, remarks),
    record,
  }

  const lms: LmsActionDeps = {
    listCourses: async (context) =>
      (await lmsCatalogService.getCourses(context, { status: 1, perPage: 100 })).data.map((course) => ({
        id: course.id,
        display_name: course.display_name,
      })),
    requestEnrollment: (context, courseId) => assignmentApprovalService.requestEnrollment(context, courseId),
    listPending: async (context) =>
      (await assignmentApprovalService.getPending(context)).data.map((row) => ({
        id: row.id,
        learner_name: row.learner_name,
        course_name: row.course_name,
      })),
    reviewRequest: (context, id, decision, note) =>
      assignmentApprovalService.review(context, id, decision, undefined, note),
    record,
  }

  // The full department rows (order, parent, head, headcount) the structure actions read and verify against.
  const listDepartmentRows = async (context: Parameters<typeof organizationService.getDepartmentsManagement>[0]) => {
    const response = await organizationService.getDepartmentsManagement(context)

    return response.departments ?? [...response.main_departments, ...Object.values(response.sub_departments).flat()]
  }

  const people = async (context: Parameters<typeof organizationService.getDepartmentCandidates>[0]) =>
    ((await organizationService.getDepartmentCandidates(context)).data ?? []).map((employee) => ({
      id: Number(employee.id),
      name: String(employee.name ?? employee.employee_name ?? employee.full_name ?? employee.id),
      employee_no: employee.employee_no ?? null,
    }))

  const lmsCourses: LmsCourseActionDeps = {
    // Every page of the catalogue (the API serves at most 100 a page), not just the first.
    listCourses: async (context, filters = {}) => {
      const rows: CourseRow[] = []

      for (let page = 1; page <= 20; page += 1) {
        const response = await lmsCatalogService.getCourses(context, {
          search: filters.search,
          status: filters.activeOnly ? 1 : undefined,
          sortBy: 'title',
          sortDir: 'asc',
          page,
          perPage: 100,
        })

        rows.push(
          ...response.data.map((course) => ({
            id: course.id,
            display_name: course.display_name,
            status: course.status,
            learners: course.learners ?? 0,
          })),
        )

        if (page >= (response.meta?.last_page ?? 1)) break
      }

      return rows
    },
    getCourse: async (context, id) => {
      const course = (await lmsCatalogService.getCourse(context, id)).data

      return {
        id: course.id,
        display_name: course.display_name,
        status: course.status,
        learners: course.learners ?? 0,
        standard_id: course.standard_id,
        subject_category: course.subject_category,
        short_name: course.short_name,
      }
    },
    listDepartments: async (context) =>
      ((await lmsCatalogService.getFilterOptions(context)).data?.departments ?? []).map(({ id, department }) => ({ id, department })),
    updateCourse: (context, id, body) => lmsCatalogService.updateCourse(context, id, body),
    deleteCourse: (context, id) => lmsCatalogService.deleteCourse(context, id),
    listLearners: people,
    listAssignments: async (context) =>
      ((await assignmentService.getAssignments(context)).data ?? []).map((row) => ({
        learner_name: row.learner_name,
        course_name: row.course_name,
        assignment_type: row.assignment_type,
        due_date: row.due_date,
      })),
    createAssignments: (context, payload) => assignmentService.createAssignments(context, payload),
    record,
  }

  const capabilityLibrary: CapabilityLibraryDeps = {
    createEntry: (context, tab, payload) => competencyLibrariesService.create(context, tab, payload),
    getEntry: async (context, tab, id) =>
      (await competencyLibrariesService.get<{ record?: { title?: string | null; category?: string | null; description?: string | null } }>(context, tab, id)).data?.record ?? null,
    listDepartments,
    createJobRole: (context, departmentId, payload) => organizationService.createDepartmentJobRole(context, departmentId, payload),
    listDepartmentJobRoles: async (context, departmentId) =>
      ((await organizationService.getDepartmentJobRoles(context, departmentId)).data ?? []).map((role) => ({ id: role.id, jobrole: role.jobrole })),
    record,
  }

  const departmentStructure: DepartmentStructureDeps = {
    listDepartments: listDepartmentRows,
    getDepartment: async (context, id) => (await organizationService.getDepartment(context, id)).data ?? null,
    listEmployees: async (context) => (await organizationService.getDepartmentCandidates(context)).data ?? [],
    mergeDepartment: (context, sourceId, targetId) => organizationService.mergeDepartment(context, sourceId, targetId),
    reorderDepartment: (context, id, direction) => organizationService.reorderDepartment(context, id, direction),
    setDepartmentHead: (context, id, headUserId) => organizationService.setDepartmentHead(context, id, headUserId),
    record,
  }

  return new ActionRegistry<G2gActionApp>([
    // any module with an AI Stack: email a saved report to real people of this organisation (the API enforces who may)
    sendReportAction({ ...defaultSendReportDeps(), record }),
    // any module with an AI Stack: a draft template for that module (the API enforces who may)
    createTemplateAction({
      // This module's read-only sources, from the catalogue the Templates tab itself uses.
      listDataSources: async (moduleKey) =>
        (await fetchTemplateOptions()).data_sources
          .filter((source) => source.module === moduleKey || source.rolls_up_to === moduleKey)
          .map((source) => ({ name: source.name, label: source.label })),
      createTemplate: (payload) => createTemplate(payload),
      record,
    }),
    // organizational_management
    createDepartmentAction({
      listDepartments,
      createDepartment: organizationService.createDepartment,
      record,
    }),
    // hrit_management
    applyLeaveAction(leave),
    decideLeaveAction(leave),
    // talent_management
    createJobPostingAction({
      listDepartments,
      createJob: (payload) => recruitmentService.createJob(payload as never),
      record,
    }),
    changeDepartmentHeadAction(departmentStructure),
    reorderDepartmentAction(departmentStructure),
    mergeDepartmentsAction(departmentStructure),
    // lms
    requestEnrollmentAction(lms),
    reviewEnrollmentRequestAction(lms),
    assignCourseAction(lmsCourses),
    editCourseAction(lmsCourses),
    deleteCourseAction(lmsCourses),
    // capability_intelligence
    createCompetencyAction({
      createCompetency: (context, payload) => competencyLibraryService.create(context, payload),
      record,
    }),
    createSkillAction(capabilityLibrary),
    createKasaEntryAction(capabilityLibrary),
    createJobRoleAction(capabilityLibrary),
    // task_management
    addBacklogItemAction(task),
    updateMyTaskStatusAction(task),
    reviewTaskAction(task),
  ].map(gate))
}
