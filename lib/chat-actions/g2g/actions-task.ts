/**
 * Task Management chat actions: add a backlog item, move one of your own tasks to a new status,
 * and approve or send back a completed task.
 *
 * Each calls the endpoint the page's own control calls, through `taskService`, as the signed-in
 * user. The server enforces every one (routes/api.php `task-management` group):
 *
 *   add_backlog_item        POST  /task-management/backlog                    `task.create`; tenant from the token
 *   update_my_task_status   PATCH /task-management/my-tasks/{id}/status       `task.status`; the row must be
 *                           assigned to the token's user in the token's tenant, and the status transition is validated
 *   review_task             PATCH /task-management/workspace/{id}/approval     `task.approve` (administrator /
 *                           HR / manager tier only - TaskPermissionMiddleware::PRIVILEGED), plus the approval chain
 *                           when one is open; only COMPLETED tasks can be reviewed
 */

import type { LaravelContext } from '@/lib/laravel-context'
import type { ActionOption, ActionResult, ChatActionDefinition } from '../types'
import type { G2gActionApp } from './actions'
import { failureMessage, onPage, writeLedger, type RecordActivity } from './shared'

export const TASK_DASHBOARD_PAGE = '/module/task-management/task-management-dashboard'
export const TASK_PROJECTS_PAGE = '/module/task-management/projects-and-workstreams'
export const MY_TASKS_PAGE = '/module/task-management/my-tasks'

const MODULE_KEY = 'task_management'
const MY_TASKS_MODULE_KEY = 'task_my_tasks'

export interface TaskRow {
  id: string
  title: string
  /** Display status (the tenant's own label when it has one). */
  status: string
  /** Who it is assigned to; shown to a reviewer. */
  assignee?: string
}

export interface TaskActionDeps {
  /** The organisation's active status names, live. */
  listStatuses: (context: LaravelContext) => Promise<ActionOption[]>
  /** The caller's own tasks that are not finished. */
  listMyOpenTasks: (context: LaravelContext) => Promise<TaskRow[]>
  updateMyTaskStatus: (context: LaravelContext, id: string, status: string, remarks: string) => Promise<unknown>
  /** The backlog's own type and priority vocabulary, live from the API. */
  listBacklogOptions: (context: LaravelContext) => Promise<{ types: ActionOption[]; priorities: ActionOption[] }>
  createBacklogItem: (
    context: LaravelContext,
    payload: { title: string; notes?: string; type?: string; priority?: string },
  ) => Promise<{ data?: { id?: string } } | unknown>
  /** Completed tasks still waiting for a review. */
  listTasksToReview: (context: LaravelContext) => Promise<TaskRow[]>
  decideTask: (context: LaravelContext, id: string, decision: 'approve' | 'reject', remarks: string) => Promise<unknown>
  record: RecordActivity
}

export function addBacklogItemAction(deps: TaskActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'add_backlog_item',
    label: 'Add a backlog item',
    description: 'Write down work in the backlog before it has an owner.',
    risk: 'write',
    phrases: ['add to backlog', 'add to the backlog', 'add backlog item', 'add a backlog item', 'create backlog item', 'new backlog item'],
    appliesTo: (context) => onPage(context, TASK_DASHBOARD_PAGE, TASK_PROJECTS_PAGE),
    inputs: [
      { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 255, placeholder: 'e.g. Post the quarterly update' },
      { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 10000, placeholder: 'Optional' },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: async (context) => [{ value: '', label: 'Not set' }, ...(await deps.listBacklogOptions(context.app.laravel)).types],
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: async (context) => [{ value: '', label: 'Not set' }, ...(await deps.listBacklogOptions(context.app.laravel)).priorities],
      },
    ],
    preview: (values, _context, labels) => ({
      title: 'Add this to the backlog?',
      lines: [
        { label: 'Title', value: values.title },
        { label: 'Notes', value: values.notes || '—' },
        { label: 'Type', value: values.type ? (labels.type ?? values.type) : 'Not set' },
        { label: 'Priority', value: values.priority ? (labels.priority ?? values.priority) : 'Not set' },
      ],
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const response = (await deps.createBacklogItem(context.app.laravel, {
          title: values.title,
          notes: values.notes || undefined,
          type: values.type || undefined,
          priority: values.priority || undefined,
        })) as { data?: { id?: string } } | undefined

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_add_backlog_item',
          operation_label: 'Add backlog item (chat)',
          message: `Added "${values.title}" to the backlog from the chat.`,
          subject_entity_key: 'backlog_item',
          subject_id: response?.data?.id ? Number(response.data.id) : undefined,
          subject_label: values.title,
        })

        return { ok: true, message: `Added "${values.title}" to the backlog.` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The backlog item could not be added.') }
      }
    },
  }
}

