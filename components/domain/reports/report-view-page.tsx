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
import { AlertCircle, ArrowLeft, Copy, Download, Loader2, Pencil, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  reportBuilderService,
  type ReportDetail,
  type ReportResult,
  type ReportScope,
} from '@/services/reports'
import { ReportViewer } from './report-viewer'

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

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [detailResponse, runResponse] = await Promise.all([
        reportBuilderService.getReport(context, reportId),
        reportBuilderService.run(context, reportId),
      ])

      setDetail(detailResponse.data)
      setResult(runResponse.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [context, reportId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function refresh() {
    setRunning(true)
    setError('')

    try {
      const response = await reportBuilderService.run(context, reportId)
      setResult(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This report could not be run.')
    } finally {
      setRunning(false)
    }
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={running}>
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

      <p className="text-xs text-muted-foreground">
        {rowCount} {rowCount === 1 ? 'record' : 'records'}
        {detail.last_run_at && ` · last generated ${detail.last_run_at}`}
      </p>

      {result && <ReportViewer reportType={detail.report_type} result={result} definition={detail.definition} />}
    </div>
  )
}
