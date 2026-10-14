'use client'

/**
 * A SAVED REPORT'S OWN PAGE — opening a report shows its results, not the
 * builder. Matches the real vtiger reference this engine is modeled on
 * (title + Customize/Duplicate + Print/Export actions + a filters summary
 * + Generate/Refresh + the data below) rather than reopening the 5-step
 * wizard just to look at a report that already exists.
 *
 * Filters are shown read-only here with an "Edit" action that opens the
 * builder jumped to its Filters step, rather than a second, parallel
 * filter-editing UI living on this page too — one editor, not two that can
 * drift apart.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarClock, Copy, Download, Loader2, Pencil, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  reportBuilderService,
  type FieldRef,
  type ReportDetail,
  type ReportResult,
  type ReportScope,
} from '@/services/reports'
import { DrilldownDialog } from './drilldown-dialog'
import { ReportViewer } from './report-viewer'
import { ScheduleDialog } from './schedule-dialog'

function describeFilter(detail: ReportDetail): string[] {
  const lines: string[] = []
  const def = detail.definition

  if (def.standard_filter?.preset) {
    const presetLabel = def.standard_filter.preset.replace(/_/g, ' ')
    lines.push(`${def.standard_filter.field} is in ${presetLabel}`)
  }

  const countConditions = (group: typeof def.advanced_filter): number => {
    if (!group) return 0
    return group.conditions.reduce((sum, c) => sum + ('conditions' in c ? countConditions(c) : 1), 0)
  }

  const count = countConditions(def.advanced_filter ?? null)

  if (count > 0) {
    lines.push(`${count} condition${count === 1 ? '' : 's'} (match ${def.advanced_filter?.op === 'OR' ? 'any' : 'all'})`)
  }

  if (lines.length === 0) {
    lines.push('No filters — every record is included.')
  }

  return lines
}

export function ReportViewPage({
  reportId,
  scope,
  onBack,
  onEdit,
  onDeleted,
}: {
  reportId: number
  scope: ReportScope
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const context = useMemo(() => getLaravelContext(), [])

  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [result, setResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [duplicating, setDuplicating] = useState(false)
  // Page/page-size are view-time only — paging through a tabular report's
  // rows never writes back to the saved report (ReportController::run()'s
  // own docblock). Reset to page 1 whenever the report itself changes.
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [drilldown, setDrilldown] = useState<{ values: Array<FieldRef & { value: string | null }>; title: string } | null>(null)
  const [schedulingOpen, setSchedulingOpen] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setPage(1)

    try {
      const [detailResponse, runResponse] = await Promise.all([
        reportBuilderService.getReport(context, reportId),
        reportBuilderService.run(context, reportId, { page: 1, perPage }),
      ])

      setDetail(detailResponse.data)
      setResult(runResponse.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be loaded.')
    } finally {
      setLoading(false)
    }
    // perPage deliberately excluded — load() only reruns on reportId/context
    // change (see the effect below); changing perPage alone goes through
    // changePerPage(), not a full reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, reportId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function refresh(nextPage = page, nextPerPage = perPage, fresh = false) {
    setRunning(true)
    setError('')

    try {
      const response = await reportBuilderService.run(context, reportId, { page: nextPage, perPage: nextPerPage, fresh })
      setResult(response.data)
      setPage(nextPage)
      setPerPage(nextPerPage)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be run.')
    } finally {
      setRunning(false)
    }
  }

  function changePage(nextPage: number) {
    void refresh(nextPage, perPage)
  }

  function changePerPage(nextPerPage: number) {
    void refresh(1, nextPerPage)
  }

  async function duplicate() {
    if (!detail) return

    setDuplicating(true)
    try {
      await reportBuilderService.createReport(context, {
        scope,
        folder_id: detail.folder_id,
        report_type: detail.report_type,
        primary_module: detail.primary_module,
        title: `${detail.title} (Copy)`,
        sharingtype: 'Private',
        definition: detail.definition,
      })
      onBack()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be duplicated.')
    } finally {
      setDuplicating(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${detail?.title}"? This cannot be undone.`)) return

    try {
      await reportBuilderService.deleteReport(context, reportId)
      onDeleted()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be removed.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Loading report…
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-4" aria-hidden="true" />
          Back
        </Button>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const rowCount =
    result && 'rows' in result ? result.total
      : result && 'groups' in result ? result.groups.length
        : result && 'row_labels' in result ? result.row_labels.length
          : result && 'labels' in result ? result.labels.length
            : 0

  // The most recent date value among this report's own date columns, over
  // every filtered row — only tabular results carry this (ReportQueryExecutionService::runTabular).
  // Surfaced up top so a stale dataset is obvious before anyone wonders why a
  // "today"/"last 7 days" filter came back empty.
  const latestDataDate = result && 'latest_date' in result ? result.latest_date : null

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Reports
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{detail.title}</h1>
            <Badge variant={detail.sharingtype === 'Public' ? 'outline' : 'muted'}>{detail.sharingtype}</Badge>
            <Badge variant="navy" className="capitalize">{detail.report_type}</Badge>
          </div>
          {detail.description && <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{rowCount} {rowCount === 1 ? 'record' : 'records'}</span>
            {detail.last_run_at && <span>Last generated {detail.last_run_at}</span>}
            {latestDataDate && <span className="font-medium text-foreground">Data as of {latestDataDate}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh(page, perPage, true)} disabled={running}>
            {running ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-1.5 size-4" aria-hidden="true" />}
            Generate now
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 size-4" aria-hidden="true" />
            Customize
          </Button>
          <Button variant="outline" size="sm" onClick={() => void duplicate()} disabled={duplicating}>
            <Copy className="mr-1.5 size-4" aria-hidden="true" />
            Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} title="Manage who this report is shared with">
            <Share2 className="mr-1.5 size-4" aria-hidden="true" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSchedulingOpen(true)} title="Email this report on a schedule">
            <CalendarClock className="mr-1.5 size-4" aria-hidden="true" />
            Schedule
          </Button>
          {result && (
            <Button variant="outline" size="sm" asChild>
              <a href={reportBuilderService.exportUrl(context, reportId)}>
                <Download className="mr-1.5 size-4" aria-hidden="true" />
                Export CSV
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void remove()}>
            <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-4 py-2.5">
        <div className="space-y-0.5">
          {describeFilter(detail).map((line) => (
            <p key={line} className="text-xs text-muted-foreground">{line}</p>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit filters</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <ReportViewer
          reportType={detail.report_type}
          result={result}
          definition={detail.definition}
          onPageChange={changePage}
          onPerPageChange={changePerPage}
          busy={running}
          onDrilldown={(values, title) => setDrilldown({ values, title })}
        />
      )}

      {drilldown && (
        <DrilldownDialog
          reportId={reportId}
          title={drilldown.title}
          values={drilldown.values}
          onClose={() => setDrilldown(null)}
        />
      )}

      {schedulingOpen && <ScheduleDialog reportId={reportId} onClose={() => setSchedulingOpen(false)} />}
    </div>
  )
}
