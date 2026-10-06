'use client'

import { AlertCircle, Check, FileClock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BatchFileState {
  /** relativePath for a folder upload, or the filename for a flat multi-file one — stable per row across re-renders. */
  key: string
  fileName: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMessage?: string
}

/**
 * One row per file in a multi-file (or recursive-folder) upload.
 *
 * Deliberately upload-level only — it does NOT poll each file's own
 * `processing_step` the way the single-document `DocumentProcessingProgress`
 * does. A 50-file folder upload polling 50 documents in parallel is a real
 * cost (and this deployment self-spawns a queue worker per upload already —
 * see `ensureQueueWorkerRunning()`'s docblock); a file reaching "Uploaded"
 * here is already filed and searchable by title, classification finishes in
 * the background exactly as it does for any other upload, and is visible
 * from each document's own detail panel afterward. This is a deliberate v1
 * scope cut, not an oversight.
 */
export function DocumentBatchUploadProgress({ files }: { files: BatchFileState[] }) {
  const done = files.filter((f) => f.status === 'done').length
  const failed = files.filter((f) => f.status === 'error').length

  return (
    <div className="py-2">
      <p className="text-sm text-muted-foreground">
        {done + failed} of {files.length} uploaded
        {failed > 0 ? ` — ${failed} failed` : ''}
      </p>

      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.key} className="flex items-center gap-2.5 px-3 py-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  f.status === 'done'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : f.status === 'error'
                      ? 'border-destructive text-destructive'
                      : f.status === 'uploading'
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground/50',
                )}
              >
                {f.status === 'done' ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : f.status === 'error' ? (
                  <AlertCircle className="size-3.5" aria-hidden="true" />
                ) : f.status === 'uploading' ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileClock className="size-3.5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{f.fileName}</p>
                {f.status === 'error' && f.errorMessage && (
                  <p className="truncate text-xs text-destructive">{f.errorMessage}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
