'use client'

import { useState } from 'react'
import { FileUp, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { taskService } from '@/services/task'
import type { IcsImportResult } from '@/types/task-management'

interface Props {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

/**
 * Upload → show imported/skipped counts, with a reason per skipped row.
 * Structurally the same "upload, then show a result table" shape as
 * bulk-csv-panel.tsx, since that component already solves exactly this UX
 * problem for CSV task import — simpler here because an .ics file needs no
 * "download the format first" gate (there's no ambiguous column mapping).
 */
export function IcsImportModal({ isOpen, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IcsImportResult | null>(null)
  const [error, setError] = useState('')

  const upload = async () => {
    if (!file) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setLoading(true); setError('')
    try {
      const response = await taskService.importIcs(context, file)
      setResult(response.data)
      if (response.data.imported > 0) onImported()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to import that file.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setFile(null); setResult(null); setError(''); onClose() }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) reset() }}>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>Import Calendar (.ics)</SheetTitle>
          <SheetDescription>Bring events in from another calendar — already-imported events are skipped, never duplicated.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-muted/30">
            <FileUp className="size-5" />
            {file ? file.name : 'Choose an .ics file'}
            <input type="file" accept=".ics,text/calendar" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null) }} />
          </label>

          <Button onClick={() => void upload()} disabled={!file || loading} className="w-full">
            <Upload className="mr-2 size-4" />{loading ? 'Importing…' : 'Import'}
          </Button>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{result.imported} event(s) imported{result.skipped ? `, ${result.skipped} skipped` : ''}.</p>
              {result.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {result.details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <X className="mt-0.5 size-3 shrink-0 text-destructive" />
                      <span><span className="font-medium text-foreground">{detail.summary}</span> — {detail.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={reset}>Close</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
