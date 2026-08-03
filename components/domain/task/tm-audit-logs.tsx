'use client'

/**
 * Administration > Audit Logs.
 *
 * Reads the real task_management_audit_logs trail that TaskAuditService writes
 * on every task change (status, edits, approvals, archives, deadline moves).
 * Previously rendered a hardcoded mockLogs array; the export button downloads
 * the same trail as CSV, server-streamed.
 */

import { useCallback, useEffect, useState } from 'react'
import { Download, History, ScrollText, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { taskService } from '@/services/task'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { TaskAuditLog, TaskPagination } from '@/types/task-management'

/** Human labels for the event slugs the audit service records. */
const EVENT_LABELS: Record<string, string> = {
  status_changed: 'Status changed',
  workspace_updated: 'Task edited',
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
      const response = await taskService.getAuditLogs(context, { page })
      setLogs(response.data.logs)
      setPagination(response.data.pagination)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load audit logs.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  // The API filters by task/event/date; free-text narrowing over the loaded
  // page happens here, which is what an admin scanning a screen expects.
  const visible = search
    ? logs.filter((log) =>
        [log.task_title, log.actor, log.event]
          .some((field) => field?.toLowerCase().includes(search.toLowerCase())))
    : logs

  const exportCsv = () => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return
    const link = document.createElement('a')
    link.href = taskService.auditLogsExportUrl(context)
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by task, person, or event…"
          className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm"
        />
      </div>

      {error && <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</div>}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && visible.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <ScrollText className="size-6" />
          {logs.length === 0
            ? 'No audit entries yet. They accumulate as tasks are changed.'
            : 'Nothing on this page matches the filter.'}
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
