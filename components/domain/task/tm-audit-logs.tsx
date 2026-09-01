'use client'

/**
 * Administration > Audit Logs.
 *
 * Reads the real task_management_audit_logs trail that TaskAuditService writes
 * on every task change (status, edits, approvals, archives, deadline moves).
 * Previously rendered a hardcoded mockLogs array; the export button downloads
 * the same trail as CSV, server-streamed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, History, ScrollText, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { TaskAuditLog, TaskPagination } from '@/types/task-management'

/** Human labels for the event slugs the audit service records. */
/**
 * Event slug -> what a person calls it.
 *
 * MEASURED AGAINST THE REAL TRAIL, not guessed. Once the event store was drained
 * into its projection the screen went from 6 frozen rows to 43 on live, and the
 * commonest event by far — `created`, 28 of those 43 — had no entry here at all,
 * so the majority of the log rendered as a raw slug. `updated` and
 * `schedule_updated` were missing for the same reason.
 *
 * An unmapped slug still falls back to itself rather than to a blank, so a new
 * event type is unlovely rather than invisible.
 */
const EVENT_LABELS: Record<string, string> = {
  created: 'Task created',
  updated: 'Task edited',
  status_changed: 'Status changed',
  workspace_updated: 'Task edited',
  schedule_updated: 'Schedule changed',
  legacy_updated: 'Task edited',
  legacy_deleted: 'Task deleted',
  archived: 'Task archived',
  approved: 'Approved',
  rejected: 'Sent back for rework',
  deadline_extended: 'Deadline extended',
}

export function TmAuditLogs() {
  const [logs, setLogs] = useState<TaskAuditLog[]>([])
  const [pagination, setPagination] = useState<TaskPagination | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /*
   * THE FILTERS THE SERVER HAS ALWAYS ACCEPTED AND THIS SCREEN NEVER SENT.
   *
   * The endpoint validated event, from, to, task_id, actor_id, department_id and
   * project_id, and the service layer passes all of them - but the screen called
   * it with nothing but a page number, so the whole trail was the only view
   * available and "Export CSV" dumped every row regardless of what was on
   * screen. Held in one object so the load and the export URL are built from the
   * same value and cannot drift apart.
   */
  const [filters, setFilters] = useState<{
    event: string; departmentId: string; projectId: string; from: string; to: string
  }>({ event: '', departmentId: '', projectId: '', from: '', to: '' })

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])

  /** Only the keys that are set, so an unfiltered call is what it always was. */
  const activeParams = useMemo(() => ({
    ...(filters.event ? { event: filters.event } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }), [filters])

  const filtersActive = Object.keys(activeParams).length > 0

  const setFilter = (key: keyof typeof filters, value: string) => {
    // Any filter change returns to page 1. Staying on page 4 of a narrower
    // result set is how a filtered screen shows "no entries" and looks broken.
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const clearFilters = () => {
    setPage(1)
    setFilters({ event: '', departmentId: '', projectId: '', from: '', to: '' })
  }

  // Option lists for the two id-based filters. Failure is deliberately silent:
  // a menu that cannot be populated should leave the screen usable rather than
  // replace the audit trail with an error about a dropdown.
  useEffect(() => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    void (async () => {
      try {
        const options = await taskService.getProjectOptions(context)
        setDepartments(options.data.departments ?? [])
      } catch { /* leave the department menu empty */ }

      try {
        const records = await taskService.getProjectRecords(context, { perPage: 200 })
        setProjects(records.data.projects.map((project) => ({ id: String(project.id), name: project.name })))
      } catch { /* leave the project menu empty */ }
    })()
  }, [])

  const load = useCallback(async () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await taskService.getAuditLogs(context, { ...activeParams, page })
      setLogs(response.data.logs)
      setPagination(response.data.pagination)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page, activeParams])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  // The API filters by event, date, department and project; free-text narrowing
  // over the loaded page happens here, which is what an admin scanning a screen
  // expects.
  const visible = search
    ? logs.filter((log) =>
        [log.task_title, log.actor, log.event]
          .some((field) => field?.toLowerCase().includes(search.toLowerCase())))
    : logs

  const exportCsv = () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    const link = document.createElement('a')
    // THE SAME FILTERS THE SCREEN IS SHOWING. The export used to ignore them,
    // so the file silently disagreed with the page that produced it.
    link.href = taskService.auditLogsExportUrl(context, activeParams)
    link.rel = 'noopener'
    link.click()
  }

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
              <History className="h-6 w-6" />
            </div>
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Every task change, who made it, and what it looked like before.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="mr-2 size-4" /> Export CSV
        </Button>
      </div>

      {/* THE SERVER FILTERS, IN ONE ROW ABOVE THE TRAIL. These narrow the whole
          trail and the CSV; the text box below them narrows only the page on
          screen, which is a different job and is labelled as such. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Event
          <select
            value={filters.event}
            onChange={(e) => setFilter('event', e.target.value)}
            className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm text-foreground"
          >
            <option value="">All events</option>
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Department
          <select
            value={filters.departmentId}
            onChange={(e) => setFilter('departmentId', e.target.value)}
            disabled={departments.length === 0}
            className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm text-foreground disabled:opacity-50"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>{department.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Project
          <select
            value={filters.projectId}
            onChange={(e) => setFilter('projectId', e.target.value)}
            disabled={projects.length === 0}
            className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm text-foreground disabled:opacity-50"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          To
          <input
            type="date"
            value={filters.to}
            // The server refuses a `to` earlier than `from` with a 422; setting
            // the minimum here means the user never reaches that error.
            min={filters.from || undefined}
            onChange={(e) => setFilter('to', e.target.value)}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground"
          />
        </label>

        {filtersActive && (
          <Button variant="ghost" onClick={clearFilters} className="h-10 text-danger">
            Clear filters
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Narrow this page by task, person, or event…"
          className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"
        />
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && visible.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <ScrollText className="size-6" />
          {logs.length === 0
            ? (filtersActive
                ? 'No audit entries match these filters. Clear them to see the whole trail.'
                : 'No audit entries yet. They accumulate as tasks are changed.')
            : 'Nothing on this page matches the text above.'}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {visible.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {EVENT_LABELS[log.event] ?? log.event}
                    <span className="text-muted-foreground"> — {log.task_title ?? `Task #${log.task_id}`}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {log.actor ?? 'System'} · {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </p>
                  {log.before && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Before: {Object.entries(log.before)
                        .filter(([, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
                        .join(' · ') || '—'}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">#{log.task_id}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span>{pagination.total} entries</span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
