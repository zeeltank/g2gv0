'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildCsv, collectSignals, csvFileName, EXPORT_CAP, ExportCancelled } from '@/lib/signal-review/export-csv'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { SignalListParams } from '@/services/signal-review/signal-types'

export interface ScreenNotice {
  tone: 'success' | 'warning' | 'error' | 'info'
  text: string
}

/** Hands the file to the browser's download manager. */
export function downloadTextFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Not at once: some browsers cancel a download whose address is revoked in the same turn.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function describeFailure(cause: unknown): string {
  const reason = cause instanceof Error && cause.message ? cause.message : 'Something went wrong.'
  return `The export failed: ${reason} No file was saved.`
}

/**
 * Export: downloads the signals that match the filters on screen as a CSV file. It reads the list page by page (up to the server's page size), builds the
 * file in the browser and saves it. The button is off while it works, says how far it is, and can be cancelled; the outcome is handed to `onNotice`.
 */
export function SignalExportButton({ params, service, onNotice, save = downloadTextFile, now = () => new Date() }: {
  /** The screen's filters as a list request. */
  params: SignalListParams
  service: Pick<SignalReviewApi, 'list'>
  onNotice: (notice: ScreenNotice) => void
  /** Where the file goes. Tests replace it; the default is a download. */
  save?: (name: string, text: string) => void
  now?: () => Date
}) {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const running = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  // Leaving the screen ends the export: nothing is saved and nothing is said.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      running.current?.abort()
    }
  }, [])

  const start = useCallback(async () => {
    if (running.current) return
    const controller = new AbortController()
    running.current = controller
    setProgress({ loaded: 0, total: 0 })

    try {
      const collected = await collectSignals({
        fetchPage: (request) => service.list(request),
        params,
        signal: controller.signal,
        onProgress: (next) => { if (mounted.current) setProgress(next) },
      })

      if (collected.rows.length === 0) {
        onNotice({ tone: 'info', text: 'No signals match these filters, so there was nothing to export.' })
        return
      }

      const name = csvFileName(now())
      save(name, buildCsv(collected.rows, collected.products))
      onNotice(collected.capped
        ? { tone: 'warning', text: `Saved ${name} with the first ${EXPORT_CAP} of ${collected.total} signals. A file holds at most ${EXPORT_CAP}; narrow the filters to export the rest.` }
        : { tone: 'success', text: `Saved ${name} with ${collected.rows.length} ${collected.rows.length === 1 ? 'signal' : 'signals'}.` })
    } catch (cause) {
      if (!mounted.current) return
      onNotice(cause instanceof ExportCancelled
        ? { tone: 'info', text: 'Export cancelled. No file was saved.' }
        : { tone: 'error', text: describeFailure(cause) })
    } finally {
      running.current = null
      if (mounted.current) setProgress(null)
    }
  }, [service, params, onNotice, save, now])

  const busy = progress !== null
  const label = progress && progress.total > 0 ? `Exporting ${progress.loaded} of ${progress.total}…` : 'Exporting…'

  return (
    <>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void start()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        {busy ? label : 'Export'}
      </Button>
      {busy && <Button type="button" variant="ghost" onClick={() => running.current?.abort()}>Cancel export</Button>}
      {busy && <span role="status" className="sr-only">{label}</span>}
    </>
  )
}
