'use client'

/**
 * The member rows behind one summary/chart/pivot group (Docs/reports-
 * engine/PLAN.md, Phase 4) — clicking a group opens this instead of leaving
 * "how many" as the only answer a report can give. Reuses TabularView as-is
 * (the backend's own drilldown endpoint returns the same tabular result
 * shape, plus the column list to render it with — a drill-down has no
 * report-authored columns of its own).
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { reportBuilderService, type FieldRef, type ReportColumn, type TabularResult } from '@/services/reports'
import { TabularView } from './tabular-view'

export function DrilldownDialog({
  reportId,
  title,
  values,
  onClose,
}: {
  reportId: number
  title: string
  values: Array<FieldRef & { value: string | null }>
  onClose: () => void
}) {
  const [result, setResult] = useState<TabularResult | null>(null)
  const [columns, setColumns] = useState<ReportColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    queueMicrotask(async () => {
      const context = getLaravelContext()

      if (!isLaravelContextReady(context)) {
        if (!cancelled) {
          setError('Your ERP session is unavailable. Please sign in again.')
          setLoading(false)
        }
        return
      }

      try {
        const response = await reportBuilderService.drilldown(context, reportId, values)

        if (cancelled) return

        const { columns: responseColumns, ...tabular } = response.data
        setResult(tabular)
        setColumns(responseColumns)
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'These rows could not be loaded.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, JSON.stringify(values)])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[80vh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              Loading rows…
            </div>
          )}

          {!loading && error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && result && <TabularView result={result} columns={columns} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