export function updateMyTaskStatusAction(deps: TaskActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'update_my_task_status',
    label: 'Update the status of one of my tasks',
    description: 'Move a task assigned to you to another status, with a remark.',
    risk: 'write',
    phrases: ['update task status', 'update my task', 'change task status', 'change my task status', 'mark task', 'mark my task', 'set task status'],
    appliesTo: (context) => onPage(context, MY_TASKS_PAGE),
    inputs: [
      {
        key: 'task_id',
        label: 'Task',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listMyOpenTasks(context.app.laravel)).map((task) => ({
            value: task.id,
            label: `${task.title} (${task.status})`,
          })),
      },
      {
        key: 'status',
        label: 'New status',
        type: 'select',
        required: true,
        options: (context) => deps.listStatuses(context.app.laravel),
      },
      { key: 'remarks', label: 'Remark', type: 'text', required: true, maxLength: 5000, placeholder: 'What changed' },
    ],
    preview: (values, _context, labels) => ({
      title: 'Change this task\'s status?',
      lines: [
        { label: 'Task', value: labels.task_id ?? `Task ${values.task_id}` },
        { label: 'New status', value: labels.status ?? values.status },
        { label: 'Remark', value: values.remarks },
      ],
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        await deps.updateMyTaskStatus(context.app.laravel, values.task_id, values.status, values.remarks)

        await writeLedger(deps.record, MY_TASKS_MODULE_KEY, {
          operation: 'chat_update_my_task_status',
          operation_label: 'Update task status (chat)',
          message: `Moved task ${values.task_id} to "${values.status}" from the chat.`,
          subject_entity_key: 'task',
          subject_id: Number(values.task_id),
          subject_label: `Task ${values.task_id}`,
        })

        return { ok: true, message: `Task ${values.task_id} is now "${values.status}".` }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The task status could not be changed.') }
      }
    },
  }
}

export function reviewTaskAction(deps: TaskActionDeps): ChatActionDefinition<G2gActionApp> {
  return {
    key: 'review_task',
    label: 'Approve or send back a completed task',
    description: 'Review a task that has been marked complete.',
    risk: 'write',
    phrases: ['approve task', 'approve a task', 'reject task', 'reject a task', 'review task', 'review a task', 'send back task'],
    appliesTo: (context) => onPage(context, TASK_DASHBOARD_PAGE),
    inputs: [
      {
        key: 'task_id',
        label: 'Completed task',
        type: 'select',
        required: true,
        options: async (context): Promise<ActionOption[]> =>
          (await deps.listTasksToReview(context.app.laravel)).map((task) => ({
            value: task.id,
            label: task.assignee ? `${task.title} - ${task.assignee}` : task.title,
          })),
      },
      {
        key: 'decision',
        label: 'Decision',
        type: 'select',
        required: true,
        // The two verbs the approval endpoint accepts - a protocol choice, not organisation data.
        options: async () => [
          { value: 'approve', label: 'Approve' },
          { value: 'reject', label: 'Send back' },
        ],
      },
      { key: 'remarks', label: 'Remark', type: 'text', maxLength: 5000, placeholder: 'Required when sending back' },
    ],
    validate: (values) => {
      const errors: Record<string, string> = {}

      if (values.decision && values.decision !== 'approve' && values.decision !== 'reject') {
        errors.decision = 'Choose approve or send back.'
      }
      if (values.decision === 'reject' && !(values.remarks ?? '').trim()) {
        errors.remarks = 'Say why the task is being sent back.'
      }

      return errors
    },
    preview: (values, _context, labels) => ({
      title: values.decision === 'reject' ? 'Send this task back?' : 'Approve this task?',
      lines: [
        { label: 'Task', value: labels.task_id ?? `Task ${values.task_id}` },
        { label: 'Decision', value: values.decision === 'reject' ? 'Send back' : 'Approve' },
        { label: 'Remark', value: values.remarks || '—' },
      ],
      warning: 'The assignee is told the outcome.',
    }),
    execute: async (values, context): Promise<ActionResult> => {
      try {
        const decision = values.decision === 'reject' ? 'reject' : 'approve'
        await deps.decideTask(context.app.laravel, values.task_id, decision, values.remarks)

        await writeLedger(deps.record, MODULE_KEY, {
          operation: 'chat_review_task',
          operation_label: 'Review completed task (chat)',
          message: `${decision === 'approve' ? 'Approved' : 'Sent back'} task ${values.task_id} from the chat.`,
          subject_entity_key: 'task',
          subject_id: Number(values.task_id),
          subject_label: `Task ${values.task_id}`,
        })

        return { ok: true, message: decision === 'approve' ? 'Task approved.' : 'Task sent back.' }
      } catch (error) {
        return { ok: false, message: failureMessage(error, 'The task could not be reviewed.') }
      }
    },
  }
}
