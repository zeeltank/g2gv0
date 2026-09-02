'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, History, Paperclip, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkRoleTaskPanel, type RoleBulkRow } from './bulk-role-task-panel'
import { BulkCsvPanel } from './bulk-csv-panel'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { readLaravelSession } from '@/lib/laravel-session'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { TaskCompetencyInlinePanel } from '@/domain/competency/task-competency-inline-panel'
import { TaskDocumentsPanel } from './task-documents-panel'
import { TaskDutyContext } from './task-duty-context'
import { SectionGroup } from './section'
import { competencyLibrariesService } from '@/services/competency/libraries'
import type { JobRoleTask } from '@/services/task'
import type { DependencyType, ProjectRecord, Workstream, WorkspaceTask } from '@/types/task-management'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated?: (message: string) => void
  /**
   * EDIT MODE. Pass the id of a saved task and this becomes its edit form —
   * the same fields, in the same places, writing an update instead of a create.
   *
   * One component, two modes, deliberately. The fields, their order, their
   * labels and their validation are the thing people learned; a second form
   * would be a second answer to "what does a task consist of", and the two
   * would drift.
   */
  editTaskId?: string
  onUpdated?: (message: string) => void

  /**
   * ── SEEDING FROM A BACKLOG ITEM ────────────────────────────────────────
   *
   * A backlog item is a note with no owner; assigning it opens THIS drawer
   * rather than a second, lighter form, so there stays exactly one answer to
   * "what does a task consist of".
   *
   * These are seeded once on open, on a key, and are deliberately separate
   * from the edit-mode path below — that one loads from a PERSISTED task and
   * guards on `prefilledFor`, which a backlog item has no id for.
   */
  initialTitle?: string
  initialDescription?: string
  initialProjectId?: string | null
  initialWorkstreamId?: string
  /**
   * The id of the task that was just created, so a caller can record what its
   * note became. The legacy endpoint returns `task_id` precisely because the
   * caller otherwise has no handle on it.
   */
  onCreatedTaskId?: (taskId: string) => void
}
interface Employee { id: string; name: string; departmentId?: string }
interface JobRole { id: string; name: string; departmentId?: string; employees: Employee[] }
interface EmployeeTaskOption { value: string; label: string }
type BulkResult = Awaited<ReturnType<typeof taskService.uploadBulkTasks>>
type FormMode = 'form' | 'roleBulk' | 'csv'

/**
 * The last department and job role this browser assigned to.
 *
 * Most assigners work the same team repeatedly, so the two dropdowns that
 * start every assignment have the same answer most days.
 */
const LAST_USED_KEY = 'task-assign:last-used'
type LastUsed = { department: string; jobRoleId: string; jobRoleName: string }

/**
 * Shortcuts for the one field with no sensible default.
 *
 * Priority, repeat interval and observer all arrive pre-filled; the due date
 * cannot, because there is no date that is right for every task. These make
 * the common answers one click without inventing one.
 */
const DUE_DATE_PRESETS: Array<{ label: string; resolve: () => string }> = [
  { label: '+1 week', resolve: () => shiftDays(7) },
  { label: '+2 weeks', resolve: () => shiftDays(14) },
  {
    label: 'Month end',
    resolve: () => {
      const now = new Date()
      // Day 0 of next month is the last day of this one.
      return toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    },
  },
]

/** `YYYY-MM-DD` in LOCAL time — toISOString would shift the day west of UTC. */
function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function shiftDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDateInput(date)
}

/**
 * Where a task's title comes from.
 *
 * `catalogue` picks a standard duty from the job role's task library - the
 * repeatable, role-defined work. `custom` is for requirement-driven work that
 * no catalogue entry covers, which is most project delivery. A custom title
 * can be promoted into the library so the next person can pick it.
 */
type TitleSource = 'catalogue' | 'custom'

/*
 * THIS USED TO BE SEVEN STEPS. Here is why it is not any more.
 *
 * The sequence was real — department narrows the people, the role narrows the
 * work, and the chosen task decides what capability mapping is even possible —
 * and that was taken as the argument for a wizard. It is not. Cascading fields
 * need to be ORDERED, which a single page does perfectly well; a wizard adds
 * something else on top, which is a gate between each pair of them.
 *
 * What that gate cost, measured on the shortest real path: sixteen clicks, six
 * of them "Next", four of those crossing screens where an ordinary task needs
 * nothing at all. And because Submit only ever rendered on the last step, a
 * task that had been valid since step three still had to be walked to step
 * seven to be saved.
 *
 * So the order stayed and the gates went. The five fields a task cannot be
 * saved without are always on screen; the rest sit in three groups that open
 * in one click.
 */

type FieldKey = 'people' | 'title' | 'dueDate' | 'priority' | 'observerId'

/**
 * The order the form asks for these, which is also the order it reports them.
 *
 * INVARIANT: every key here is rendered in an ALWAYS-VISIBLE band, never
 * inside a collapsed group. A failed submit scrolls to the first offender, and
 * a required field hidden behind a chevron would be a form complaining about a
 * control that is not on screen — which is exactly what the seven-step wizard
 * did, and the reason this is one page now.
 */
const FIELD_ORDER: FieldKey[] = ['people', 'title', 'dueDate', 'priority', 'observerId']

/**
 * What is missing, keyed by the field it belongs to.
 *
 * A pure function of the values, so it can be reasoned about without the form
 * on screen. It MIRRORS THE SUBMIT GATE EXACTLY and adds nothing to it: a task
 * that saved before this form was flattened still saves now.
 *
 * Note what is NOT here. `priority` and the repeat interval are pre-defaulted,
 * so their rules can never fire — they are kept because the gate they mirror
 * keeps them. And Job Role, though it wore an asterisk for years, was never
 * validated anywhere; adding a rule for it now would reject assignments the
 * server accepts. The asterisk was the thing that was wrong, so the asterisk
 * is what went.
 */
function whatIsMissing(v: {
  assignees: string[]
  departmentId: string
  title: string
  dueDate: string
  priority: string
  observerId: string
}): Partial<Record<FieldKey, string>> {
  const missing: Partial<Record<FieldKey, string>> = {}
  if (!v.assignees.length && !v.departmentId) missing.people = 'Choose the people to assign this to, or a department.'
  if (!v.title.trim()) missing.title = 'Give the task a title.'
  if (!v.dueDate) missing.dueDate = 'Set the date this runs until.'
  if (!v.priority) missing.priority = 'Choose a priority.'
  if (!v.observerId) missing.observerId = 'Choose who observes this task.'
  return missing
}

const DEPENDENCY_TYPES: Array<{ value: DependencyType; label: string }> = [
  { value: 'FS', label: 'Finish → Start (this starts after it finishes)' },
  { value: 'SS', label: 'Start → Start (both start together)' },
  { value: 'FF', label: 'Finish → Finish (both finish together)' },
  { value: 'SF', label: 'Start → Finish (this finishes after it starts)' },
]

