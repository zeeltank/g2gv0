'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Paperclip, Sparkles, Upload, X, Users, ClipboardList, CalendarClock, Target, Check, ChevronLeft, ChevronRight, GitBranch} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
interface Skill { id: string; name: string }
interface EmployeeTaskOption { value: string; label: string }
type BulkResult = Awaited<ReturnType<typeof taskService.uploadBulkTasks>>

/**
 * Where a task's title comes from.
 *
 * `catalogue` picks a standard duty from the job role's task library - the
 * repeatable, role-defined work. `custom` is for requirement-driven work that
 * no catalogue entry covers, which is most project delivery. A custom title
 * can be promoted into the library so the next person can pick it.
 */
type TitleSource = 'catalogue' | 'custom'

/**
 * The seven steps, in the order the decision is actually made.
 *
 * They are a real sequence, not a filing system: department narrows the people,
 * the role narrows the work, and choosing a task changes what capability
 * mapping is even possible. That is why this is a wizard rather than a long
 * scroll — each answer changes the next question.
 */
const STEPS: Array<{ id: number; name: string; description: string; icon: typeof Users }> = [
  { id: 1, name: 'Who it is for', description: 'Department, role, people', icon: Users },
  { id: 2, name: 'The task', description: 'Title and description', icon: ClipboardList },
  { id: 3, name: 'When', description: 'Repeat, due date, priority', icon: CalendarClock },
  { id: 4, name: 'What it builds', description: 'Skills and capability', icon: Sparkles },
  { id: 5, name: 'Measurement', description: 'Observer, KRA, KPI', icon: Target },
  { id: 6, name: 'Material', description: 'Attachment and documents', icon: Paperclip },
  { id: 7, name: 'Project', description: 'Optional delivery links', icon: GitBranch },
]

/**
 * What is missing on a given step, if anything.
 *
 * A pure function of the values, so it can be reasoned about without the form
 * on screen — and so `submit()` can find the FIRST step with a problem and send
 * you there rather than showing an error about a field five steps back.
 *
 * These mirror the submit gate exactly and add nothing to it: a task that
 * passed validation before this wizard existed still passes now.
 */
