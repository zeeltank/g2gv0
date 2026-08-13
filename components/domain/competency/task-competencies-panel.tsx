'use client'

/**
 * TASK COMPETENCIES — which competency each job-role task exercises.
 *
 * `jobrole_task_competency_map` holds ZERO rows. Golden thread 2 currently carries
 * the capability signal on `task.skill_id`, hand-picked per ticket at 67% coverage.
 * This is the catalogue-level answer that replaces guessing per ticket.
 *
 * WHY THE LAYOUT DIFFERS FROM THE OTHER TWO MAP PANELS
 *
 * A course has ONE competency list, so its panel is one subject and one table. A
 * JOB ROLE HAS UP TO 209 TASKS, each holding several competencies. Forcing the
 * one-subject shape onto that would mean a role-then-task-then-competency drill
 * for every edit — more clicks to make three panels look alike, which is
 * consistency serving the screens rather than the user.
 *
 * So: pick a role, get its tasks as rows, expand a row to edit that task's list.
 *
 * THE UNMAPPED TASK IS VISIBLE, NOT FILTERED AWAY. It is the normal case and the
 * reason the browse endpoint exists — an unmapped task has no row in the map and
 * cannot appear in a query over it, which is why the server does a LEFT JOIN.
 *
 * SYNC IS SURFACED PER TASK. The removal count is reported in words on every save,
 * exactly as on the other two panels, even though the layout differs.
 *
 * NO PAGINATION, and it is measured rather than assumed: the DECLARED REFERENT
 * (`s_jobrole_task`) has median 19 tasks per role, p90 31, max 209, and only SEVEN
 * roles above 100. A scrollable list with a count is honest; a pager for seven
 * roles is furniture.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Save, AlertTriangle, Loader2, ListChecks,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  taskCompetenciesService,
  type TaskMapRole,
  type TaskMapTask,
} from '@/services/competency/task-competencies'
import { competencyDefinitionsService } from '@/services/competency/definitions'

export function TaskCompetenciesPanel() {
  const { user } = useAuth()

  const [roles, setRoles] = useState<TaskMapRole[]>([])
  const [roleFilter, setRoleFilter] = useState('')
  const [jobrole, setJobrole] = useState<string>('')

  const [tasks, setTasks] = useState<TaskMapTask[]>([])
  const [counts, setCounts] = useState({ tasks: 0, mapped: 0, unmapped: 0 })
  const [emptyIsExpected, setEmptyIsExpected] = useState(false)

  const [competencies, setCompetencies] = useState<{ id: number; name: string }[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<number, number[]>>({})
  const [addFor, setAddFor] = useState<Record<number, string>>({})

  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const canEdit = user?.role === 'admin' || user?.role === 'hr'

  useEffect(() => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    taskCompetenciesService.roles(ctx)
      .then((res) => setRoles(res?.data ?? []))
      .catch(() => setRoles([]))
    competencyDefinitionsService.list(ctx)
      .then((res) => setCompetencies((res?.data ?? []).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompetencies([]))
  }, [user])

  const load = useCallback(async (role: string) => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    setLoading(true); setError(null); setNotice(null); setOpen(null)
    try {
      const res = await taskCompetenciesService.tasks(ctx, role)
      const rows = res?.data ?? []
      setTasks(rows)
      setCounts(res?.counts ?? { tasks: rows.length, mapped: 0, unmapped: rows.length })
      setEmptyIsExpected(Boolean(res?.empty_is_expected))
      setDraft(Object.fromEntries(rows.map((t) => [
        t.jobrole_task_id, t.competencies.map((c) => c.competency_id),
      ])))
    } catch {
      setError('Could not load this role’s tasks.')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (jobrole) load(jobrole) }, [jobrole, load])

  /* The role list is 2,761 long, so it is filtered by typing rather than
     scrolled. This is a filter over a LIST OF ROLES, not a search over 55,961
     tasks - the map keys on the task and the role is already in the key. */
  const shownRoles = useMemo(() => {
    const q = roleFilter.trim().toLowerCase()
    const base = q ? roles.filter((r) => r.jobrole.toLowerCase().includes(q)) : roles
    return base.slice(0, 200)
  }, [roles, roleFilter])

  const saveTask = async (taskId: number) => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    const ids = draft[taskId] ?? []
    if (ids.length === 0) {
      setError('A task needs at least one competency. Use the bin to clear rows one at a time.')
      return
    }
    setSavingId(taskId); setError(null); setNotice(null)
    try {
      const res = await taskCompetenciesService.save(ctx, taskId, ids)
      // SYNC IS SAID IN WORDS, per task. The layout differs from the other two
      // panels; the honesty about deletion does not.
      setNotice(res.removed > 0
        ? `Saved. ${res.mapped} competency(s) on this task, ${res.removed} removed.`
        : `Saved. ${res.mapped} competency(s) on this task.`)
      await load(jobrole)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSavingId(null)
    }
  }

  const nameOf = (id: number) => competencies.find((c) => c.id === id)?.name ?? `#${id}`

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ListChecks className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What each task exercises</p>
            <p className="mt-1">
              Completing a task becomes evidence toward the competency it exercises. Without this
              map, that evidence is guessed per ticket rather than derived from the role.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Find a job role
          </label>
          <Input
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            placeholder="Type to filter 2,761 roles…"
            className="h-9"
          />
        </div>
        <div className="min-w-[320px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Job role</label>
          <Select
            value={jobrole}
            placeholder={shownRoles.length === 0 ? 'No roles match' : 'Select a job role…'}
            onChange={setJobrole}
            options={shownRoles.map((r) => ({
              value: r.jobrole,
              label: `${r.jobrole} (${r.task_count})`,
            }))}
          />
        </div>
        {jobrole && !loading && (
          <p className="text-sm text-muted-foreground pb-2">
            {counts.tasks} task{counts.tasks === 1 ? '' : 's'} · {counts.mapped} mapped ·{' '}
            {counts.unmapped} not yet
          </p>
        )}
      </div>

      {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-500">{notice}</p>}

      {competencies.length === 0 && jobrole && (
        <p className="text-sm text-amber-600 dark:text-amber-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No competencies are defined in this organisation, so there is nothing to map onto a task.
        </p>
      )}

      {!jobrole ? (
        <EmptyState
          title="Select a job role"
          description="Tasks belong to a job role, so pick one to see its tasks and what each exercises."
        />
      ) : loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : tasks.length === 0 ? (
        <EmptyState title="This role has no tasks in the catalogue" description="Nothing to map." />
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border">
          {emptyIsExpected && (
            <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/40">
              Nothing in this role is mapped yet. That is the expected state — this catalogue is
              filled by your organisation, not derived.
            </p>
          )}
          {tasks.map((t) => {
            const ids = draft[t.jobrole_task_id] ?? []
            const isOpen = open === t.jobrole_task_id
            return (
              <div key={t.jobrole_task_id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : t.jobrole_task_id)}
                  className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-muted/40"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span className="flex-1 text-sm">{t.task}</span>
                  {/* THE UNMAPPED TASK IS LABELLED, NOT HIDDEN. */}
                  <span className={ids.length === 0
                    ? 'text-xs text-muted-foreground shrink-0'
                    : 'text-xs text-foreground shrink-0'}>
                    {ids.length === 0 ? 'not mapped' : `${ids.length} competency${ids.length === 1 ? '' : 's'}`}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-10 pb-4 space-y-2">
                    {t.critical_work_function && (
                      <p className="text-xs text-muted-foreground">{t.critical_work_function}</p>
                    )}
                    {ids.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nothing mapped to this task yet.
                      </p>
                    )}
                    {ids.map((cid) => (
                      <div key={cid} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{nameOf(cid)}</span>
                        {canEdit && (
                          <Button variant="ghost" size="sm" aria-label={`Remove ${nameOf(cid)}`}
                            onClick={() => setDraft((d) => ({
                              ...d, [t.jobrole_task_id]: (d[t.jobrole_task_id] ?? []).filter((x) => x !== cid),
                            }))}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {canEdit && (
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <div className="min-w-[240px]">
                          <Select
                            value={addFor[t.jobrole_task_id] ?? ''}
                            placeholder="Add a competency…"
                            onChange={(v) => setAddFor((a) => ({ ...a, [t.jobrole_task_id]: v }))}
                            options={competencies
                              .filter((c) => !ids.includes(c.id))
                              .map((c) => ({ value: String(c.id), label: c.name }))}
                          />
                        </div>
                        <Button variant="outline" size="sm" className="gap-1"
                          disabled={!addFor[t.jobrole_task_id]}
                          onClick={() => {
                            const v = Number(addFor[t.jobrole_task_id])
                            if (!v) return
                            setDraft((d) => ({
                              ...d, [t.jobrole_task_id]: [...(d[t.jobrole_task_id] ?? []), v],
                            }))
                            setAddFor((a) => ({ ...a, [t.jobrole_task_id]: '' }))
                          }}>
                          <Plus className="w-4 h-4" /> Add
                        </Button>
                        <Button size="sm" className="gap-1 ml-auto"
                          disabled={savingId === t.jobrole_task_id}
                          onClick={() => saveTask(t.jobrole_task_id)}>
                          {savingId === t.jobrole_task_id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Save className="w-4 h-4" />}
                          Save this task
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Saving replaces this task’s whole list. Rows removed here are deleted on save.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