export function CreateTaskModal({
  isOpen, onClose, onCreated, editTaskId, onUpdated,
  initialTitle, initialDescription, initialProjectId, initialWorkstreamId, onCreatedTaskId,
}: Props) {
  const isEdit = Boolean(editTaskId)
  // What the task looked like when the form opened. Kept so save can tell an
  // actual change from an untouched field: the project move and the dependency
  // diff are both computed against this, not against defaults.
  const [original, setOriginal] = useState<WorkspaceTask | null>(null)
  const [originalDependencies, setOriginalDependencies] = useState<Array<{ id: string; predecessorId: string }>>([])
  /** The task id the form has already been filled from. See the effect below. */
  const prefilledFor = useRef('')
  const [directory, setDirectory] = useState<Record<string, JobRole[]>>({})
  const [department, setDepartment] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [roleEmployees, setRoleEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [assignees, setAssignees] = useState<string[]>([])
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  // Title source, and whether a typed title should join the role's library.
  const [titleSource, setTitleSource] = useState<TitleSource>('catalogue')
  const [saveToLibrary, setSaveToLibrary] = useState(false)
  // Project delivery: which project/workstream the task belongs to, and what
  // it waits on. Dependencies are only legal between tasks in one project,
  // which is why the predecessor list is scoped to the chosen project.
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [workstreamId, setWorkstreamId] = useState('')
  const [projectTasks, setProjectTasks] = useState<EmployeeTaskOption[]>([])
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [dependencyType, setDependencyType] = useState<DependencyType>('FS')
  const [lagDays, setLagDays] = useState('0')
  const [projectLoading, setProjectLoading] = useState(false)

  /*
   * ── SEEDED FROM A BACKLOG ITEM ────────────────────────────────────────
   *
   * Render-phase seeding on a key, the module's idiom — not a useEffect, so
   * the fields are correct on the FIRST paint rather than flickering empty.
   * `initialTitle` is the key: the caller mounts this with `key={item.id}`,
   * so a different item is a different component instance.
   *
   * Deliberately independent of the edit-mode effect below: that one loads a
   * PERSISTED task by id and guards on `prefilledFor`, which a backlog item
   * has no id for. Neither path can trigger the other.
   */
  const [seededFrom, setSeededFrom] = useState<string | null>(null)
  const seed = isOpen && !editTaskId && initialTitle !== undefined ? initialTitle : null
  if (seed !== null && seed !== seededFrom) {
    setSeededFrom(seed)
    setTitle(initialTitle ?? '')
    // The note becomes the DESCRIPTION — the title stays the one-line summary
    // somebody wrote, and the detail travels with it rather than being lost.
    setDescription(initialDescription ?? '')
    // A free-typed backlog title is not in any job role's catalogue, and 119
    // of this tenant's 266 roles have no catalogue at all — so custom is the
    // only mode that can carry it.
    setTitleSource('custom')
    if (initialProjectId) setProjectId(initialProjectId)
    if (initialWorkstreamId) setWorkstreamId(initialWorkstreamId)
  }
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false)
  const [employeeTasks, setEmployeeTasks] = useState<EmployeeTaskOption[]>([])
  const [employeeTasksLoading, setEmployeeTasksLoading] = useState(false)
  const [jobRoleTasks, setJobRoleTasks] = useState<JobRoleTask[]>([])
  const [taskTitlesLoading, setTaskTitlesLoading] = useState(false)
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [repeatDays, setRepeatDays] = useState('1'); const [dueDate, setDueDate] = useState('')
  /*
   * ── THE SAVED TASK'S SKILLS, CARRIED THROUGH AN EDIT UNTOUCHED ────────────
   *
   * This form no longer collects skills. Competency replaced them, and the
   * competency panel below says so itself: task-competency-inline-panel.tsx:52
   * calls itself «"SKILLS REQUIRED", MADE REAL», and task-competencies-panel
   * names task.skill_id as the interim hack the competency map was built to
   * replace. They were never the same vocabulary — skills came from the flat
   * s_users_skills library, competencies from competency + competency_kasba_item.
   *
   * But `updateLegacyTask` is a FULL REPLACE (services/task/index.ts:864-867):
   * every field it does not receive is written NULL. Sending '' here would
   * blank required_skills and skill_id on the ~67% of live rows that carry
   * them — the rows the LMS course-recommendation bridge reads.
   *
   * These are REFS, not state: nothing renders them, so nothing should re-render
   * for them. And they hold the RAW strings, never a split-and-rejoin. The
   * legacy writer joins with ' , ', older rows with ',', and some carry a
   * trailing separator; normalising would silently rewrite historical rows on
   * every unrelated edit. An untouched edit must write these back byte-identical.
   */
  const carriedSkillNames = useRef(''); const carriedSkillIds = useRef('')
  const [observerId, setObserverId] = useState(''); const [observerName, setObserverName] = useState('')
  // Set the moment the assigner picks an observer themselves; cleared only
  // when the selection empties or the form resets.
  const observerTouched = useRef(false)
  const [supervisorGap, setSupervisorGap] = useState('')
  const [lastUsed, setLastUsed] = useState<LastUsed | null>(null)
  const [observers, setObservers] = useState<Employee[]>([])
  const [observerLoading, setObserverLoading] = useState(false)
  const [kra, setKra] = useState(''); const [kpa, setKpa] = useState(''); const [observation, setObservation] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  /*
   * Nothing is marked red until Submit has been pressed once. A form that
   * greets you in red is telling you off for not having filled in a form you
   * have not filled in yet.
   */
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({})
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [jobRoleSuggestions, setJobRoleSuggestions] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  /*
   * WHICH BODY THE SHEET IS SHOWING.
   *
   * Two independent booleans could describe states that cannot exist — both
   * bulk panels at once — and every read had to spell out the combination.
   * One value cannot contradict itself.
   */
  const [mode, setMode] = useState<FormMode>('form')
  const [roleBulkSelected, setRoleBulkSelected] = useState<string[]>([])
  const [roleBulkRows, setRoleBulkRows] = useState<Record<string, RoleBulkRow>>({})
  const [roleBulkSaving, setRoleBulkSaving] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkSampleDownloaded, setBulkSampleDownloaded] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const attachmentRef = useRef<HTMLInputElement>(null)
  /**
   * Idempotency key for the create in flight. Minted on the first Submit and
   * kept until the create succeeds, so pressing Submit again after a timeout
   * or an error replays that create instead of producing a second task (or a
   * second copy of a whole recurring series). Cleared by reset().
   */
  const submissionKey = useRef('')
  const employeeTasksRequestRef = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
    if (cancelled) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    setLoading(true); setError('')
    Promise.all([taskService.getAssignmentDirectory(context), taskService.getAssignmentUsers(context)]).then(([response, users]) => {
      const parsed: Record<string, JobRole[]> = {}
      Object.entries(response.data ?? {}).forEach(([dept, roles]) => {
        parsed[dept] = roles.map((role) => ({
          id: String(role.id), name: role.jobrole, departmentId: String(role.department_id ?? ''),
          employees: [],
        }))
      })
      setDirectory(parsed)
      setObservers(users.map((employee) => ({
        id: String(employee.id),
        name: [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(' '),
        departmentId: String(employee.department_id ?? ''),
      })))
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load assignment options.'))
      .finally(() => setLoading(false))

    // Projects are optional, so a failure here must not block the form.
    taskService.getProjectRecords(context, { perPage: 100 })
      .then((response) => { if (!cancelled) setProjects(response.data.projects ?? []) })
      .catch(() => { /* the task can still be created without a project */ })
    })
    return () => { cancelled = true }
  }, [isOpen])

  /**
   * Load the task being edited and put it into the form.
   *
   * Ordering matters. This waits for `observers` — the people list — because
   * the department is not stored on the task: it is derived from the assignee's
   * own department, which is the only place it exists. Running before the list
   * arrives would leave the department blank and, with it, the assignee choices.
   *
   * Title mode lands on `custom`. The task row keeps a title string and no
   * reference to the catalogue entry it may have come from, so claiming a
   * catalogue selection here would be a guess. The toggle is still there for
   * anyone who wants to re-pick from the role library.
   */
  useEffect(() => {
    if (!isOpen || !editTaskId || !observers.length) return
    /*
     * ONCE PER TASK, NOT ONCE PER RENDER.
     *
     * This effect adds the task's observer to `observers` when they are not
     * already in it — which changes `observers.length`, which is one of its own
     * dependencies. Without this guard the second run would re-fetch the task
     * and overwrite whatever had been typed in between.
     */
    if (prefilledFor.current === editTaskId) return
    prefilledFor.current = editTaskId
    let cancelled = false
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    setLoading(true)
    taskService.getWorkspaceTask(context, editTaskId).then(async (response) => {
      if (cancelled) return
      const task = response.data
      setOriginal(task)
      setTitleSource('custom')
      setTitle(task.title ?? '')
      setDescription(task.description ?? '')
      setPriority((['High', 'Medium', 'Low'] as const).find((value) => value === task.priority) ?? 'Medium')
      setDueDate(task.due_date ?? '')
      setKra(task.kra ?? ''); setKpa(task.kpa ?? ''); setObservation(task.observation_point ?? '')

      // The assignee, and the department that follows from them.
      const assigneeId = task.assignee_id ? String(task.assignee_id) : ''
      if (assigneeId) setAssignees([assigneeId])
      const assigneeRecord = observers.find((person) => person.id === assigneeId)
      if (assigneeRecord?.departmentId) {
        const match = Object.entries(directory).find(([, roles]) => roles[0]?.departmentId === assigneeRecord.departmentId)
        if (match) setDepartment(match[0])
      }

      // The observer is `task_allocated`. It may be someone outside the people
      // list (a former colleague, another department), so it is added to the
      // options rather than being dropped for not already being there.
      if (task.owner_id) {
        const ownerId = String(task.owner_id)
        setObserverId(ownerId); setObserverName(task.owner ?? '')
        setObservers((current) => current.some((item) => item.id === ownerId)
          ? current
          : [...current, { id: ownerId, name: task.owner || `User ${ownerId}` }])
      }

      // The saved skills, carried through an edit untouched. See the refs.
      carriedSkillNames.current = task.required_skills ?? ''
      carriedSkillIds.current = task.skill_id ?? ''

      // Project, workstream and dependencies.
      if (task.project_id) {
        const projectId = String(task.project_id)
        await chooseProject(projectId)
        if (cancelled) return
        // chooseProject clears the workstream (it belongs to whichever project
        // was just chosen), so the saved one is restored after it, not before.
        if (task.workstream_id) setWorkstreamId(String(task.workstream_id))
        try {
          const dependencies = await taskService.getDependencies(context, { projectId })
          if (cancelled) return
          // Edges WHERE THIS TASK IS THE SUCCESSOR — the things it waits for.
          // Edges where it is the predecessor belong to the tasks waiting on
          // it, and are not this form's to change.
          const mine = (dependencies.data.dependencies ?? [])
            .filter((edge) => String(edge.successor.id) === String(editTaskId))
            .map((edge) => ({ id: String(edge.id), predecessorId: String(edge.predecessor.id), type: edge.type, lag: edge.lag_days }))
          setOriginalDependencies(mine.map(({ id, predecessorId }) => ({ id, predecessorId })))
          setDependsOn(mine.map((edge) => edge.predecessorId))
          // The form carries ONE type and lag for the whole set, so it shows
          // the first edge's. Editing them then applies that pair to every new
          // edge; existing edges keep whatever they were given.
          if (mine[0]) { setDependencyType(mine[0].type); setLagDays(String(mine[0].lag ?? 0)) }
        } catch { /* the task is still editable without its dependency list */ }
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load this task.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // `directory` and `observers` are the data this depends on; re-running when
    // they change is the point, not an oversight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editTaskId, observers.length, directory])

  // Workstreams and candidate predecessors both belong to the chosen project,
  // so they load together whenever it changes.
  //
  // Split in two ON PURPOSE. Picking a project must CLEAR the workstream —
  // it belongs to whichever project was chosen before. But a SEEDED project
  // arrives with a workstream already chosen, and clearing it is exactly
  // wrong. So the fetch half stands alone and the clearing half wraps it.
  const loadProjectOptions = useCallback(async (nextProjectId: string) => {
    setProjectLoading(true)
    try {
      const context = getLaravelContext()
      const response = await taskService.getProjectRecord(context, nextProjectId)
      setWorkstreams(response.data.workstreams ?? [])
      const ids = response.data.task_ids ?? []
      if (ids.length) {
        const tasks = await taskService.getWorkspace(context, { perPage: 100 })
        const inProject = new Set(ids.map(String))
        setProjectTasks(tasks.data.tasks
          .filter((task) => inProject.has(String(task.id)))
          .map((task) => ({ value: String(task.id), label: task.title })))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this project.')
    } finally { setProjectLoading(false) }
    // Every value it closes over is a stable setter or a module import, so it
    // never changes identity — which is what lets the effect below list it.
  }, [])

  async function chooseProject(nextProjectId: string) {
    setProjectId(nextProjectId); setWorkstreamId(''); setWorkstreams([])
    setDependsOn([]); setProjectTasks([])
    if (!nextProjectId) return
    await loadProjectOptions(nextProjectId)
  }

  /*
   * A SEEDED PROJECT HAS TO LOAD ITS OWN OPTIONS.
   *
   * Seeding happens during render (above), so it can set `projectId` and
   * `workstreamId` but cannot fetch. Without this the workstream list stayed
   * empty, and the Workstream select is disabled on `!workstreams.length` —
   * so promoting a backlog item that already named a workstream showed that
   * field greyed out and blank, with the value set underneath. The link still
   * saved; it simply could not be seen or changed.
   *
   * `loadProjectOptions`, not `chooseProject`: the latter would clear the very
   * workstream the seed just set.
   */
  useEffect(() => {
    if (!isOpen || editTaskId || !initialProjectId) return
    // Deferred, like the open-effect above: the loader sets a loading flag on
    // its first line, and doing that synchronously inside an effect cascades
    // a render.
    queueMicrotask(() => { void loadProjectOptions(initialProjectId) })
  }, [isOpen, editTaskId, initialProjectId, loadProjectOptions])

  /*
   * SUBMIT FROM THE KEYBOARD.
   *
   * Assigned during render rather than captured in the effect: `submit` closes
   * over some twenty values, so a correct dependency array would tear down and
   * re-register the listener on every keystroke. The ref is always current and
   * the listener is registered once per open — the same idiom the seeding
   * above uses, for the same reason.
   *
   * And the body stays divs rather than a <form>: a real form element would
   * make a plain Enter in the catalogue search box submit the task.
   */
  const submitRef = useRef<() => void>(() => {})
  submitRef.current = () => {
    if (mode !== 'form' || loading || saving) return
    void (isEdit ? saveEdit() : submit())
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      submitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  /*
   * Read once on mount, never during render, so server and client markup agree
   * before hydration — and deferred so the read lands after this render rather
   * than cascading out of the effect body. Same shape as cm-audit.
   */
  useEffect(() => {
    if (!isOpen || editTaskId) return
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(LAST_USED_KEY)
        if (raw) setLastUsed(JSON.parse(raw) as LastUsed)
      } catch {
        // A blocked or full localStorage must not break the form.
      }
    })
  }, [isOpen, editTaskId])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const roles = directory[department] ?? []
  // `department` is the department's NAME (it keys `directory`), while an
  // employee carries a numeric department_id. Comparing the two matched
  // nobody, so every department reported "No employees in this department".
  // The id for the selected department comes off its job roles.
  const departmentId = roles[0]?.departmentId ?? ''
  const departmentEmployees = departmentId
    ? observers.filter((emp) => emp.departmentId === departmentId)
    : []
  /*
   * ── PICKING A JOB ROLE NOW NARROWS THE PEOPLE, NOT JUST THE TASKS ───────
   *
   * The three fields read Department -> Job Role -> Assign To, and the middle
   * one did nothing to the third: choosing "Backend Engineer" still offered
   * every person in the department. `roleEmployees` was declared, set to `[]`
   * twice, and never read; `taskService.getJobRoleEmployees` was written and
   * never called. Both are wired up now.
   *
   * The department list stays as the fallback. A role with nobody mapped to it
   * yet must not empty the picker — that would make the form unusable for a
   * new role rather than merely unfiltered.
   */
  const employees = jobRole && roleEmployees.length > 0 ? roleEmployees : departmentEmployees
  /*
   * Every person we might have to name, from every list they could be in.
   * The chips read `departmentEmployees` alone, so once a job role narrowed
   * the list the selected person was no longer in it and the chip fell back
   * to rendering a raw numeric id.
   */
  const nameById = new Map<string, string>(
    [...observers, ...departmentEmployees, ...roleEmployees].map((person) => [person.id, person.name]),
  )
  /*
   * What the collapsed capability group says about itself. The mapping is
   * keyed to a catalogue task, so a custom title has nothing to map yet — and
   * saying so is more use than a chevron with no hint of what is behind it.
   */
  const competencySummary = titleSource === 'catalogue' && selectedTaskId
    ? 'Competency mapping'
    : ''

  const missing = whatIsMissing({ assignees, departmentId, title, dueDate, priority, observerId })
  /*
   * Derived, not stored — so fixing a field clears its red as you type and the
   * footer's count ticks down, without an effect watching for it.
   */
  const errors: Partial<Record<FieldKey, string>> = submitAttempted ? missing : {}
  const missingCount = Object.keys(missing).length

  /** Send the assigner to the first thing that is missing. */
  function goToFirstProblem() {
    const first = FIELD_ORDER.find((key) => missing[key])
    const node = first ? fieldRefs.current[first] : null
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    node?.focus?.()
  }


  async function chooseJobRole(roleId: string) {
  setJobRole(roleId); setRoleEmployees([]); await chooseAssignees([])
  setJobRoleTasks([]); setEmployeeTasks([]); setSelectedTaskId(''); setTitle(''); setDescription('')
  setTaskSearch(''); setTaskDropdownOpen(false);  if (!roleId) return

  /*
   * The people who hold this role. Deliberately NOT awaited alongside the
   * task catalogue below: a failure here must narrow nothing rather than
   * block the form, because the department list is a perfectly usable
   * fallback and an unfiltered picker beats a broken step.
   */
  void (async () => {
    setEmployeesLoading(true)
    try {
      const context = getLaravelContext()
      const response = await taskService.getJobRoleEmployees(context, roleId, context.orgType)
      const raw = response.searchData
      const rows = Array.isArray(raw) ? raw : Object.values(raw ?? {})
      setRoleEmployees(rows.map((row) => ({
        id: String(row.id),
        name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
        departmentId: row.department_id !== undefined ? String(row.department_id) : undefined,
      })))
    } catch {
      setRoleEmployees([])
    } finally {
      setEmployeesLoading(false)
    }
  })()
  // The task catalogue is keyed by role name, not by the id the Select carries.
  const roleName = roles.find((role) => role.id === roleId)?.name
  if (!roleName) return
  setTaskTitlesLoading(true); setError('')
  try {
    const context = getLaravelContext()
    const response = await taskService.getJobRoleTasks(context, roleName)
    const tasks = Array.isArray(response.data) ? response.data : []
    setJobRoleTasks(tasks)
    setEmployeeTasks(tasks.map((task) => ({
      value: task.id, label: task.task_title,
    })))
    // 119 of this tenant's 269 roles carry no catalogue task. Leaving those on
    // the catalogue tab is a dead end: the title stays empty and submit fails
    // its !title.trim() check with nothing on screen explaining why. Custom is
    // the only workable mode for such a role, so land there rather than making
    // the user find the toggle.
    setTitleSource(tasks.length ? 'catalogue' : 'custom')
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : 'Unable to load tasks for this job role.')
  } finally { setTaskTitlesLoading(false) }
}

  async function chooseAssignees(next: string[]) {
    const taskRequestId = ++employeeTasksRequestRef.current
    const newlySelected = next.find((id) => !assignees.includes(id))
    setAssignees(next)
    /*
     * Clear the observer only when the SELECTION EMPTIES, not on every change.
     *
     * Picking people one at a time means this runs once per person. Clearing
     * unconditionally meant the observer you chose by hand was wiped by
     * ticking the next person, and then refilled from that person's
     * supervisor — so the answer depended on who you happened to add last.
     */
    if (!next.length) { setObserverId(''); setObserverName(''); observerTouched.current = false }
    setTaskDropdownOpen(false);    /*
     * ON CREATE, picking a person restarts the task choice: the catalogue and
     * the typed title belong to the selection being built.
     *
     * ON EDIT, they belong to a saved task. Clearing them here would mean that
     * reassigning a task silently erased the title and description its author
     * wrote - so the edit keeps them, and only the person-specific parts
     * (the suggested observer) are re-fetched.
     */
    if (!isEdit) { setSelectedTaskId(''); setTitle(''); setTaskSearch('') }
    // THE CATALOGUE BELONGS TO THE ROLE, NOT THE ASSIGNEE.
    // Clearing it here is why picking a person emptied the task list and left
    // the form unsubmittable: the role's 33 tasks were fetched, then discarded
    // on the very next click. Re-derive from the role's list instead.
    setEmployeeTasks(jobRoleTasks.map((task) => ({ value: task.id, label: task.task_title })))
    setEmployeeTasksLoading(next.length > 0)
    const selectedEmployee = newlySelected ?? next[next.length - 1]
    if (!selectedEmployee) { setEmployeeTasksLoading(false); return }
    const context = getLaravelContext()
    setObserverLoading(true)
    try {
      const session = readLaravelSession()
      const [supervisorResult, jobRoleTaskResult] = await Promise.all([
        Promise.resolve(taskService.getSupervisor(context, selectedEmployee)).then((value) => ({ status: 'fulfilled' as const, value }), (reason: unknown) => ({ status: 'rejected' as const, reason })),
        Promise.resolve(taskService.getJobRoleTaskSuggestions(context, selectedEmployee, session?.org_type ?? '')).then((value) => ({ status: 'fulfilled' as const, value }), (reason: unknown) => ({ status: 'rejected' as const, reason })),
      ])
      /*
       * EVERY write below is guarded, not just the loading flag.
       *
       * Ticking five people fires five rounds of this. Only the newest one
       * describes the current selection, so an older round landing late must
       * write nothing at all — previously it still set the observer and the
       * suggestions, and the slowest response won.
       */
      if (taskRequestId !== employeeTasksRequestRef.current) return
      const supervisorResponse = supervisorResult.status === 'fulfilled' ? supervisorResult.value : null
      const jobRoleTaskResponse = jobRoleTaskResult.status === 'fulfilled' ? jobRoleTaskResult.value : { jobroleTasks: [] }
      if (supervisorResponse?.data) {
        const supervisor = { id: String(supervisorResponse.data.id), name: supervisorResponse.data.name }
        setObservers((current) => current.some((item) => item.id === supervisor.id) ? current : [...current, supervisor])
        // Suggest, never overrule. If the assigner has already named an
        // observer, that answer stands.
        if (!observerTouched.current) { setObserverId(supervisor.id); setObserverName(supervisor.name) }
        setSupervisorGap('')
      } else {
        /*
         * 3 · A FIELD HINT, NOT THE TOP BANNER.
         *
         * This fires once per person with no mapped supervisor, so with five
         * assignees it could paint the page-level error five times — and land
         * AFTER an observer had already been filled in successfully from
         * somebody else, contradicting what the form now showed.
         */
        setSupervisorGap('No supervisor is mapped to this person — choose an observer.')
      }
      const roleBased = (jobRoleTaskResponse.jobroleTasks ?? []).map((task) => task.task_title ?? task.task ?? '').filter(Boolean)
      setJobRoleSuggestions(Array.from(new Set(roleBased)))
      if (taskRequestId === employeeTasksRequestRef.current) {
        setEmployeeTasksLoading(false)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load employee details.') }
    finally {
      setObserverLoading(false)
      if (taskRequestId === employeeTasksRequestRef.current) setEmployeeTasksLoading(false)
    }
  }

  function reset() {
    setDepartment(''); setJobRole(''); setRoleEmployees([]); setAssignees([]); setTitle(''); setDescription(''); setPriority('Medium')
    setRepeatDays('1'); setDueDate(''); setObserverId(''); setObserverName(''); setSupervisorGap('')
    setKra(''); setKpa(''); setObservation(''); setAttachment(null); setJobRoleSuggestions([]); setError('')
    setSelectedTaskId(''); setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasks([]); setEmployeeTasksLoading(false);    setJobRoleTasks([]); setTaskTitlesLoading(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null); setMode('form'); setBulkFile(null); setBulkSampleDownloaded(false); setBulkResult(null)
    setRoleBulkSelected([]); setRoleBulkRows({})
    setSubmitAttempted(false)
    setTitleSource('catalogue'); setSaveToLibrary(false)
    setProjectId(''); setWorkstreams([]); setWorkstreamId(''); setProjectTasks([])
    setDependsOn([]); setDependencyType('FS'); setLagDays('0')
    submissionKey.current = ''
    setOriginal(null); setOriginalDependencies([])
    prefilledFor.current = ''
    // Or the next task edited in this session would inherit the last one's
    // skills — and, being a full replace, would write them onto its row.
    carriedSkillNames.current = ''; carriedSkillIds.current = ''
    observerTouched.current = false
    if (attachmentRef.current) attachmentRef.current.value = ''
  }
  function close() { reset(); onClose() }

  /**
   * Put the new tasks into their project, then wire their dependencies.
   *
   * The order is forced by the API: a dependency is rejected unless both
   * tasks already share a project, so linking has to finish first. The task
   * itself is already saved by this point, so a failure here is reported as a
   * partial success rather than being thrown - losing the task would be worse
   * than losing its project link.
   *
   * Returns a sentence to append to the success message, or '' if nothing
   * extra happened.
   */
  async function linkProjectAndDependencies(createdIds: string[]): Promise<string> {
    if (!projectId || !createdIds.length) return ''
    const context = getLaravelContext()
    try {
      for (const taskId of createdIds) {
        await taskService.attachTaskToProject(context, projectId, taskId, workstreamId || undefined)
      }
      if (!dependsOn.length) return `Linked to the project.`

      let created = 0
      for (const taskId of createdIds) {
        for (const predecessorId of dependsOn) {
          await taskService.createDependency(context, {
            predecessor_task_id: predecessorId, successor_task_id: taskId,
            dependency_type: dependencyType, lag_days: Number(lagDays) || 0,
            project_id: projectId,
          })
          created += 1
        }
      }
      return `Linked to the project with ${created} dependenc${created === 1 ? 'y' : 'ies'}.`
    } catch (reason) {
      setError(`The task was created, but linking it to the project failed: ${reason instanceof Error ? reason.message : 'unknown error'}`)
      return ''
    }
  }

  /**
   * Add a typed title to this job role's task catalogue so it can be reused.
   *
   * Best-effort: the task itself is already created, and failing to file it in
   * the library is not a reason to report the assignment as failed.
   */
  async function saveTitleToLibrary() {
    const roleName = roles.find((role) => role.id === jobRole)?.name
    if (!roleName) return
    try {
      await competencyLibrariesService.create(getLaravelContext(), 'jobrole-task', {
        task: title.trim(),
        jobrole: roleName,
        task_type: priority,
      })
    } catch {
      setError('The task was created, but it could not be added to the Job Role Task library.')
    }
  }

  async function submit() {
    if ((!assignees.length && !departmentId) || !title.trim() || !priority || !dueDate || !observerId) {
      /*
       * THE SAME GATE AS BEFORE — then take the person to the problem.
       *
       * The condition is unchanged, so nothing that used to save still saves.
       * What is new is where the complaint goes. Every one of these fields is
       * on screen already, so the form marks them and scrolls to the first —
       * there is no longer anywhere for a required field to hide.
       */
      /* There are no steps to send anyone to any more, so the form marks the
         offending fields and scrolls to the first of them. The banner counts;
         the fields themselves say what is wrong. */
      setSubmitAttempted(true)
      setError('')
      goToFirstProblem()
      return
    }
    if (attachment && attachment.size > 5 * 1024 * 1024) { setError('Attachment must be 5 MB or smaller.'); return }
    setSaving(true); setError('')
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID()
    try {
      const response = await taskService.createLegacyTask(getLaravelContext(), {
        title: title.trim(), description: description.trim(), assigneeIds: assignees, observerId,
        priority, repeatDays, dueDate, skillIds: [], skillNames: [], kra, kpa,
        observationPoint: observation, attachment, departmentId,
        /*
         * THE CATALOGUE ROW THIS TASK CAME FROM — the link that lets the
         * employee's task detail find the written procedure.
         *
         * `selectedTaskId` is an `s_user_jobrole_task.id`, the same key `eso` is
         * filed under. It was already in this component (line 973 hands it to
         * the competency panel) and simply never reached the server, which then
         * tried to rediscover it by matching the title text. That works only for
         * a title unique across job roles: measured on live, 6 of 612 tasks. A
         * title shared by four roles — the norm, because roles draw from one
         * catalogue — resolves to nothing, and the ESO stays invisible.
         *
         * Every path that invalidates the choice already clears it: switching to
         * a custom title (line 903) and typing in the search (line 916). So a
         * non-empty value here always means a row the user actually clicked.
         */
        jobRoleTaskId: titleSource === 'catalogue' ? selectedTaskId : '',
        idempotencyKey: submissionKey.current,
      })
      if (response.status_code !== undefined && Number(response.status_code) !== 1) throw new Error(response.message || 'Task creation failed.')
      // A replay means the first attempt already notified and fired the
      // webhook, so doing it again would double-notify the assignee.
      // Remember the team, now that we know the assignment took.
      try {
        const roleName = roles.find((role) => role.id === jobRole)?.name
        if (department && jobRole && roleName) {
          window.localStorage.setItem(LAST_USED_KEY, JSON.stringify({ department, jobRoleId: jobRole, jobRoleName: roleName }))
        }
      } catch {
        // Remembering is a convenience; failing to remember is not an error.
      }
      if (!response.replayed) {
        await notifyAssignedUsers(assignees)
        void sendAssignmentWebhook(response.task_id ?? response.taskId ?? response.id ?? response.data?.task_id ?? response.data?.taskId ?? response.data?.id)
      }

      // One submit can create several rows (a recurring task becomes one per
      // date), and every one of them belongs to the project.
      const createdIds = (response.task_ids ?? []).map(String).filter(Boolean)
      const followUp = await linkProjectAndDependencies(createdIds)

      if (titleSource === 'custom' && saveToLibrary && jobRole) {
        await saveTitleToLibrary()
      }

      /*
       * The new task's id, so a caller can record what its backlog note became.
       * A multi-assignee submission explodes into one row per person, so the
       * FIRST id is the representative one.
       */
      // `task_ids[0]` is the fallback because it is what the project linking a
      // few lines above already trusts. Reading only `task_id` meant that when
      // the server returned the list and not the scalar, a promoted backlog
      // item stayed OPEN even though its task existed.
      const createdId = (response as { task_id?: string | number | null }).task_id ?? createdIds[0]
      if (createdId) onCreatedTaskId?.(String(createdId))

      onCreated?.(followUp ? `${response.message} ${followUp}` : response.message); close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create task.') }
    finally { setSaving(false) }
  }

  /**
   * Save an edit.
   *
   * Five writes, ordered by what depends on what and by what is recoverable:
   *
   *   1. THE TASK ITSELF. If this fails nothing else is attempted — there is
   *      no sense moving a task between projects when its own fields did not
   *      save.
   *   2. PROJECT MOVE. Attach to the new project first, then detach from the
   *      old. That order means a failure between the two leaves the task in
   *      BOTH projects — visible and fixable — rather than in neither.
   *   3. DEPENDENCY DIFF. Only what actually changed: added edges created,
   *      removed edges deleted, untouched edges left alone so their notes and
   *      history survive an unrelated edit.
   *   4. ATTACHMENT. Versioned, so the previous file stays reachable.
   *
   * Everything after step 1 is reported as a partial success rather than
   * thrown. The task IS saved by then, and telling someone their edit failed
   * when it did not is worse than telling them one part of it did.
   */
  async function saveEdit() {
    if (!editTaskId || !original) return
    if (!title.trim()) { setError('A task needs a title.'); return }
    if (!assignees[0]) { setError('Choose who this task is assigned to.'); return }
    if (!observerId) { setError('Choose an observer.'); return }
    if (attachment && attachment.size > 5 * 1024 * 1024) { setError('Attachment must be 5 MB or smaller.'); return }

    setSaving(true); setError('')
    const context = getLaravelContext()
    try {
      const response = await taskService.updateLegacyTask(context, editTaskId, {
        title: title.trim(), description: description.trim(),
        assigneeId: assignees[0], observerId,
        priority, dueDate,
        kra, kpa,
        skillNames: carriedSkillNames.current,
        skillIds: carriedSkillIds.current,
        observationPoint: observation,
      })

      const notes: string[] = []

      // 2. Project move.
      const wasProject = original.project_id ? String(original.project_id) : ''
      const wasWorkstream = original.workstream_id ? String(original.workstream_id) : ''
      if (projectId !== wasProject || workstreamId !== wasWorkstream) {
        try {
          if (projectId) {
            await taskService.attachTaskToProject(context, projectId, editTaskId, workstreamId || undefined)
          }
          if (wasProject && wasProject !== projectId) {
            await taskService.detachTaskFromProject(context, wasProject, editTaskId)
          }
          notes.push(projectId ? (wasProject && wasProject !== projectId ? 'Moved to the new project.' : 'Project link updated.') : 'Removed from its project.')
        } catch (reason) {
          notes.push(`the project move failed (${reason instanceof Error ? reason.message : 'unknown error'})`)
        }
      }

      // 3. Dependency diff.
      const before = new Set(originalDependencies.map((edge) => edge.predecessorId))
      const after = new Set(dependsOn)
      const added = dependsOn.filter((id) => !before.has(id))
      const removed = originalDependencies.filter((edge) => !after.has(edge.predecessorId))
      if (added.length || removed.length) {
        try {
          for (const predecessorId of added) {
            await taskService.createDependency(context, {
              predecessor_task_id: predecessorId, successor_task_id: editTaskId,
              dependency_type: dependencyType, lag_days: Number(lagDays) || 0,
              project_id: projectId || undefined,
            })
          }
          for (const edge of removed) await taskService.deleteDependency(context, edge.id)
          notes.push(`${added.length} dependency added, ${removed.length} removed.`)
        } catch (reason) {
          notes.push(`the dependency change failed (${reason instanceof Error ? reason.message : 'unknown error'})`)
        }
      }

      // 4. Attachment.
      if (attachment) {
        try {
          await taskService.replaceTaskAttachment(context, editTaskId, attachment)
          notes.push('Attachment replaced; the previous file is kept as an earlier version.')
        } catch (reason) {
          notes.push(`the attachment upload failed (${reason instanceof Error ? reason.message : 'unknown error'})`)
        }
      }

      onUpdated?.([response.message || 'Task updated.', ...notes].join(' '))
      close()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this task.')
    } finally { setSaving(false) }
  }

  async function uploadBulk(file: File | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Bulk task upload requires a CSV file.'); return }
    setBulkLoading(true); setError('')
    try {
      const response = await taskService.uploadBulkTasks(getLaravelContext(), file)
      if (Number(response.status_code) !== 1) throw new Error(response.message)
      setBulkResult(response)
      if (!response.skipped_count) {
        onCreated?.(response.message)
        setMode('form'); setBulkFile(null)
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Bulk task upload failed.') }
    finally { setBulkLoading(false) }
  }

  async function notifyAssignedUsers(userIds: string[]) {
    const context = getLaravelContext()
    for (const userId of userIds) {
      const notification = {
        id: `${Date.now()}_${userId}`, user_id: userId, title: 'New Task Assigned',
        message: `You have been assigned a new task: ${title.trim()}`, type: 'task_assignment',
        sender_id: context.userId, read: false, created_at: new Date().toISOString(),
      }
      const key = `notifications_${userId}`
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        localStorage.setItem(key, JSON.stringify([...existing, notification]))
        localStorage.setItem('pendingTasksCount', String(Number(localStorage.getItem('pendingTasksCount') || 0) + 1))
      } catch { /* local notification storage is best-effort */ }
      try {
        await fetch(`${readLaravelSession()?.APP_URL ?? ''}/api/send-notification`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${context.token}` },
          body: JSON.stringify(notification),
        })
      } catch { /* backend notification is best-effort */ }
    }
    window.dispatchEvent(new CustomEvent('notificationUpdated'))
  }

  async function sendAssignmentWebhook(taskId?: string | number) {
    try {
      await fetch('https://n8n.triz.co.in/webhook-test/task-assigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId, task_title: title.trim(), task_description: description,
          assigned_users: assignees, assigned_by: getLaravelContext().userId,
          department, job_role: roles.find((role) => role.id === jobRole)?.name ?? '',
          observer: observerId, repeat_days: repeatDays, repeat_until: dueDate,
          skills: [], priority, kras: kra, kpis: kpa,
          observation_point: observation, created_at: new Date().toISOString(),
        }),
      })
    } catch { /* webhook must never block task creation */ }
  }

  function selectAttachment(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setAttachment(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  function openRoleBulk() {
    if (!assignees.length) { setError('Select at least one employee before bulk task assignment.'); return }
    setRoleBulkRows(Object.fromEntries(jobRoleSuggestions.map((task) => [task, {
      description: '', repeatDays: '1', dueDate: '', observerId,
      priority: 'Medium' as const,
    }])))
    setRoleBulkSelected([]); setMode('roleBulk'); setError('')
  }

  async function submitRoleBulk() {
    if (!roleBulkSelected.length) { setError('Select at least one job-role task.'); return }
    const invalid = roleBulkSelected.some((task) => !roleBulkRows[task]?.dueDate || !roleBulkRows[task]?.observerId)
    if (invalid) { setError('Repeat-until date and observer are required for every selected task.'); return }
    setRoleBulkSaving(true); setError('')
    // One key per row, sharing a batch prefix, so retrying the batch replays
    // whichever rows already landed instead of duplicating them.
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID()
    try {
      const context = getLaravelContext()
      await Promise.all(roleBulkSelected.map((task, index) => {
        const row = roleBulkRows[task]
        return taskService.createLegacyTask(context, {
          title: task, description: row.description, assigneeIds: assignees,
          observerId: row.observerId, priority: row.priority, repeatDays: row.repeatDays,
          dueDate: row.dueDate, skillIds: [], skillNames: [], kra: '', kpa: '',
          observationPoint: '', departmentId,
          idempotencyKey: `${submissionKey.current}-${index}`,
        })
      }))
      await notifyAssignedUsers(assignees)
      onCreated?.(`Successfully created ${roleBulkSelected.length} tasks.`)
      close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Bulk task assignment failed.') }
    finally { setRoleBulkSaving(false) }
  }

  async function generateDetails() {
    if (!title.trim()) { setError('Enter a task title before using AI generation.'); return }
    setGenerating(true); setError('')
    try {
      const roleName = roles.find((role) => role.id === jobRole)?.name ?? ''
      const response = await taskService.generateTaskDetails(
        `${title.trim()} for jobrole ${roleName}. Generate task_description, repeat_once_in_every, repeat_until_date, observation_point, kras, kpis and task_type. Return one JSON object in an array.`
      )
      const generated = response[0]
      if (!generated) throw new Error('No task details were generated.')
      setDescription(generated.task_description ?? description)
      setRepeatDays(({ Day: '1', Week: '7', Month: '30', Year: '365' } as Record<string, string>)[generated.repeat_once_in_every ?? ''] ?? repeatDays)
      setDueDate(generated.repeat_until_date ?? dueDate)
      setObservation(generated.observation_point ?? observation)
      setKra(generated.kras ?? kra); setKpa(generated.kpis ?? kpa)
      setPriority(generated.task_type ?? priority)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate task details.') }
    finally { setGenerating(false) }
  }

  return <Sheet open={isOpen} onOpenChange={(open) => !open && close()}><SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[1100px]">
    <SheetHeader className="shrink-0 border-b px-7 py-5"><div className="flex items-start justify-between pr-10"><div><SheetTitle className="text-xl">{mode === 'roleBulk' ? 'Bulk Task Assignment' : mode === 'csv' ? 'Import Tasks' : isEdit ? 'Edit Task' : 'New Assignment'}</SheetTitle><SheetDescription>{mode === 'roleBulk' ? 'Select and configure tasks for the chosen employee' : mode === 'csv' ? 'Create many tasks at once from a spreadsheet' : isEdit ? 'Change this task and save it' : 'Track and monitor task assignment progress'}</SheetDescription></div>{mode === 'form' && !isEdit && assignees.length > 0 && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={openRoleBulk}>Bulk Tasks</Button><Button type="button" size="sm" onClick={() => setMode('csv')}><Upload className="mr-2 size-4" />Upload Bulk Task</Button></div>}</div></SheetHeader>
    <div className="@container/form g2g-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {mode === 'roleBulk' ? (
      <BulkRoleTaskPanel
        suggestions={jobRoleSuggestions}
        rows={roleBulkRows}
        onRowsChange={setRoleBulkRows}
        selected={roleBulkSelected}
        onSelectedChange={setRoleBulkSelected}
        observers={observers}
        defaultObserverId={observerId}
        onCancel={() => setMode('form')}
      />
    ) : mode === 'csv' ? (
      <BulkCsvPanel
        file={bulkFile}
        onFile={setBulkFile}
        sampleDownloaded={bulkSampleDownloaded}
        onSampleDownloaded={() => setBulkSampleDownloaded(true)}
        result={bulkResult}
        loading={bulkLoading}
        onUpload={() => void uploadBulk(bulkFile)}
        onCancel={() => { setMode('form'); setBulkFile(null); setBulkResult(null) }}
      />
    ) : (<>
    {loading ? <div className="p-12 text-center">{isEdit ? 'Loading this task…' : 'Loading assignment options…'}</div> : <div className="flex flex-col gap-4">

      {/* WHAT YOU ARE ACTUALLY ASSIGNING. Edit mode only: on create the task
          does not exist yet, so there is nothing to resolve. */}
      {isEdit && editTaskId && <TaskDutyContext taskId={Number(editTaskId)} />}

      <SectionGroup label="Assign to" hint="Department narrows the people; the role narrows the work.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
      <Field label="Department *"><Select value={department} onChange={(value) => { setDepartment(value); setJobRole(''); setRoleEmployees([]); setJobRoleTasks([]); setEmployeeTasks([]); setSelectedTaskId(''); setTitle(''); setDescription(''); setTaskSearch(''); setTaskDropdownOpen(false); void chooseAssignees([]) }} options={Object.keys(directory).map((value) => ({ value, label: value }))} /></Field>
      <Field label="Job Role"><Select value={jobRole} onChange={(value) => void chooseJobRole(value)} options={roles.map((role) => ({ value: role.id, label: role.name }))} disabled={!department} /></Field>
      {/* ASSIGN TO SITS DIRECTLY AFTER JOB ROLE. Department narrows the people,
          the role narrows the work, and the person is settled before the task so
          the catalogue list on screen is the one actually being assigned.

          MULTIPLE ASSIGNEES: the payload already joined ids with commas into
          TASK_ALLOCATED_TO and the backend already accepted it - the only thing
          missing was a way to pick more than one. Add one at a time; remove with
          the chip. No new primitive: the same Select, plus chips. */}
      {/*
        * A CHIP, NOT A SILENT PREFILL — and the condition is the whole reason.
        *
        * It only appears while the form is empty, so there is nothing for the
        * department cascade to wipe, and clicking it runs exactly what a real
        * click runs. A silent prefill would have to fire an async role lookup
        * at open time, racing the directory load, the backlog seed and the
        * edit prefill; and when it guessed wrong you would change it and watch
        * the cascade blank the title and people you had already filled in.
        */}
      {!isEdit && !department && lastUsed && directory[lastUsed.department]?.some((role) => role.id === lastUsed.jobRoleId) && (
        <div className="@2xl/form:col-span-12">
          <button
            type="button"
            onClick={() => { setDepartment(lastUsed.department); void chooseJobRole(lastUsed.jobRoleId) }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <History className="size-3.5" />
            Last used: {lastUsed.department} · {lastUsed.jobRoleName}
          </button>
        </div>
      )}
      <Field label="Assign To *" error={errors.people} fieldRef={(node) => { fieldRefs.current.people = node }}>
        {/* Say which list this is. A picker that silently changes what it
            contains when you touch the field above it is a picker people stop
            trusting — and the fallback case has to be visible too, or "we
            could not narrow this" looks identical to "nobody holds this role". */}
        {jobRole && (
          <p className="mb-1 text-xs text-muted-foreground">
            {employeesLoading
              ? 'Finding people in this role…'
              : roleEmployees.length > 0
                ? `Showing the ${roleEmployees.length} ${roleEmployees.length === 1 ? 'person' : 'people'} in this job role.`
                : 'Nobody is mapped to this job role yet — showing the whole department.'}
          </p>
        )}
        {/* ONE ROW, ONE PERSON — in edit mode only.
            Create makes a SEPARATE task row per assignee (taskController@store
            explodes the list), so "assigned to" is not a list on a saved task:
            it is one person on this row, and the others have rows of their own.
            Adding someone here would mean creating a new task no dependency or
            project link points at; removing someone would mean DELETING their
            row along with its comments and history. Neither is an edit of this
            task, so neither hides behind Save. */}
        {isEdit && <p className="mb-1.5 text-[11px] text-muted-foreground">Each assignee has their own copy of this task. This changes who <strong>this copy</strong> belongs to — to involve more people, assign the task again.</p>}
        {/*
          * EDIT KEEPS THE DROPDOWN. One row belongs to one person, so a
          * checkbox list that permits exactly one tick would be a worse lie
          * than a dropdown. Create gets the roster, because there the list
          * genuinely is a list.
          *
          * `employees`, NOT `departmentEmployees` — the narrowed list was
          * computed and never used, so the caption said "Showing the 4 people
          * in this job role" while the control still offered the whole
          * department: the form contradicting itself.
          */}
        {isEdit ? (
          <Select
            value={assignees[0] ?? ''}
            onChange={(userId) => { if (userId) void chooseAssignees([userId]) }}
            options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
            disabled={!department || !employees.length}
            placeholder={!department ? 'Select a department first' : !employees.length ? 'No employees in this department' : 'Select an employee'}
          />
        ) : !department ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">Choose a department to see its people.</p>
        ) : !employees.length ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">No employees in this department.</p>
        ) : (
          <Multi
            items={employees}
            selected={assignees}
            onChange={(ids) => void chooseAssignees(ids)}
            listHeightClass="max-h-48"
            header={(
              /*
               * SELECT ALL IS THE LARGEST SAVING IN THIS FORM. Assigning a
               * whole twelve-person role was twelve trips through a dropdown
               * that closed after every pick — two clicks each. It is one now.
               */
              <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {assignees.length} of {employees.length} selected
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void chooseAssignees(employees.map((employee) => employee.id))}
                    disabled={assignees.length === employees.length}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => void chooseAssignees([])}
                    disabled={!assignees.length}
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
                  >
                    Clear
                  </button>
                </span>
              </div>
            )}
          />
        )}
        {!isEdit && assignees.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assignees.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                {nameById.get(id) ?? id}
                <button type="button" aria-label="Remove assignee" onClick={() => void chooseAssignees(assignees.filter((other) => other !== id))} className="text-muted-foreground transition hover:text-destructive">&times;</button>
              </span>
            ))}
          </div>
        )}
      </Field>
      {/* THE OBSERVER BELONGS BESIDE THE PEOPLE, not two groups away.
          It is one of the five fields a task cannot be saved without, so it
          has to be visible without expanding anything — and it is filled in
          automatically from the assignee's supervisor, which is worth seeing
          happen. Off-screen, that help looked like nothing happening. */}
      <Field label="Observer *" span={4} error={errors.observerId} fieldRef={(node) => { fieldRefs.current.observerId = node }}>
        <Select
          value={observerId}
          onChange={(value) => {
            // A deliberate choice. From here the supervisor lookup suggests
            // but no longer overwrites.
            observerTouched.current = true
            setObserverId(value)
            setObserverName(observers.find((item) => item.id === value)?.name ?? '')
          }}
          options={observers.map((item) => ({ value: item.id, label: item.name }))}
          /* `observers` is loaded when the drawer opens, not per assignee, so
             gating this on having an assignee only hid a list that was already
             there — and made department-only assignment, which the submit gate
             allows, impossible to complete. */
          disabled={observerLoading}
          placeholder={observerLoading ? 'Loading supervisor…' : 'Select Observer'}
        />
        {supervisorGap && <p className="mt-1.5 text-xs text-muted-foreground">{supervisorGap}</p>}
      </Field>
        </div>
      </SectionGroup>

      {/*
        * AUTOFILL IS FOR ANY TITLE, NOT ONLY A CATALOGUE ONE.
        *
        * It used to be a small icon inside the catalogue picker, disabled
        * until a catalogue task was chosen — so the branch that needs it most
        * could never reach it. `generateDetails()` only ever required a title:
        * it fills the description, the repeat interval, the due date, the
        * monitoring points, the KRA, the KPI and the priority, which is the
        * largest single saving available in this form.
        */}
      <SectionGroup
        label="The task"
        hint="A standard duty of the role, or one-off work no catalogue entry covers."
      >
        <div className="-mt-9 mb-2 flex justify-end">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => void generateDetails()}
            disabled={generating || !title.trim()}
            title={title.trim() ? 'Fill the rest in from the title' : 'Enter a title first'}
          >
            <Sparkles className={cn('mr-1.5 size-3.5 text-warning', generating && 'animate-pulse')} />
            {generating ? 'Filling in…' : 'Autofill details'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
       <Field label="Task Title *" span={12} error={errors.title} fieldRef={(node) => { fieldRefs.current.title = node }}>
       {/* Catalogue work is a standard duty of the role; custom work comes from
           a requirement no catalogue entry covers. Both end up as the same task
           - only where the title comes from differs. */}
       <div className="mb-2 flex w-fit items-center rounded-lg border bg-muted/30 p-0.5 text-xs font-medium">
         {([['catalogue', 'From job role'], ['custom', 'Custom task']] as const).map(([value, label]) =>
           <button key={value} type="button" onClick={() => { setTitleSource(value); setTitle(''); setTaskSearch(''); setSelectedTaskId(''); setDescription(''); setSaveToLibrary(false); setTaskDropdownOpen(false) }}
             className={cn('rounded-md px-3 py-1.5 transition', titleSource === value ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>)}
       </div>
       {titleSource === 'custom'
         ? <div className="space-y-2">
             <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the task to be done" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
             {/* Promotes a one-off title into the role's library so the next
                 person assigning this role can pick it from the list. */}
             {!isEdit && <label className="flex items-center gap-2 text-xs text-muted-foreground">
               <input type="checkbox" checked={saveToLibrary} disabled={!jobRole} onChange={(event) => setSaveToLibrary(event.target.checked)} />
               Also save to the Job Role Task library{!jobRole && ' (select a job role first)'}
             </label>}
           </div>
         : <div className="relative"><div className="flex items-center gap-1"><div className="relative min-w-0 flex-1"><input value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setSelectedTaskId(''); setTitle(''); setDescription(''); setTaskDropdownOpen(true) }} onFocus={() => setTaskDropdownOpen(true)} disabled={!jobRole || taskTitlesLoading || !employeeTasks.length} placeholder={taskTitlesLoading ? 'Loading tasks…' : !jobRole ? 'Select a job role first' : employeeTasks.length ? 'Type or select a task' : 'No catalogue tasks — use Custom task'} className="h-10 w-full rounded-lg border bg-background px-3 pr-9 text-sm disabled:cursor-not-allowed disabled:bg-muted" /><button type="button" aria-label="Toggle task titles" onClick={() => setTaskDropdownOpen((open) => !open)} disabled={!employeeTasks.length || taskTitlesLoading} className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground disabled:opacity-50">▾</button></div></div>
         {!taskTitlesLoading && employeeTasks.length > 0 && <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />{employeeTasks.length} task(s)</div>}
         {taskDropdownOpen && employeeTasks.length > 0 && <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-[460px] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl">{employeeTasks.filter((task) => task.label.toLowerCase().includes(taskSearch.toLowerCase())).map((task) => <button key={task.value} type="button" onClick={() => { const jobRoleTask = jobRoleTasks.find((t) => t.id === task.value); setSelectedTaskId(task.value); setTitle(task.label); setTaskSearch(task.label); setDescription(jobRoleTask?.task_description ?? ''); setTaskDropdownOpen(false) }} className={cn('block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted', selectedTaskId === task.value && 'bg-primary/10 text-primary')}>{task.label}</button>)}</div>}
         {!taskTitlesLoading && jobRole && !employeeTasks.length && <p className="mt-1.5 text-xs text-muted-foreground">This job role has no catalogue tasks yet — switch to “Custom task”.</p>}
       </div>}</Field>
       <Field label="Task Description" span={4}><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add Task Description.." className="min-h-[62px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
        </div>
      </SectionGroup>

      <SectionGroup label="Schedule" hint="How often it repeats, when it is due, and how it ranks against other work.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
      {/* RECURRENCE IS A CREATE-TIME INSTRUCTION, NOT A FIELD ON A TASK.
          "Repeat once in every N days" is how many rows to write, and the rows
          are already written. Showing it on an edit form would imply a saved
          task could be re-spread over the calendar; it cannot, and the update
          endpoint has nowhere to put it. */}
      {!isEdit && <Field label="Repeat Once in every *" span={4}><Select value={repeatDays} onChange={setRepeatDays} options={Array.from({ length: 14 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} day${index ? 's' : ''}` }))} /></Field>}
      {/* Same column, two honest names: on create it is the last date to repeat
          until; on a saved row it is simply that row's due date. No `min` in
          edit mode - an existing task's due date is often already in the past,
          and a browser that refuses to show it makes the field unusable. */}
      <Field label={isEdit ? 'Due date *' : 'Repeat until *'} span={4} error={errors.dueDate} fieldRef={(node) => { fieldRefs.current.dueDate = node }}>
        <Input type="date" value={dueDate} onChange={setDueDate} min={isEdit ? undefined : new Date().toISOString().slice(0, 10)} />
        {/* One click instead of the three or four a native date picker costs.
            A silent default would be faster still, but then the date on the
            saved task is one nobody chose. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DUE_DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDueDate(preset.resolve())}
              className="rounded-lg border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Task priority *" span={12} error={errors.priority} fieldRef={(node) => { fieldRefs.current.priority = node }}><div className="flex gap-5">{(['High','Medium','Low'] as const).map((value) => <button key={value} type="button" onClick={() => setPriority(value)} className={cn('flex h-14 w-20 flex-col items-center justify-center rounded-lg border-2 text-xs font-semibold', value === 'High' ? 'border-destructive text-destructive' : value === 'Medium' ? 'border-warning text-warning' : 'border-success text-success', priority === value && (value === 'High' ? 'bg-destructive/10' : value === 'Medium' ? 'bg-warning/10' : 'bg-success/10'))}><span className={cn('mb-1 size-3 rounded-full', value === 'High' ? 'bg-destructive' : value === 'Medium' ? 'bg-warning' : 'bg-success')} />{value}</button>)}</div></Field>
        </div>
      </SectionGroup>

      <OptionalGroup
        label="Capability & measurement"
        summary={[
          competencySummary,
          kra.trim() ? 'KRA set' : '',
          kpa.trim() ? 'KPI set' : '',
          observation.trim() ? 'monitoring points' : '',
        ].filter(Boolean).join(' · ') || 'What it builds, and what good looks like'}
        defaultOpen={isEdit && Boolean(kra.trim() || kpa.trim() || observation.trim())}
      >
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
      {/* WHAT THIS TASK BUILDS — the competency mapping, at the moment of
          judgement rather than on a matrix screen nobody opens.
          Editable because the mapping is PER-TENANT: jobrole_task_competency_map
          carries sub_institute_id even though s_jobrole_task does not, so this
          records your organisation's view and never anyone else's. */}
      <Field label="What this task builds" span={12}>
        {/* THE MAPPING KEYS ON A CATALOGUE TASK ID. jobrole_task_competency_map
            has jobrole_task_id - a row in the job role's task catalogue. A
            custom task is free text with no catalogue row, so there is nothing
            for a mapping to point at. Saying "pick a task" here would be a lie:
            in custom mode there is no task to pick. */}
        {titleSource === 'custom' ? (
          <p className="text-xs text-muted-foreground">
            Competency mapping applies to tasks from the job role catalogue. A custom task has no
            catalogue entry to map against, so this stays unavailable — switch to “From job role”
            and pick a task if you want this work to count towards capability.
          </p>
        ) : !selectedTaskId ? (
          <p className="text-xs text-muted-foreground">
            Pick a task above to see and edit which capabilities it builds.
          </p>
        ) : (
          <TaskCompetencyInlinePanel
            jobroleTaskId={Number(selectedTaskId)}
            /* EVERY assignee, not just the first. Capability is per-person -
               the required level comes from each one's own job role - so
               checking assignees[0] alone would silently clear the rest. */
            assigneeIds={assignees.map(Number).filter(Boolean)}
            assigneeNames={Object.fromEntries(
              departmentEmployees.map((employee) => [Number(employee.id), employee.name]),
            )}
          />
        )}
      </Field>
      <Field label="Key Result Areas (KRAs)" span={4}><Input value={kra} onChange={setKra} /></Field>
      <Field label="Performance Indicators (KPIs)" span={4}><Input value={kpa} onChange={setKpa} /></Field>
      <Field label="Monitoring Points" span={4}><textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Add monitoring points.." className="min-h-[46px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
        </div>
      </OptionalGroup>

      <OptionalGroup
        label="Reference material"
        summary={attachment?.name ?? original?.attachment?.name ?? 'No file attached'}
        defaultOpen={isEdit && Boolean(original?.attachment?.name)}
      >
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
      <Field label="Attachment" span={4}>{isEdit && original?.attachment?.name && !attachment && <p className="mb-1.5 text-[11px] text-muted-foreground">Currently: <span className="font-medium text-foreground">{original.attachment.name}</span> — choosing a file replaces it, keeping this one as an earlier version.</p>}<div className="flex items-center gap-2"><label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"><Paperclip className="size-4" />{attachment?.name ?? 'Select File'}<input ref={attachmentRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" onChange={(event) => selectAttachment(event.target.files?.[0] ?? null)} /></label>{attachment && <><a href={previewUrl ?? '#'} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Preview</a><button type="button" aria-label="Remove attachment" onClick={() => { selectAttachment(null); if (attachmentRef.current) attachmentRef.current.value = '' }}><X className="size-4 text-destructive" /></button></>}</div><p className="mt-1 text-[10px] text-muted-foreground">Supports: JPG, PNG, PDF, DOCX (Max 5MB)</p></Field>
          {/* DOCUMENTS ARE NOT THE ATTACHMENT.
              The attachment above is the work — a spec, a deliverable, the
              thing being handed over. These are the material needed to DO
              the work: a checklist, a policy extract, a form. They are
              stored separately and every assignee can open them. */}
          <Field label="Documents" span={8}>
            <TaskDocumentsPanel taskId={editTaskId ? Number(editTaskId) : null} />
          </Field>
        </div>
      </OptionalGroup>

      <OptionalGroup
        label="Project delivery"
        summary={projects.find((item) => String(item.id) === String(projectId))?.name ?? 'Not part of a project'}
        /* A promoted backlog item arrives with its project already chosen.
           Leaving that collapsed would hide the one thing the promotion
           carried across. */
        defaultOpen={Boolean(projectId)}
      >
      {/* Project delivery. Optional: routine role work belongs to nobody's
          project. A dependency is only legal between two tasks in the same
          project, so the predecessor list stays empty until one is chosen. */}
      <div className="col-span-full rounded-xl border bg-muted/10 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Project delivery <span className="font-normal text-muted-foreground">(optional)</span></h3>
          <p className="text-xs text-muted-foreground">Link this task to a project so it appears on the project board and can wait on other tasks.</p>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 @2xl/form:grid-cols-12">
          <Field label="Project" span={4}>
            {/* Two lines, and searchable on both. The code and the manager were
                already loaded — they were being squashed into one label, so a
                long project name pushed the code out of sight and nothing here
                could be found by typing it. */}
            <SearchableSelect value={projectId} onChange={(value) => void chooseProject(value)}
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
                hint: [project.code, project.manager ?? 'No manager'].filter(Boolean).join(' · '),
              }))}
              searchPlaceholder="Search by name, code or manager…"
              placeholder={projects.length ? 'No project' : 'No projects available'} disabled={!projects.length} />
          </Field>
          <Field label="Workstream" span={4}>
            <Select value={workstreamId} onChange={setWorkstreamId}
              options={workstreams.map((workstream) => ({ value: workstream.id, label: workstream.name }))}
              disabled={!projectId || projectLoading || !workstreams.length}
              placeholder={!projectId ? 'Select a project first' : projectLoading ? 'Loading…' : workstreams.length ? 'No workstream' : 'This project has no workstreams'} />
          </Field>
          <Field label="Dependency type" span={4}>
            <Select value={dependencyType} onChange={(value) => setDependencyType(value as DependencyType)}
              options={DEPENDENCY_TYPES} disabled={!dependsOn.length} />
          </Field>
          <Field label="Waits for" span={8}>
            <Multi items={projectTasks.map((task) => ({ id: task.value, name: task.label }))}
              selected={dependsOn} onChange={setDependsOn} disabled={!projectId || projectLoading}
              emptyText={!projectId ? 'Select a project first' : 'This project has no other tasks yet'} />
          </Field>
          <Field label="Lag (days)" span={4}>
            <Input type="number" value={lagDays} onChange={setLagDays} disabled={!dependsOn.length} />
          </Field>
        </div>
      </div>
      </OptionalGroup>
    </div>}
    </>)}
    </div>

    {/* EVERY MODE'S ACTION IN THE SAME PLACE.
        The role-bulk save used to float in the middle of the scroll body while
        the sheet's own footer was hidden, so the button you press moved
        depending on what you were doing. */}
    {mode === 'roleBulk' && (
      <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background p-4">
        <Button variant="ghost" onClick={() => setMode('form')} disabled={roleBulkSaving}>
          ← Back to the single task
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={close} disabled={roleBulkSaving}>Cancel</Button>
          <Button
            className="rounded-full px-6"
            disabled={!roleBulkSelected.length || roleBulkSaving}
            onClick={() => void submitRoleBulk()}
          >
            {roleBulkSaving ? 'Saving…' : `Save ${roleBulkSelected.length} Task${roleBulkSelected.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    )}

    {mode === 'csv' && (
      <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background p-4">
        <Button variant="ghost" onClick={() => { setMode('form'); setBulkFile(null); setBulkResult(null) }} disabled={bulkLoading}>
          ← Back to the single task
        </Button>
        <Button variant="outline" onClick={close} disabled={bulkLoading}>Close</Button>
      </div>
    )}

    {mode === 'form' && (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background p-4">
        <Button variant="outline" onClick={close}>Cancel</Button>

        <div className="flex items-center gap-3">
          {/* A COUNT, NOT A LECTURE. What each field needs is written under
              that field; repeating all five here would just be the banner
              again, further from the controls it talks about. */}
          {submitAttempted && missingCount > 0 && (
            <button
              type="button"
              onClick={goToFirstProblem}
              className="text-xs text-destructive underline-offset-2 hover:underline"
            >
              <span className="tabular-nums">{missingCount}</span> field{missingCount === 1 ? '' : 's'} still needed
            </button>
          )}

          {/*
            NEVER DISABLED BY VALIDATION — only while it is busy.
            The wizard's Next was disabled by whatever was missing and would
            not say what, which is what made it feel like a wall. A button you
            can always press, which then tells you what is wrong and takes you
            to it, is strictly kinder. It also removes the old trap where a
            task valid since step three still had to be walked to step seven
            before a Submit button existed at all.
          */}
          <Button
            className="rounded-full px-8"
            onClick={() => void (isEdit ? saveEdit() : submit())}
            disabled={loading || saving}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Assign task'}
            <span className="ml-2 text-[10px] opacity-70 tabular-nums" aria-hidden="true">Ctrl+&crarr;</span>
          </Button>
        </div>
      </div>
    )}
  
  </SheetContent></Sheet>
}

/**
 * Split one of the task row's comma-joined lists.
 *
 * The legacy writer joins with `' , '`, older rows with a bare `','`, and some
 * carry a trailing separator. All three have to read back as the same list.
 */



/*
 * Spans are keyed to @2xl/form, NOT to `md:`. The viewport is the wrong ruler
 * in this shell: the nav is 260px and the agent panel another 30rem, so at
 * 1440px with both open there are ~650px of form while `md:` still matches
 * and lays out four columns in the space of two. Same rationale, same fix as
 * project-detail-view.tsx:342-350.
 */
/**
 * AN OPTIONAL GROUP, COLLAPSED UNTIL IT IS WANTED.
 *
 * Everything a task can carry is on one page now, which is only an improvement
 * if the page does not open as a wall. The five fields every task needs are
 * always visible; these hold the ones most tasks leave alone.
 *
 * THE SUMMARY LINE IS THE POINT. A collapsed group that only says "Project
 * delivery" makes you open it to find out whether anything is in there. One
 * that says "Not part of a project" has already answered the question.
 *
 * MOUNTED ONCE, THEN HIDDEN — never unmounted. The competency and documents
 * panels fetch when they mount; under the wizard they mounted once, on
 * reaching their step. Unmounting on collapse would turn every toggle into
 * another round of requests.
 */
function OptionalGroup({ label, summary, defaultOpen = false, children }: {
  label: string
  summary: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [everOpened, setEverOpened] = useState(defaultOpen)
  return (
    <section className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); setEverOpened(true) }}
        className="flex w-full items-center justify-between gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {everOpened && (
        <div className={cn('border-t border-border p-4', !open && 'hidden')}>{children}</div>
      )}
    </section>
  )
}

function Field({ label, span = 3, error, fieldRef, children }: {
  label: string
  span?: number
  /** Shown under the control, and only after a submit has been attempted. */
  error?: string
  /** How `submit()` reaches this field to scroll to it. */
  fieldRef?: (node: HTMLElement | null) => void
  children: React.ReactNode
}) {
  return (
    <label
      ref={fieldRef}
      /* -scroll-mt keeps the sticky header from covering the field we just
         scrolled to. */
      className={cn(
        'scroll-mt-24',
        span === 12 ? '@2xl/form:col-span-12' : span === 8 ? '@2xl/form:col-span-8' : span === 4 ? '@2xl/form:col-span-4' : '@2xl/form:col-span-3',
      )}
    >
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </label>
  )
}
function Input({ value, onChange, type = 'text', min, disabled }: { value: string; onChange: (value: string) => void; type?: string; min?: string; disabled?: boolean }) { return <input type={type} min={min} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted" /> }
/**
 * A checkbox list with a filter once it is long enough to need one.
 *
 * Used for Skills Required and Waits for, both of which can run to dozens of
 * entries. It was a bare scrolling list, so picking three skills out of forty
 * meant scrolling past thirty-seven — the search is the same eight-item
 * threshold the Select uses, so the two controls behave alike.
 *
 * SELECTED ITEMS ARE NEVER FILTERED OUT. Hiding a ticked box because it does
 * not match the current search would make it look unticked, and the count
 * underneath would then disagree with what is on screen.
 */
function Multi({ items, selected, onChange, disabled = false, emptyText = 'No options available', header, listHeightClass = 'max-h-32' }: {
  items: Array<{ id: string; name: string }>
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  emptyText?: string
  /** A row above the filter — used for the count and select-all/clear. */
  header?: React.ReactNode
  /** 128px suits a handful of options and is cruel for thirty people. */
  listHeightClass?: string
}) {
  const [query, setQuery] = useState('')
  const showSearch = items.length >= 8

  const visible = query.trim()
    ? items.filter((item) =>
        item.name.toLowerCase().includes(query.trim().toLowerCase()) || selected.includes(item.id))
    : items

  return (
    <div className={cn('rounded-lg border', disabled && 'cursor-not-allowed bg-muted opacity-60')}>
      {header}
      {showSearch && (
        <div className="border-b p-1.5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
            placeholder={`Search ${items.length} options…`}
            aria-label="Filter options"
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
      )}

      <div className={cn('overflow-y-auto p-2', listHeightClass)}>
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">{emptyText}</span>
        ) : visible.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nothing matches “{query}”</span>
        ) : (
          visible.map((item) => (
            <label key={item.id} className="flex gap-2 py-1 text-sm">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  onChange(event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id))}
              />
              {item.name}
            </label>
          ))
        )}
      </div>

      {/* What is chosen, when the list is long enough that it may be scrolled
          out of view. */}
      {showSearch && selected.length > 0 && (
        <p className="border-t px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
          {selected.length} selected
        </p>
      )}
    </div>
  )
}
