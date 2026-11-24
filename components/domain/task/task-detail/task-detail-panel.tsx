'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Archive, CalendarPlus, CheckCircle2, Edit2, Info, MoreHorizontal, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { PageTabs, TabPanel, type PageTab } from '@/components/shared/scaffolds/page-tabs'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { RecurrenceScope, TaskSubtask } from '@/types/task-management'
import { CreateTaskModal } from '../create-task-modal'
import { RecurrenceScopeDialog } from '../recurrence-scope-dialog'
import { TaskDutyContext } from '../task-duty-context'
import { TaskInstructionsPanel } from '../task-instructions-panel'
import { ActivityTab } from './activity-tab'
import { formatDay } from './date-utils'
import { ExtensionTab } from './extension-tab'
import { FilesTab } from './files-tab'
import { DueChip, PropertiesList } from './properties-list'
import { StatusControl } from './status-control'
import { SubtasksTab } from './subtasks-tab'
import { useTaskDetail } from './use-task-detail'

interface Props {
  taskId: string | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
  /**
   * Present only when opened from the Task Management Dashboard
   * (task-workspace.tsx). `MyTask` (what the panel fetches) carries no
   * approval-chain state, and the Dashboard already holds the row for the task
   * clicked, so approve/reject/archive are passed in rather than re-derived.
   * Whether this viewer MAY use them is the server's `can` flags, not the mere
   * presence of this prop.
   */
  dashboardContext?: {
    approved: boolean
    onApprove: () => void
    onReject: () => void
    onArchive: () => void
  }
}

/**
 * The task detail panel - the same props as the popup it replaced, so none of
 * the screens that open it change.
 *
 * Keyed on the task: every piece of state inside starts empty for each task, so
 * nothing from the previous one can show while this one loads.
 */
export function MyTaskDetailsDrawer(props: Props) {
  if (!props.taskId) return null
  return <TaskDetailPanel key={props.taskId} {...props} taskId={props.taskId} />
}

const NOTICE_ICON = { success: CheckCircle2, info: Info, warning: AlertCircle, destructive: AlertCircle } as const

