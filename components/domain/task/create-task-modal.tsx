'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Paperclip, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { readLaravelSession } from '@/lib/laravel-session'
import { cn } from '@/lib/utils'
import { taskService } from '@/services/task'
import { TaskCompetencyInlinePanel } from '@/domain/competency/task-competency-inline-panel'
import { competencyLibrariesService } from '@/services/competency/libraries'
import type { JobRoleTask } from '@/services/task'
import type { DependencyType, ProjectRecord, Workstream } from '@/types/task-management'

interface Props { isOpen: boolean; onClose: () => void; onCreated?: (message: string) => void }
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

const DEPENDENCY_TYPES: Array<{ value: DependencyType; label: string }> = [
  { value: 'FS', label: 'Finish → Start (this starts after it finishes)' },
  { value: 'SS', label: 'Start → Start (both start together)' },
  { value: 'FF', label: 'Finish → Finish (both finish together)' },
  { value: 'SF', label: 'Start → Finish (this finishes after it starts)' },
]

export function CreateTaskModal({ isOpen, onClose, onCreated }: Props) {
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
  const employees = departmentEmployees
  const selectedSkillNames = useMemo(() => skillIds.map((id) => skills.find((skill) => skill.id === id)?.name).filter((name): name is string => Boolean(name)), [skillIds, skills])

  async function chooseJobRole(roleId: string) {
  setJobRole(roleId); setRoleEmployees([]); await chooseAssignees([])
  setJobRoleTasks([]); setEmployeeTasks([]); setSelectedTaskId(''); setTitle(''); setDescription('')
  setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasksError('')
  if (!roleId) return
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
    setSelectedTaskId(''); setTitle(''); setTaskSearch(''); setTaskDropdownOpen(false); setEmployeeTasksError('')
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
    setTitleSource('catalogue'); setSaveToLibrary(false)
    setProjectId(''); setWorkstreams([]); setWorkstreamId(''); setProjectTasks([])
    setDependsOn([]); setDependencyType('FS'); setLagDays('0')
    submissionKey.current = ''
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
    if ((!assignees.length && !departmentId) || !title.trim() || !priority || !dueDate || !observerId) { setError('Select employees or a department, then enter task title, observer, priority, and repeat-until date.'); return }
    if (attachment && attachment.size > 5 * 1024 * 1024) { setError('Attachment must be 5 MB or smaller.'); return }
    setSaving(true); setError('')
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID()
    try {
      const response = await taskService.createLegacyTask(getLaravelContext(), {
        title: title.trim(), description: description.trim(), assigneeIds: assignees, observerId,
        priority, repeatDays, dueDate, skillIds, skillNames: selectedSkillNames, kra, kpa,
        observationPoint: observation, attachment, departmentId,
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

      onCreated?.(followUp ? `${response.message} ${followUp}` : response.message); close()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create task.') }
    finally { setSaving(false) }
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
    <SheetHeader className="shrink-0 border-b px-7 py-5"><div className="flex items-start justify-between pr-10"><div><SheetTitle className="text-xl">{showRoleBulk ? 'Bulk Task Assignment' : 'New Assignment'}</SheetTitle><SheetDescription>{showRoleBulk ? 'Select and configure tasks for the chosen employee' : 'Track and monitor task assignment progress'}</SheetDescription></div>{!showRoleBulk && assignees.length > 0 && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={openRoleBulk}>Bulk Tasks</Button><Button type="button" size="sm" onClick={() => { setShowBulkUpload(true); setShowRoleBulk(false) }}><Upload className="mr-2 size-4" />Upload Bulk Task</Button></div>}</div></SheetHeader>
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
    {loading ? <div className="p-12 text-center">Loading assignment options…</div> : <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-12">
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
        <Select
          value=""
          onChange={(userId) => { if (userId && !assignees.includes(userId)) void chooseAssignees([...assignees, userId]) }}
          options={departmentEmployees.filter((employee) => !assignees.includes(employee.id)).map((employee) => ({ value: employee.id, label: employee.name }))}
          disabled={!department || !departmentEmployees.length}
          placeholder={!department ? 'Select a department first' : !departmentEmployees.length ? 'No employees in this department' : assignees.length ? 'Add another employee' : 'Select an employee'}
        />
        {assignees.length > 0 && (
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
             <label className="flex items-center gap-2 text-xs text-muted-foreground">
               <input type="checkbox" checked={saveToLibrary} disabled={!jobRole} onChange={(event) => setSaveToLibrary(event.target.checked)} />
               Also save to the Job Role Task library{!jobRole && ' (select a job role first)'}
             </label>
           </div>
         : <div className="relative"><div className="flex items-center gap-1"><div className="relative min-w-0 flex-1"><input value={taskSearch} onChange={(event) => { setTaskSearch(event.target.value); setSelectedTaskId(''); setTitle(''); setDescription(''); setTaskDropdownOpen(true) }} onFocus={() => setTaskDropdownOpen(true)} disabled={!jobRole || taskTitlesLoading || !employeeTasks.length} placeholder={taskTitlesLoading ? 'Loading tasks…' : !jobRole ? 'Select a job role first' : employeeTasks.length ? 'Type or select a task' : 'No catalogue tasks — use Custom task'} className="h-10 w-full rounded-lg border bg-background px-3 pr-9 text-sm disabled:cursor-not-allowed disabled:bg-muted" /><button type="button" aria-label="Toggle task titles" onClick={() => setTaskDropdownOpen((open) => !open)} disabled={!employeeTasks.length || taskTitlesLoading} className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground disabled:opacity-50">▾</button></div><button type="button" onClick={() => void generateDetails()} disabled={generating || !selectedTaskId} title="Generate task details with AI" className="text-warning"><Sparkles className={cn('size-5', generating && 'animate-pulse')} /></button></div>
         {!taskTitlesLoading && employeeTasks.length > 0 && <div className="mt-1.5 flex items-center gap-2 rounded-lg border bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />{employeeTasks.length} task(s)</div>}
         {taskDropdownOpen && employeeTasks.length > 0 && <div className="absolute right-0 z-50 mt-1 max-h-80 min-w-[460px] overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl">{employeeTasks.filter((task) => task.label.toLowerCase().includes(taskSearch.toLowerCase())).map((task) => <button key={task.value} type="button" onClick={() => { const jobRoleTask = jobRoleTasks.find((t) => t.id === task.value); setSelectedTaskId(task.value); setTitle(task.label); setTaskSearch(task.label); setDescription(jobRoleTask?.task_description ?? ''); setTaskDropdownOpen(false) }} className={cn('block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted', selectedTaskId === task.value && 'bg-primary/10 text-primary')}>{task.label}</button>)}</div>}
         {!taskTitlesLoading && jobRole && !employeeTasks.length && !employeeTasksError && <p className="mt-1.5 text-xs text-muted-foreground">This job role has no catalogue tasks yet — switch to “Custom task”.</p>}
         {employeeTasksError && <p className="mt-1.5 text-xs text-destructive">{employeeTasksError}</p>}
       </div>}</Field>
       <Field label="Task Description" span={4}><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add Task Description.." className="min-h-[62px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
      <Field label="Repeat Once in every *" span={4}><Select value={repeatDays} onChange={setRepeatDays} options={Array.from({ length: 14 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} day${index ? 's' : ''}` }))} /></Field>
      <Field label="Repeat until *" span={4}><Input type="date" value={dueDate} onChange={setDueDate} min={new Date().toISOString().slice(0, 10)} /></Field>
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
            userId={assignees[0] ? Number(assignees[0]) : null}
          />
        )}
      </Field>
      <Field label="Observer *" span={4}><Select value={observerId} onChange={(value) => { setObserverId(value); setObserverName(observers.find((item) => item.id === value)?.name ?? '') }} options={observers.map((item) => ({ value: item.id, label: item.name }))} disabled={!assignees.length || observerLoading} placeholder={observerLoading ? 'Loading supervisor…' : 'Select Observer'} /></Field>
      <Field label="Key Result Areas (KRAs)" span={4}><Input value={kra} onChange={setKra} /></Field>
      <Field label="Performance Indicators (KPIs)" span={4}><Input value={kpa} onChange={setKpa} /></Field>
      <Field label="Monitoring Points" span={4}><textarea value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Add monitoring points.." className="min-h-[46px] w-full rounded-lg border bg-background p-3 text-sm" /></Field>
      <Field label="Attachment" span={4}><div className="flex items-center gap-2"><label className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"><Paperclip className="size-4" />{attachment?.name ?? 'Select File'}<input ref={attachmentRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" onChange={(event) => selectAttachment(event.target.files?.[0] ?? null)} /></label>{attachment && <><a href={previewUrl ?? '#'} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Preview</a><button type="button" aria-label="Remove attachment" onClick={() => { selectAttachment(null); if (attachmentRef.current) attachmentRef.current.value = '' }}><X className="size-4 text-destructive" /></button></>}</div><p className="mt-1 text-[10px] text-muted-foreground">Supports: JPG, PNG, PDF, DOCX (Max 5MB)</p></Field>
      <Field label="Task priority *" span={12}><div className="flex gap-5">{(['High','Medium','Low'] as const).map((value) => <button key={value} type="button" onClick={() => setPriority(value)} className={cn('flex h-14 w-20 flex-col items-center justify-center rounded-lg border-2 text-xs font-semibold', value === 'High' ? 'border-destructive text-destructive' : value === 'Medium' ? 'border-warning text-warning' : 'border-success text-success', priority === value && (value === 'High' ? 'bg-destructive/10' : value === 'Medium' ? 'bg-warning/10' : 'bg-success/10'))}><span className={cn('mb-1 size-3 rounded-full', value === 'High' ? 'bg-destructive' : value === 'Medium' ? 'bg-warning' : 'bg-success')} />{value}</button>)}</div></Field>

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
            <Select value={projectId} onChange={(value) => void chooseProject(value)}
              options={projects.map((project) => ({ value: project.id, label: `${project.code} · ${project.name}` }))}
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
    </div>}
    </>}
    </div>
    {!showRoleBulk && <div className="flex shrink-0 justify-center gap-2 border-t bg-background p-4"><Button variant="outline" onClick={close}>Cancel</Button><Button className="rounded-full px-8" onClick={submit} disabled={loading || saving}>{saving ? 'Submitting…' : 'Submit'}</Button></div>}
  </SheetContent></Sheet>
}

function Field({ label, span = 3, children }: { label: string; span?: number; children: React.ReactNode }) { return <label className={span === 12 ? 'md:col-span-12' : span === 8 ? 'md:col-span-8' : span === 4 ? 'md:col-span-4' : 'md:col-span-3'}><span className="mb-1.5 block text-xs font-medium">{label}</span>{children}</label> }
function Input({ value, onChange, type = 'text', min, disabled }: { value: string; onChange: (value: string) => void; type?: string; min?: string; disabled?: boolean }) { return <input type={type} min={min} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-muted" /> }
function Multi({ items, selected, onChange, disabled = false, emptyText = 'No options available' }: { items: Array<{ id: string; name: string }>; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; emptyText?: string }) { return <div className={cn('max-h-32 overflow-y-auto rounded-lg border p-2', disabled && 'cursor-not-allowed bg-muted opacity-60')}>{items.length ? items.map((item) => <label key={item.id} className="flex gap-2 py-1 text-sm"><input type="checkbox" disabled={disabled} checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />{item.name}</label>) : <span className="text-xs text-muted-foreground">{emptyText}</span>}</div> }
