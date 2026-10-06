'use client'

import { useEffect, useRef, useState } from 'react'
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
 * One row per file in a multi-file (or recursive-folder, or zip-extracted)
 * upload, each with its own live "big streaming" progress bar, plus a big
 * aggregate ring up top.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STILL HONEST, JUST BIGGER — THE PER-ROW BAR IS BOUNDED CREEP, NOT A LIE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This still does NOT poll each file's own `processing_step` — see the
 * original reasoning below, unchanged: a 50-file folder upload polling 50
 * documents in parallel is a real cost, and a file reaching "Uploaded" here
 * is already filed and searchable, with classification finishing in the
 * background exactly as it does for any other upload. What's new is that
 * "uploading" is no longer a bare spinner: `creepPercent()` turns elapsed
 * wall-clock time into a bar position using the exact bounded-creep idea
 * `DocumentProcessingProgress` already uses for its own pipeline steps (see
 * its docblock) — fast at first, decelerating, capped at `UPLOADING_CAP` so
 * it can never claim "done" before the request actually resolves to `done`
 * or `error`. One shared ticking clock drives every row's bar (a `tick`
 * state bump, not N per-row intervals), so this stays cheap at any batch size.
 */

const TICK_MS = 180
const UPLOADING_CAP = 92

/** Fast out of the gate, decelerating toward the cap — never reaches it, so a long-running upload still visibly "waits" at the cap rather than looking finished. */
function creepPercent(elapsedMs: number): number {
  const progress = 1 - Math.exp(-elapsedMs / 2200)
  return Math.min(UPLOADING_CAP, progress * UPLOADING_CAP)
}

export function DocumentBatchUploadProgress({ files }: { files: BatchFileState[] }) {
  const done = files.filter((f) => f.status === 'done').length
  const failed = files.filter((f) => f.status === 'error').length
  const finished = files.length > 0 && done + failed === files.length

  // One timestamp per file, set the moment it first turns 'uploading' - read
  // by every row (and the aggregate) on each shared tick to derive a percent
  // purely from elapsed time. A ref because it's bookkeeping, not something
  // that should itself trigger a render.
  const startedAt = useRef(new Map<string, number>())

  const [, bumpTick] = useState(0)

  useEffect(() => {
    for (const f of files) {
      if (f.status === 'uploading' && !startedAt.current.has(f.key)) {
        startedAt.current.set(f.key, Date.now())
      }
    }
  }, [files])

  useEffect(() => {
    if (finished) return
    const id = setInterval(() => bumpTick((t) => t + 1), TICK_MS)
    return () => clearInterval(id)
  }, [finished])

  function rowPercent(f: BatchFileState): number {
    if (f.status === 'done' || f.status === 'error') return 100
    if (f.status !== 'uploading') return 0
    const start = startedAt.current.get(f.key)
    return start ? creepPercent(Date.now() - start) : 0
  }

  const overallPercent =
    files.length === 0 ? 0 : Math.round(files.reduce((sum, f) => sum + rowPercent(f), 0) / files.length)

  const circumference = 2 * Math.PI * 26

  return (
    <div className="py-2">
      {/* The big aggregate: a ring instead of a text line, breathing gently
          while anything is still in flight (g2g-breathe, globals.css) so the
          whole summary reads as alive, not just whatever's inside it. */}
      <div
        className={cn(
          'mb-4 flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4',
          !finished && 'motion-safe:[animation:g2g-breathe_3s_ease-in-out_infinite]',
        )}
      >
        <div className="relative flex size-16 shrink-0 items-center justify-center" aria-hidden="true">
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-muted" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={cn(
                'transition-[stroke-dashoffset] duration-300 ease-out',
                finished && failed > 0 ? 'stroke-destructive' : 'stroke-primary',
              )}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - overallPercent / 100)}
            />
          </svg>
          <span className="absolute text-sm font-bold tabular-nums text-foreground">{overallPercent}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {finished
              ? failed > 0
                ? `${done} of ${files.length} uploaded — ${failed} failed`
                : `All ${files.length} file${files.length === 1 ? '' : 's'} uploaded`
              : `Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {finished
              ? 'Each file finishes reading and classification in the background.'
              : `${done + failed} of ${files.length} done so far`}
          </p>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
        <ul className="divide-y divide-border">
          {files.map((f, i) => {
            const percent = rowPercent(f)

            return (
              <li
                key={f.key}
                className="flex items-center gap-2.5 px-3 py-2 motion-safe:[animation:g2g-row-enter_0.35s_ease-out_backwards]"
                style={{ animationDelay: `${Math.min(i, 24) * 35}ms` }}
              >
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

                  {f.status === 'error' && f.errorMessage ? (
                    <p className="truncate text-xs text-destructive">{f.errorMessage}</p>
                  ) : (
                    <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'relative h-full overflow-hidden rounded-full transition-[width] duration-300 ease-out',
                          f.status === 'error' ? 'bg-destructive' : 'bg-primary',
                        )}
                        style={{ width: `${percent}%` }}
                      >
                        {f.status === 'uploading' && (
                          <span
                            className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,white_55%,transparent)_45%,transparent_60%)] bg-[length:250%_100%]"
                            style={{ animation: 'g2g-stream-flow 1.1s linear infinite' }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {f.status === 'uploading' && (
                        <span
                          className="absolute top-0 h-full w-2 rounded-full bg-white/80"
                          style={{ animation: 'g2g-particle-drift 1.5s ease-in-out infinite' }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