function whatIsMissing(step: number, v: {
  assignees: string[]
  departmentId: string
  title: string
  dueDate: string
  priority: string
  observerId: string
}): string | null {
  switch (step) {
    case 1:
      return (!v.assignees.length && !v.departmentId)
        ? 'Choose the people to assign this to, or a department.'
        : null
    case 2:
      return !v.title.trim() ? 'Give the task a title.' : null
    case 3:
      if (!v.dueDate) return 'Set the date this runs until.'
      return !v.priority ? 'Choose a priority.' : null
    case 5:
      return !v.observerId ? 'Choose who observes this task.' : null
    default:
      // Steps 4, 6 and 7 are entirely optional — capability mapping, reference
      // material and project links are all things a valid task can do without.
      return null
  }
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
  const [employeeTasksError, setEmployeeTasksError] = useState('')
  const [jobRoleTasks, setJobRoleTasks] = useState<JobRoleTask[]>([])
  const [taskTitlesLoading, setTaskTitlesLoading] = useState(false)
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium')
  const [repeatDays, setRepeatDays] = useState('1'); const [dueDate, setDueDate] = useState('')
  const [skills, setSkills] = useState<Skill[]>([]); const [skillIds, setSkillIds] = useState<string[]>([])
  const [observerId, setObserverId] = useState(''); const [observerName, setObserverName] = useState('')
  const [observers, setObservers] = useState<Employee[]>([])
  const [observerLoading, setObserverLoading] = useState(false)
  const [kra, setKra] = useState(''); const [kpa, setKpa] = useState(''); const [observation, setObservation] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const [jobRoleSuggestions, setJobRoleSuggestions] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showRoleBulk, setShowRoleBulk] = useState(false)
  const [roleBulkSelected, setRoleBulkSelected] = useState<string[]>([])
  const [roleBulkRows, setRoleBulkRows] = useState<Record<string, { description: string; repeatDays: string; dueDate: string; observerId: string; priority: 'High' | 'Medium' | 'Low' }>>({})
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

      // Skills: the row stores names and ids as two parallel comma-joined
      // strings. Rebuild the option list from them so the current selection is
      // visible even before the assignee's full skill list arrives.
      const skillIdList = splitList(task.skill_id)
      const skillNameList = splitList(task.required_skills)
      if (skillIdList.length) {
        setSkills(skillIdList.map((id, index) => ({ id, name: skillNameList[index] ?? id })))
        setSkillIds(skillIdList)
      }

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
  async function chooseProject(nextProjectId: string) {
    setProjectId(nextProjectId); setWorkstreamId(''); setWorkstreams([])
    setDependsOn([]); setProjectTasks([])
    if (!nextProjectId) return
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
  }

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
   * A step is reachable once every step before it is satisfied.
   *
   * EDIT MODE MAKES ALL SEVEN REACHABLE. You open an existing task to change
   * one field, and walking a sequence to reach it would be worse than the flat
   * form this replaced. There the stepper is navigation, not a gate.
   */
  const reachableStep = useMemo(() => {
    if (isEdit) return STEPS.length
    const values = { assignees, departmentId, title, dueDate, priority, observerId }
    for (const entry of STEPS) {
      if (whatIsMissing(entry.id, values)) return entry.id
    }
    return STEPS.length
  }, [isEdit, assignees, departmentId, title, dueDate, priority, observerId])

  const missingHere = whatIsMissing(step, { assignees, departmentId, title, dueDate, priority, observerId })

  const selectedSkillNames = useMemo(() => skillIds.map((id) => skills.find((skill) => skill.id === id)?.name).filter((name): name is string => Boolean(name)), [skillIds, skills])

  async function chooseJobRole(roleId: string) {
  setJobRole(roleId); setRoleEmployees([]); await chooseAssignees([])
  setJobRoleTasks([]); setEmployeeTasks([]); setSelectedTaskId(''); setTitle(''); setDescription('')
  setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasksError('')
  if (!roleId) return

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
    setAssignees(next); setSkills([]); setSkillIds([]); setObserverId(''); setObserverName('')
    setTaskDropdownOpen(false); setEmployeeTasksError('')
    /*
     * ON CREATE, picking a person restarts the task choice: the catalogue and
     * the typed title belong to the selection being built.
     *
     * ON EDIT, they belong to a saved task. Clearing them here would mean that
     * reassigning a task silently erased the title and description its author
     * wrote - so the edit keeps them, and only the person-specific parts
     * (skills, suggested observer) are re-fetched.
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
      const [skillResult, supervisorResult, jobRoleTaskResult] = await Promise.all([
        Promise.resolve(taskService.getUserSkills(context, selectedEmployee)).then((value) => ({ status: 'fulfilled' as const, value }), (reason: unknown) => ({ status: 'rejected' as const, reason })),
        Promise.resolve(taskService.getSupervisor(context, selectedEmployee)).then((value) => ({ status: 'fulfilled' as const, value }), (reason: unknown) => ({ status: 'rejected' as const, reason })),
        Promise.resolve(taskService.getJobRoleTaskSuggestions(context, selectedEmployee, session?.org_type ?? '')).then((value) => ({ status: 'fulfilled' as const, value }), (reason: unknown) => ({ status: 'rejected' as const, reason })),
      ])
      const skillResponse = skillResult.status === 'fulfilled' ? skillResult.value : { data: [] }
      const supervisorResponse = supervisorResult.status === 'fulfilled' ? supervisorResult.value : null
      const jobRoleTaskResponse = jobRoleTaskResult.status === 'fulfilled' ? jobRoleTaskResult.value : { jobroleTasks: [] }
      setSkills((skillResponse.data ?? []).map((item) => ({
        id: String(item.skill_id ?? item.id ?? ''), name: item.skill ?? item.skill_name ?? item.name ?? '',
      })).filter((item) => item.id && item.name))
      if (supervisorResponse?.data) {
        const supervisor = { id: String(supervisorResponse.data.id), name: supervisorResponse.data.name }
        setObserverId(supervisor.id); setObserverName(supervisor.name)
        setObservers((current) => current.some((item) => item.id === supervisor.id) ? current : [...current, supervisor])
      } else {
        setError('No supervisor is mapped to the selected employee.')
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
    setRepeatDays('1'); setDueDate(''); setSkills([]); setSkillIds([]); setObserverId(''); setObserverName('')
    setKra(''); setKpa(''); setObservation(''); setAttachment(null); setJobRoleSuggestions([]); setError('')
    setSelectedTaskId(''); setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasks([]); setEmployeeTasksLoading(false); setEmployeeTasksError('')
    setJobRoleTasks([]); setTaskTitlesLoading(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null); setShowBulkUpload(false); setBulkFile(null); setBulkSampleDownloaded(false); setBulkResult(null)
    setShowRoleBulk(false); setRoleBulkSelected([]); setRoleBulkRows({})
    setStep(1)
    setTitleSource('catalogue'); setSaveToLibrary(false)
    setProjectId(''); setWorkstreams([]); setWorkstreamId(''); setProjectTasks([])
    setDependsOn([]); setDependencyType('FS'); setLagDays('0')
    submissionKey.current = ''
    setOriginal(null); setOriginalDependencies([])
    prefilledFor.current = ''
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
       * What is new is that a wizard can hide the offending field several steps
       * back, and an error message about a field you cannot see is not an
       * error message. The first failing step becomes the visible one.
       */
      const values = { assignees, departmentId, title, dueDate, priority, observerId }
      const firstBad = STEPS.find((entry) => whatIsMissing(entry.id, values))
      if (firstBad) setStep(firstBad.id)
      setError('Select employees or a department, then enter task title, observer, priority, and repeat-until date.')
      return
    }
    if (attachment && attachment.size > 5 * 1024 * 1024) { setError('Attachment must be 5 MB or smaller.'); return }
    setSaving(true); setError('')
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID()
    try {
      const response = await taskService.createLegacyTask(getLaravelContext(), {
        title: title.trim(), description: description.trim(), assigneeIds: assignees, observerId,
        priority, repeatDays, dueDate, skillIds, skillNames: selectedSkillNames, kra, kpa,
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
      const createdId = (response as { task_id?: string | number | null }).task_id
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
        skillNames: selectedSkillNames.join(','),
        skillIds: skillIds.join(','),
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
        setShowBulkUpload(false); setBulkFile(null)
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
          skills: skillIds, priority, kras: kra, kpis: kpa,
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
    setRoleBulkSelected([]); setShowRoleBulk(true); setShowBulkUpload(false); setError('')
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
        `${title.trim()} for jobrole ${roleName}. Generate task_description, repeat_once_in_every, repeat_until_date, observation_point, kras, kpis, task_type and skill_required from [${skills.map((skill) => skill.name).join(',')}]. Return one JSON object in an array.`
      )
      const generated = response[0]
      if (!generated) throw new Error('No task details were generated.')
      setDescription(generated.task_description ?? description)
      setRepeatDays(({ Day: '1', Week: '7', Month: '30', Year: '365' } as Record<string, string>)[generated.repeat_once_in_every ?? ''] ?? repeatDays)
      setDueDate(generated.repeat_until_date ?? dueDate)
      setObservation(generated.observation_point ?? observation)
      setKra(generated.kras ?? kra); setKpa(generated.kpis ?? kpa)
      setPriority(generated.task_type ?? priority)
      setSkillIds((generated.skill_required ?? []).map((name) => skills.find((skill) => skill.name === name)?.id).filter((id): id is string => Boolean(id)).slice(0, 3))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to generate task details.') }
    finally { setGenerating(false) }
  }

  return <Sheet open={isOpen} onOpenChange={(open) => !open && close()}><SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[1100px]">
    <SheetHeader className="shrink-0 border-b px-7 py-5"><div className="flex items-start justify-between pr-10"><div><SheetTitle className="text-xl">{showRoleBulk ? 'Bulk Task Assignment' : isEdit ? 'Edit Task' : 'New Assignment'}</SheetTitle><SheetDescription>{showRoleBulk ? 'Select and configure tasks for the chosen employee' : isEdit ? 'Change this task and save it' : 'Track and monitor task assignment progress'}</SheetDescription></div>{!showRoleBulk && !isEdit && assignees.length > 0 && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={openRoleBulk}>Bulk Tasks</Button><Button type="button" size="sm" onClick={() => { setShowBulkUpload(true); setShowRoleBulk(false) }}><Upload className="mr-2 size-4" />Upload Bulk Task</Button></div>}</div></SheetHeader>
    <div className="flex-1 space-y-4 overflow-y-auto p-6">
    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    {showRoleBulk ? <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Bulk Job-role Task Assignment</h3><p className="text-xs text-muted-foreground">Select and configure tasks for the chosen employees.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setShowRoleBulk(false)}><X className="size-4" /></Button></div>
      {jobRoleSuggestions.length ? <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2"><input type="checkbox" checked={roleBulkSelected.length === jobRoleSuggestions.length} onChange={(event) => setRoleBulkSelected(event.target.checked ? jobRoleSuggestions : [])} /></th><th className="p-2">Task</th><th className="p-2">Description</th><th className="p-2">Repeat</th><th className="p-2">Repeat until</th><th className="p-2">Observer</th><th className="p-2">Priority</th></tr></thead><tbody>{jobRoleSuggestions.map((task) => {
        const row = roleBulkRows[task] ?? { description: '', repeatDays: '1', dueDate: '', observerId, priority: 'Medium' as const }
        const update = (patch: Partial<typeof row>) => setRoleBulkRows((current) => ({ ...current, [task]: { ...row, ...patch } }))
        return <tr key={task} className="border-b align-top"><td className="p-2"><input type="checkbox" checked={roleBulkSelected.includes(task)} onChange={(event) => setRoleBulkSelected(event.target.checked ? [...roleBulkSelected, task] : roleBulkSelected.filter((item) => item !== task))} /></td><td className="max-w-56 p-2 font-medium">{task}</td><td className="p-2"><textarea disabled={!roleBulkSelected.includes(task)} value={row.description} onChange={(event) => update({ description: event.target.value })} className="min-h-16 w-48 rounded border p-2 disabled:bg-muted" /></td><td className="p-2"><select disabled={!roleBulkSelected.includes(task)} value={row.repeatDays} onChange={(event) => update({ repeatDays: event.target.value })} className="h-9 rounded border px-2 disabled:bg-muted">{Array.from({ length: 14 }, (_, index) => <option key={index} value={index + 1}>{index + 1} day{index ? 's' : ''}</option>)}</select></td><td className="p-2"><input disabled={!roleBulkSelected.includes(task)} type="date" min={new Date().toISOString().slice(0, 10)} value={row.dueDate} onChange={(event) => update({ dueDate: event.target.value })} className="h-9 rounded border px-2 disabled:bg-muted" /></td><td className="p-2"><select disabled={!roleBulkSelected.includes(task)} value={row.observerId} onChange={(event) => update({ observerId: event.target.value })} className="h-9 max-w-40 rounded border px-2 disabled:bg-muted"><option value="">Select</option>{observers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td><td className="p-2"><select disabled={!roleBulkSelected.includes(task)} value={row.priority} onChange={(event) => update({ priority: event.target.value as typeof row.priority })} className="h-9 rounded border px-2 disabled:bg-muted"><option>High</option><option>Medium</option><option>Low</option></select></td></tr>
      })}</tbody></table></div> : <p className="py-8 text-center text-sm text-muted-foreground">No job-role tasks found for the selected employee.</p>}
      <div className="mt-4 flex justify-center gap-2"><Button type="button" variant="outline" disabled={roleBulkSaving} onClick={() => setShowRoleBulk(false)}>Cancel</Button><Button type="button" disabled={!roleBulkSelected.length || roleBulkSaving} onClick={() => void submitRoleBulk()}>{roleBulkSaving ? 'Saving…' : `Save ${roleBulkSelected.length} Task${roleBulkSelected.length === 1 ? '' : 's'}`}</Button></div>
    </div> : <>
    {showBulkUpload && <div className="rounded-xl border bg-muted/20 p-5">
      <div className="mb-4 flex items-start justify-between"><div><h3 className="font-semibold">Bulk Task Upload</h3><p className="text-xs text-muted-foreground">Download the format first, then upload the completed CSV.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => { setShowBulkUpload(false); setBulkFile(null); setBulkResult(null) }}><X className="size-4" /></Button></div>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/task-assignment-sample.csv" download onClick={() => setBulkSampleDownloaded(true)}><Button type="button" variant="outline"><Download className="mr-2 size-4" />Download Sample CSV</Button></a>
        <label className={cn('inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium', bulkSampleDownloaded ? 'cursor-pointer bg-background' : 'cursor-not-allowed opacity-50')}>
          <FileText className="mr-2 size-4" />{bulkFile?.name ?? 'Choose CSV'}
          <input type="file" accept=".csv" className="hidden" disabled={!bulkSampleDownloaded || bulkLoading} onChange={(event) => setBulkFile(event.target.files?.[0] ?? null)} />
        </label>
        <Button type="button" disabled={!bulkFile || bulkLoading} onClick={() => void uploadBulk(bulkFile)}>{bulkLoading ? 'Uploading…' : 'Import Tasks'}</Button>
      </div>
      {!bulkSampleDownloaded && <p className="mt-2 text-xs text-warning">Please download the sample CSV before choosing a file.</p>}
      {bulkResult && <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
        <p className="font-medium">{bulkResult.imported ?? 0} task(s) imported{bulkResult.skipped_count ? `, ${bulkResult.skipped_count} row(s) skipped` : ''}.</p>
        {!!bulkResult.skipped_details?.length && <div className="mt-3 max-h-48 overflow-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b"><th className="p-2">Row</th><th className="p-2">Task</th><th className="p-2">Assigned To</th><th className="p-2">Department</th><th className="p-2">Job Role</th><th className="p-2">Reason</th></tr></thead><tbody>{bulkResult.skipped_details.map((item, index) => <tr key={`${item.row ?? index}-${index}`} className="border-b last:border-0"><td className="p-2">{item.row}</td><td className="p-2">{item.task_title}</td><td className="p-2">{item.assigned_to}</td><td className="p-2">{item.department}</td><td className="p-2">{item.job_role}</td><td className="p-2 text-destructive">{item.reason}</td></tr>)}</tbody></table></div>}
      </div>}
      <p className="mt-3 text-xs text-muted-foreground">Each row = one task record</p>
    </div>}
    {loading ? <div className="p-12 text-center">{isEdit ? 'Loading this task…' : 'Loading assignment options…'}</div> : <div className="flex flex-col gap-4">

      {/* THE STEPPER. A completed step is a link back to it; in edit mode
          every step counts as complete, so this becomes a navigation bar
          rather than a sequence — you open an existing task to change one
          field, not to walk seven screens. */}
      {/* WHAT YOU ARE ACTUALLY ASSIGNING. Above the stepper because it is
          context for the whole wizard, not for one step of it. Edit mode only:
          on create the task does not exist yet, so there is nothing to resolve. */}
      {isEdit && editTaskId && <TaskDutyContext taskId={Number(editTaskId)} />}

      <Stepper step={step} reachable={reachableStep} onGo={setStep} isEdit={isEdit} />

      {step === 1 && (
      <Section number={1} title="Who it is for" icon={Users} hint="Department narrows the people; the role narrows the work.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
      <Field label="Department *"><Select value={department} onChange={(value) => { setDepartment(value); setJobRole(''); setRoleEmployees([]); setJobRoleTasks([]); setEmployeeTasks([]); setSelectedTaskId(''); setTitle(''); setDescription(''); setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasksError(''); void chooseAssignees([]) }} options={Object.keys(directory).map((value) => ({ value, label: value }))} /></Field>
      <Field label="Job Role *"><Select value={jobRole} onChange={(value) => void chooseJobRole(value)} options={roles.map((role) => ({ value: role.id, label: role.name }))} disabled={!department} /></Field>
      {/* ASSIGN TO SITS DIRECTLY AFTER JOB ROLE. Department narrows the people,
          the role narrows the work, and the person is settled before the task so
          the catalogue list on screen is the one actually being assigned.

          MULTIPLE ASSIGNEES: the payload already joined ids with commas into
          TASK_ALLOCATED_TO and the backend already accepted it - the only thing
          missing was a way to pick more than one. Add one at a time; remove with
          the chip. No new primitive: the same Select, plus chips. */}
      <Field label="Assign To *">
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
        <Select
          value={isEdit ? (assignees[0] ?? '') : ''}
          onChange={(userId) => { if (!userId) return; if (isEdit) { void chooseAssignees([userId]) } else if (!assignees.includes(userId)) { void chooseAssignees([...assignees, userId]) } }}
          /* `employees`, NOT `departmentEmployees`. The narrowed list was
             computed and then never used, so the caption above claimed
             "Showing the 4 people in this job role" while this dropdown
             still offered the entire department — the form contradicting
             itself, which is worse than never having narrowed at all. */
          options={(isEdit ? employees : employees.filter((employee) => !assignees.includes(employee.id))).map((employee) => ({ value: employee.id, label: employee.name }))}
          disabled={!department || !employees.length}
          placeholder={!department ? 'Select a department first' : !employees.length ? 'No employees in this department' : assignees.length ? 'Add another employee' : 'Select an employee'}
        />
        {!isEdit && assignees.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assignees.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                {departmentEmployees.find((employee) => employee.id === id)?.name ?? id}
                <button type="button" aria-label="Remove assignee" onClick={() => void chooseAssignees(assignees.filter((other) => other !== id))} className="text-muted-foreground transition hover:text-destructive">&times;</button>
              </span>
            ))}
          </div>
        )}
      </Field>
        </div>
      </Section>
      )}

      {step === 2 && (
      <Section number={2} title="What the task is" icon={ClipboardList} hint="A standard duty of the role, or one-off work no catalogue entry covers.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
       <Field label="Task Title *">
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
         : <div className="relative"><div className="flex items-center gap-1"><div className="relative min-w-0 flex-1"><input value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setSelectedTaskId(''); setTitle(''); setDescription(''); setTaskDropdownOpen(true) }} onFocus={() => setTaskDropdownOpen(true)} disabled={!jobRole || taskTitlesLoading || !employeeTasks.length} placeholder={taskTitlesLoading ? 'Loading tasks…' : !jobRole ? 'Select a job role first' : employeeTasks.length ? 'Type or select a task' : 'No catalogue tasks — use Custom task'} className="h-10 w-full rounded-lg border bg-background px-3 pr-9 text-sm disabled:cursor-not-allowed disabled:bg-muted" /><button type="button" aria-label="Toggle task titles" onClick={() => setTaskDropdownOpen((open) => !open)} disabled={!employeeTasks.length || taskTitlesLoading} className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground disabled:opacity-50">▾</button></div><button type="button" onClick={() => void generateDetails()} disabled={generating || !selectedTaskId} title="Generate task details with AI" className="text-warning"><Sparkles className={cn('size-5', generating && 'animate-pulse')} /></button></div>
         {!taskTitlesLoading && employeeTasks.length > 0 && <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />{employeeTasks.length} task(s)</div>}
         {taskDropdownOpen && employeeTasks.length > 0 && <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-[460px] max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl">{employeeTasks.filter((task) => task.label.toLowerCase().includes(taskSearch.toLowerCase())).map((task) => <button key={task.value} type="button" onClick={() => { const jobRoleTask = jobRoleTasks.find((t) => t.id === task.value); setSelectedTaskId(task.value); setTitle(task.label); setTaskSearch(task.label); setDescription(jobRoleTask?.task_description ?? ''); setTaskDropdownOpen(false) }} className={cn('block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted', selectedTaskId === task.value && 'bg-primary/10 text-primary')}>{task.label}</button>)}</div>}
         {!taskTitlesLoading && jobRole && !employeeTasks.length && !employeeTasksError && <p className="mt-1.5 text-xs text-muted-foreground">This job role has no catalogue tasks yet — switch to “Custom task”.</p>}
         {employeeTasksError && <p className="mt-1.5 text-xs text-destructive">{employeeTasksError}</p>}
       </div>}</Field>
       <Field label="Task Description" span={4}><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add Task Description.." className="min-h-[62px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
        </div>
      </Section>
      )}

      {step === 3 && (
      <Section number={3} title="When and how urgent" icon={CalendarClock} hint="How often it repeats, when it is due, and how it ranks against other work.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
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
      <Field label={isEdit ? 'Due date *' : 'Repeat until *'} span={4}><Input type="date" value={dueDate} onChange={setDueDate} min={isEdit ? undefined : new Date().toISOString().slice(0, 10)} /></Field>
      <Field label="Task priority *" span={12}><div className="flex gap-5">{(['High','Medium','Low'] as const).map((value) => <button key={value} type="button" onClick={() => setPriority(value)} className={cn('flex h-14 w-20 flex-col items-center justify-center rounded-lg border-2 text-xs font-semibold', value === 'High' ? 'border-destructive text-destructive' : value === 'Medium' ? 'border-warning text-warning' : 'border-success text-success', priority === value && (value === 'High' ? 'bg-destructive/10' : value === 'Medium' ? 'bg-warning/10' : 'bg-success/10'))}><span className={cn('mb-1 size-3 rounded-full', value === 'High' ? 'bg-destructive' : value === 'Medium' ? 'bg-warning' : 'bg-success')} />{value}</button>)}</div></Field>
        </div>
      </Section>
      )}

      {step === 4 && (
      <Section number={4} title="What it builds" icon={Sparkles} hint="The skills it needs and the capability it develops.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
      <Field label="Skills Required" span={4}><Multi items={skills} selected={skillIds} onChange={setSkillIds} /></Field>
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
        </div>
      </Section>
      )}

      {step === 5 && (
      <Section number={5} title="How it is measured" icon={Target} hint="Who checks it, and what good looks like.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
      <Field label="Observer *" span={4}><Select value={observerId} onChange={(value) => { setObserverId(value); setObserverName(observers.find((item) => item.id === value)?.name ?? '') }} options={observers.map((item) => ({ value: item.id, label: item.name }))} disabled={!assignees.length || observerLoading} placeholder={observerLoading ? 'Loading supervisor…' : 'Select Observer'} /></Field>
      <Field label="Key Result Areas (KRAs)" span={4}><Input value={kra} onChange={setKra} /></Field>
      <Field label="Performance Indicators (KPIs)" span={4}><Input value={kpa} onChange={setKpa} /></Field>
      <Field label="Monitoring Points" span={4}><textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Add monitoring points.." className="min-h-[46px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
        </div>
      </Section>
      )}

      {step === 6 && (
      <Section number={6} title="Reference material" icon={Paperclip} hint="The file for the task, plus anything the person needs to do it.">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
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
      </Section>
      )}

      {step === 7 && (
      <Section number={7} title="Project delivery" icon={GitBranch} hint="Optional. Routine role work belongs to nobody's project.">
      {/* Project delivery. Optional: routine role work belongs to nobody's
          project. A dependency is only legal between two tasks in the same
          project, so the predecessor list stays empty until one is chosen. */}
      <div className="col-span-full rounded-xl border bg-muted/10 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Project delivery <span className="font-normal text-muted-foreground">(optional)</span></h3>
          <p className="text-xs text-muted-foreground">Link this task to a project so it appears on the project board and can wait on other tasks.</p>
        </div>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-12">
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
      </Section>
      )}
    </div>}
    </>}
    </div>
    {!showRoleBulk && (
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={close}>Cancel</Button>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>
              <ChevronLeft className="mr-1 size-4" /> Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* WHAT IS MISSING, NEXT TO THE BUTTON THAT IS DISABLED BY IT.
              An error at the top of a scrolling panel is an error nobody reads. */}
          {missingHere && !isEdit && (
            <span className="text-xs text-muted-foreground">{missingHere}</span>
          )}

          {step < STEPS.length ? (
            <>
              {/* SAVING IS ALWAYS AVAILABLE ONCE THE TASK IS VALID — the last
                  three steps are optional, and forcing someone through them to
                  save a complete task would be the wizard getting in the way. */}
              {isEdit && (
                <Button variant="outline" onClick={() => void saveEdit()} disabled={loading || saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              )}
              <Button
                className="rounded-full px-6"
                onClick={() => setStep(step + 1)}
                disabled={Boolean(missingHere) && !isEdit}
              >
                Next <ChevronRight className="ml-1 size-4" />
              </Button>
            </>
          ) : (
            <Button
              className="rounded-full px-8"
              onClick={() => void (isEdit ? saveEdit() : submit())}
              disabled={loading || saving}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit'}
            </Button>
          )}
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
function splitList(value: string | null | undefined): string[] {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

/**
 * The step rail.
 *
 * A completed step is a link back to it — people revise, and a wizard that only
 * goes forwards makes them cancel and start again. A step that is not yet
 * reachable is dimmed and inert rather than hidden, so the whole shape of the
 * task is visible from the first screen.
 *
 * Shape follows `ag-create-agent`'s stepper so the two wizards in this product
 * behave identically.
 */
function Stepper({ step, reachable, onGo, isEdit }: {
  step: number
  reachable: number
  onGo: (step: number) => void
  isEdit: boolean
}) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Assignment steps">
      {STEPS.map((entry) => {
        const active = step === entry.id
        // In edit mode every step is open, so "done" means reachable, not passed.
        const done = !active && entry.id <= reachable
        const locked = entry.id > reachable

        return (
          <li key={entry.id} className="min-w-[7.5rem] flex-1">
            <button
              type="button"
              onClick={() => !locked && onGo(entry.id)}
              disabled={locked}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                active && 'border-primary bg-primary/5',
                done && 'cursor-pointer border-border hover:bg-accent',
                locked && 'cursor-not-allowed border-border opacity-50',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                  active && 'bg-primary text-primary-foreground',
                  done && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  locked && 'bg-muted text-muted-foreground',
                )}
              >
                {/* Only a genuinely PASSED step gets a tick. In edit mode nothing
                    has been passed, so the number stays — a tick would claim the
                    person had reviewed a step they have not opened. */}
                {done && !isEdit ? <Check className="size-3" aria-hidden="true" /> : entry.id}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>
                  {entry.name}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">{entry.description}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A numbered section of the form.
 *
 * The form was 20 fields in one flat 12-column grid — every control equally
 * prominent, and no signal that Department must be answered before Job Role can
 * be. Numbering earns its place here because the sections ARE a sequence: each
 * one gates the next, and the cascade resets downstream fields when you change
 * an upstream one.
 *
 * Shape copied from the assessment generator's `Step` so the two screens read
 * as one product.
 */
function Section({ title, icon: Icon, hint, children }: {
  /** Accepted and unused: the stepper renders the number now. */
  number?: number
  title: string
  icon: typeof Users
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      {/* NO NUMBER BADGE HERE ANY MORE. The stepper above already says which
          step this is, and repeating it two inches lower is noise. `number` is
          kept on the props because it is what the step guard matches on. */}
      <div className="mb-3 flex items-start gap-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, span = 3, children }: { label: string; span?: number; children: React.ReactNode }) { return <label className={span === 12 ? 'md:col-span-12' : span === 8 ? 'md:col-span-8' : span === 4 ? 'md:col-span-4' : 'md:col-span-3'}><span className="mb-1.5 block text-xs font-medium">{label}</span>{children}</label> }
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
function Multi({ items, selected, onChange, disabled = false, emptyText = 'No options available' }: {
  items: Array<{ id: string; name: string }>
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  emptyText?: string
}) {
  const [query, setQuery] = useState('')
  const showSearch = items.length >= 8

  const visible = query.trim()
    ? items.filter((item) =>
        item.name.toLowerCase().includes(query.trim().toLowerCase()) || selected.includes(item.id))
    : items

  return (
    <div className={cn('rounded-lg border', disabled && 'cursor-not-allowed bg-muted opacity-60')}>
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

      <div className="max-h-32 overflow-y-auto p-2">
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