function TaskDetailPanel({ taskId, open, onClose, onUpdated, dashboardContext }: Props & { taskId: string }) {
  const detail = useTaskDetail({ taskId, open, onUpdated, onClose })
  // Read in the first render, before the dialog moves focus into itself: this is the row (or card) that was clicked.
  const [opener] = useState<HTMLElement | null>(() => (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null))

  /**
   * Back to what opened the panel. The clicked element is used while it is still on the page; a list that
   * re-rendered meanwhile has replaced it, so the control marked `data-task-open` for this task is looked up
   * instead, trying again for a moment in case the list is still loading. With neither, focus is left alone.
   */
  const restoreFocus = useCallback(() => {
    let attempts = 0
    const attempt = () => {
      const target = opener && opener.isConnected ? opener : document.querySelector<HTMLElement>(`[data-task-open="${taskId}"]`)
      if (target) { target.focus(); return }
      if (++attempts < 8) window.setTimeout(attempt, 250)
    }
    attempt()
  }, [opener, taskId])

  // The panel is removed from the page when it closes (the callers drop the selected task), so Radix's own
  // close-focus hook never gets to run. Restore focus when this unmounts - but only if no panel took its place:
  // React's development double-mount unmounts and remounts it at once, and must not move focus out of the dialog.
  useEffect(() => () => {
    window.setTimeout(() => { if (!document.querySelector('[role=dialog]')) restoreFocus() }, 0)
  }, [restoreFocus])
  const { task, workspace, notice, setNotice, busy } = detail

  /** Whether the shared assign/edit form is open over this panel. */
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('activity')
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [stopRepeatOpen, setStopRepeatOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([])
  const [subtasksLoading, setSubtasksLoading] = useState(true)

  // The checklist is read up front so the tab can show its count before it is opened.
  useEffect(() => {
    if (!open) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      const context = getLaravelContext()
      if (!isLaravelContextReady(context)) return
      taskService.getTaskSubtasks(context, taskId)
        .then((response) => { if (active) setSubtasks(response.data.subtasks) })
        .catch(() => { /* an empty checklist is a fair thing to show */ })
        .finally(() => { if (active) setSubtasksLoading(false) })
    })
    return () => { active = false }
  }, [open, taskId])

  const can = task?.can
  const canManage = Boolean(can?.manage)
  const finished = task?.status === 'COMPLETED'
  const canReview = Boolean(dashboardContext && can?.approve && finished && !dashboardContext.approved)
  const canArchive = Boolean(dashboardContext && can?.archive)
  const hasMenu = canManage || canReview || canArchive || Boolean(can?.delete)

  const tabs: PageTab[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'subtasks', label: 'Subtasks', count: subtasks.length || null },
    { id: 'files', label: 'Files' },
    { id: 'how', label: 'How to do it' },
    { id: 'extension', label: 'Extensions', count: detail.extensions.length || null },
  ]

  const description = task?.description?.trim() ?? ''
  const longDescription = description.length > 360 || description.split('\n').length > 6

  /** A series is asked which occurrences; a single task is confirmed once. */
  function askDelete() {
    if (!task) return
    if (task.recurrence_id) setScopeOpen(true)
    else setDeleteOpen(true)
  }

  function deleteWithScope(scope: RecurrenceScope) {
    setScopeOpen(false); setDeleteOpen(false)
    void detail.deleteTask(scope)
  }

  async function sendComment(event?: FormEvent) {
    event?.preventDefault()
    if (!comment.trim()) return
    if (await detail.addComment(comment)) { setComment(''); setTab('activity') }
  }

  const properties = task && (
    <PropertiesList
      task={task}
      workspace={workspace}
      canManage={canManage}
      busy={busy}
      recurrence={detail.recurrence}
      reminderMinutes={detail.reminderMinutes}
      onToggleVisibility={() => void detail.toggleVisibility()}
      onSetReminder={(minutes) => void detail.setReminder(minutes)}
      onSaveRecurrence={detail.saveRecurrence}
      onStopRepeat={() => setStopRepeatOpen(true)}
    />
  )

  const NoticeIcon = notice ? NOTICE_ICON[notice.tone] : null
  const act = (action: () => void) => () => { setMenuOpen(false); action() }

  return (
    <>
      {/* The Sheet steps aside, rather than stacking under it, while the edit form or a confirmation is showing: two Radix
          modals open at once fight over focus. Everything the panel holds (tab, drafts, loaded data) is kept in this
          component, so it comes back as it was.
          open && !editing (not just open): swap, don't stack. The Edit form is its
          own Dialog - two Radix overlays at once compound to near-opaque and leave
          this one's content inert underneath. onUpdated's refetch +
          setEditing(false) flips this back open. */}
      <Sheet open={open && !editing && !deleteOpen && !scopeOpen && !stopRepeatOpen} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          // Escape belongs to the innermost open layer. The status popover, the repeat popover and the header menu
          // are separate Radix layers, so without this one Escape closed the whole panel as well as the popover.
          // Each of them closes itself on Escape (their own onEscapeKeyDown); the panel only stands aside.
          onEscapeKeyDown={(event) => { if (document.querySelector('[data-radix-popper-content-wrapper]')) event.preventDefault() }}
          className="flex w-full flex-col gap-0 border-l p-0 sm:w-[min(960px,80vw)] sm:max-w-none"
        >
          {/* HEADER: who and where it stands. The right padding clears the built-in close button. */}
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b py-3 pl-6 pr-14">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">Task #{taskId}</span>
            {task && (
              <StatusControl
                task={task}
                options={detail.statusOptions}
                editable={Boolean(can?.update_status)}
                busy={busy === 'status'}
                onSave={detail.saveStatus}
              />
            )}
            {task && <DueChip due={task.due_date} finished={finished} />}

            {task && hasMenu && (
              <div className="ml-auto flex items-center gap-1">
                {canManage && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit2 className="mr-1.5 size-4" aria-hidden="true" />Edit / Reassign
                  </Button>
                )}
                {/* A popover, not a dropdown menu: a Radix dropdown nested inside this Sheet fights it for focus and
                    never opens (measured), and the popover is the layer this panel already uses for the status. */}
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-1" onEscapeKeyDown={() => setMenuOpen(false)}>
                    <div role="group" aria-label="Task actions" className="flex flex-col">
                      {canManage && (
                        <MenuAction icon={CalendarPlus} disabled={busy === 'followup'} onClick={act(() => void detail.createFollowUp((value) => formatDay(value)))}>Create follow-up</MenuAction>
                      )}
                      {canReview && dashboardContext && (
                        <>
                          <MenuAction icon={CheckCircle2} onClick={act(dashboardContext.onApprove)}>Approve completion</MenuAction>
                          <MenuAction icon={AlertCircle} onClick={act(dashboardContext.onReject)}>Send back for rework</MenuAction>
                        </>
                      )}
                      {canArchive && dashboardContext && <MenuAction icon={Archive} onClick={act(dashboardContext.onArchive)}>Archive</MenuAction>}
                      {can?.delete && (
                        <>
                          <div role="separator" className="my-1 h-px bg-border" />
                          <MenuAction icon={Trash2} danger onClick={act(askDelete)}>Delete task</MenuAction>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </header>

          {/* BODY: content on the left, properties on the right. The split follows the
              PANEL's width, not the window's, so it collapses to one column when the
              panel is narrow however wide the screen is. */}
          <div className="@container/panel min-h-0 flex-1">
            <div className="grid h-full @2xl/panel:grid-cols-[minmax(0,1fr)_288px]">
              <div className="min-w-0 space-y-4 overflow-y-auto p-6">
                <SheetTitle className="break-words text-xl font-semibold leading-snug tracking-normal">
                  {task?.title ?? 'Task details'}
                </SheetTitle>

                {notice && NoticeIcon && (
                  <Alert variant={notice.tone} className="py-2.5 pr-10">
                    <NoticeIcon className="size-4" />
                    <AlertDescription>{notice.text}</AlertDescription>
                    <button
                      type="button"
                      onClick={() => setNotice(null)}
                      aria-label="Dismiss message"
                      className="absolute right-2 top-2 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-4" />
                    </button>
                  </Alert>
                )}

                {detail.loading && !task && <div className="flex h-48 items-center justify-center"><Spinner /></div>}

                {task && (
                  <>
                    {task.approve_status === 'rejected' && (
                      <Alert variant="warning" className="py-2.5">
                        <AlertCircle className="size-4" />
                        <AlertDescription>
                          <strong>Sent back for rework.</strong> {task.approve_remarks || 'No reason was recorded.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {canReview && dashboardContext && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
                        <span className="mr-auto">Marked complete - waiting for review.</span>
                        <Button size="sm" onClick={dashboardContext.onApprove}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={dashboardContext.onReject}>Send back</Button>
                      </div>
                    )}

                    <section aria-label="Description">
                      <p className={`max-w-[68ch] whitespace-pre-wrap text-sm leading-6 text-foreground/90 ${descriptionOpen ? '' : 'line-clamp-6'}`}>
                        {description || <span className="text-muted-foreground">No description provided.</span>}
                      </p>
                      {longDescription && (
                        <Button variant="link" size="xs" className="mt-1 h-auto px-0" onClick={() => setDescriptionOpen((value) => !value)}>
                          {descriptionOpen ? 'Show less' : 'Show more'}
                        </Button>
                      )}
                    </section>

                    {task.observation_point && (
                      <section aria-label="Observation point" className="rounded-xl bg-muted/30 p-3 text-sm">
                        <p className="mb-0.5 text-xs font-semibold text-muted-foreground">Observation point</p>
                        {task.observation_point}
                      </section>
                    )}

                    {Array.isArray(task.acceptance_criteria) && task.acceptance_criteria.some((item) => typeof item === 'string') && (
                      <section aria-label="Acceptance criteria">
                        <h3 className="mb-1 text-xs font-semibold text-muted-foreground">Acceptance criteria</h3>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm">
                          {task.acceptance_criteria.filter((item): item is string => typeof item === 'string').map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                      </section>
                    )}

                    {/* One column only: the properties sit here, folded, instead of in the side column. */}
                    <details className="rounded-xl border @2xl/panel:hidden">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Details</summary>
                      <div className="border-t px-3 pb-2">{properties}</div>
                    </details>

                    <div>
                      <PageTabs tabs={tabs} active={tab} onChange={setTab} label="Task sections" idPrefix="task-detail" />
                      <TabPanel id="activity" active={tab} idPrefix="task-detail">
                        <ActivityTab taskId={taskId} version={detail.activityVersion} />
                      </TabPanel>
                      <TabPanel id="subtasks" active={tab} idPrefix="task-detail">
                        <SubtasksTab
                          taskId={taskId}
                          subtasks={subtasks}
                          loading={subtasksLoading}
                          canManage={canManage}
                          onChange={setSubtasks}
                          onTouched={detail.touchActivity}
                        />
                      </TabPanel>
                      <TabPanel id="files" active={tab} idPrefix="task-detail">
                        <FilesTab task={task} />
                      </TabPanel>
                      <TabPanel id="how" active={tab} idPrefix="task-detail">
                        <div className="space-y-4 pt-3">
                          {/* WHETHER THIS TASK REACHES A PROCEDURE, AND WHETHER IT DOES NOT.
                              Dashboard-only: an employee opening their own task already
                              knows whether it came from one. */}
                          {dashboardContext && <TaskDutyContext taskId={Number(taskId)} />}
                          <TaskInstructionsPanel taskId={Number(taskId)} />
                        </div>
                      </TabPanel>
                      <TabPanel id="extension" active={tab} idPrefix="task-detail">
                        <ExtensionTab
                          task={task}
                          extensions={detail.extensions}
                          busy={busy === 'extension'}
                          onRequest={detail.requestExtension}
                          onDecide={detail.decideExtension}
                          onWithdraw={detail.withdrawExtension}
                        />
                      </TabPanel>
                    </div>
                  </>
                )}
              </div>

              <aside aria-label="Task details" className="hidden min-w-0 overflow-y-auto border-l bg-muted/20 p-4 @2xl/panel:block">
                {properties}
              </aside>
            </div>
          </div>

          {/* FOOTER: the comment box stays on screen however far the body is scrolled. */}
          {task && (
            <form onSubmit={(event) => void sendComment(event)} className="flex shrink-0 items-end gap-2 border-t bg-background p-3">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void sendComment() }
                }}
                rows={1}
                aria-label="Add a comment"
                placeholder="Add a comment…  (Ctrl+Enter to send)"
                className="max-h-32 min-h-9 flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" disabled={!comment.trim() || busy === 'comment'}>{busy === 'comment' ? 'Sending…' : 'Send'}</Button>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* The assign form, in edit mode, over the panel. Keyed on the task so it
          remounts per task rather than showing the last one while this loads. */}
      {editing && task && (
        <CreateTaskModal
          key={task.id}
          isOpen
          editTaskId={task.id}
          onClose={() => setEditing(false)}
          onUpdated={(value) => {
            setEditing(false)
            setNotice({ tone: 'success', text: value })
            onUpdated()
            void detail.refreshTask()
            detail.touchActivity()
          }}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this task?"
        description={`"${task?.title ?? 'This task'}" will be removed from everyone's lists. This cannot be undone.`}
        confirmLabel="Delete task"
        busy={busy === 'delete'}
        onConfirm={() => deleteWithScope('all')}
      />
      <ConfirmDialog
        open={stopRepeatOpen}
        onOpenChange={setStopRepeatOpen}
        title="Stop this task repeating?"
        description="Past and already-created occurrences are unaffected."
        confirmLabel="Stop repeating"
        busy={busy === 'recurrence'}
        onConfirm={() => { setStopRepeatOpen(false); void detail.removeRecurrence() }}
      />
      <RecurrenceScopeDialog
        open={scopeOpen}
        action="delete"
        onChoose={(scope) => deleteWithScope(scope)}
        onCancel={() => setScopeOpen(false)}
      />
    </>
  )
}

function MenuAction({ icon: Icon, children, onClick, disabled, danger }: {
  icon: typeof Trash2
  children: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50',
        danger && 'text-red-700 dark:text-red-300',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />{children}
    </button>
  )
}
