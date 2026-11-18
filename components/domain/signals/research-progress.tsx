'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeProgress, formatDuration, isTerminal, type RunProgressInput } from '@/lib/research-steps'

/**
 * The Generate Signals progress bar, shown beside the research-date dropdown. It reads the run the backend persists (stage, counts, timestamps)
 * and shows only what that says: the step in progress, a step-based percentage, counts, elapsed time and the last update. A failed run shows its
 * reason and an explicit Retry, never a success or 100%. It starts nothing by itself.
 */
export function ResearchProgress({ run, onRetry, retryDisabled }: { run: RunProgressInput | null; onRetry: () => void; retryDisabled?: boolean }) {
  const live = Boolean(run) && !isTerminal(run?.status)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 1000)

    return () => clearInterval(id)
  }, [live])

  if (!run) return null
  const v = describeProgress(run, now)
  const active = v.state === 'queued' || v.state === 'running'
  const moving = active && !v.stale   // a run that has gone quiet is never animated as if it were working

  const tone = v.state === 'failed'
    ? 'border-destructive/40 bg-destructive/5'
    : v.stale ? 'border-amber-500/40 bg-amber-500/5'
    : v.state === 'completed' ? (v.limited ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5') : 'border-primary/30 bg-primary/5'

  return (
    <div data-testid="research-progress" data-state={v.state} className={`mt-5 min-w-0 overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${tone}`}>
      <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {moving && <Loader2 className="size-5 animate-spin" aria-hidden />}
        {v.state === 'completed' && <CheckCircle2 className={`size-5 ${v.limited ? 'text-amber-600' : 'text-emerald-600'}`} aria-hidden />}
        {v.state === 'failed' && <AlertTriangle className="size-5 text-destructive" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
      <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-medium">
          {v.state === 'queued' && 'Queued'}
          {v.state === 'running' && (v.stepNumber ? `Step ${v.stepNumber} of ${v.totalSteps}: ${v.steps[v.stepNumber - 1].label}` : 'Research is running')}
          {v.state === 'completed' && (v.limited ? 'Finished with limits' : 'Research complete')}
          {v.state === 'failed' && 'Research did not complete'}
        </span>
        {v.percent !== null && active && <span className="text-xs tabular-nums text-muted-foreground">{v.percent}%</span>}
        {v.elapsedSeconds !== null && <span className="text-xs tabular-nums text-muted-foreground">· {formatDuration(v.elapsedSeconds)}</span>}
      </div>

      {active && (
        <div
          role="progressbar"
          aria-label="Research progress"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(v.percent !== null ? { 'aria-valuenow': v.percent, 'aria-valuetext': `Step ${v.stepNumber} of ${v.totalSteps}, ${v.percent}%` } : { 'aria-valuetext': 'In progress' })}
          className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-primary/15 ring-1 ring-inset ring-primary/10"
        >
          <div className={`h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400 shadow-[0_0_14px_rgba(59,130,246,0.45)] transition-[width] duration-700 ease-out ${v.percent === null ? `w-1/3 ${moving ? 'animate-pulse' : ''}` : ''}`} style={v.percent === null ? undefined : { width: `${Math.max(v.percent, 4)}%` }} />
        </div>
      )}

      {active && (
        <ol aria-label="Steps" className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-5">
          {v.steps.map((s) => (
            <li key={s.key} aria-current={s.status === 'current' ? 'step' : undefined} className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 ${s.status === 'current' ? 'border-primary/30 bg-primary/10 font-semibold text-foreground' : s.status === 'done' ? 'border-emerald-500/20 bg-emerald-500/5 text-muted-foreground' : 'border-border/60 bg-background/50 text-muted-foreground/70'}`}>
              <span className={`size-1.5 shrink-0 rounded-full ${s.status === 'current' ? 'animate-pulse bg-primary' : s.status === 'done' ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {v.message && !v.error && <p className="mt-1 break-words text-xs text-muted-foreground">{v.message}</p>}
      {v.counts.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{v.counts.join(' · ')}</p>}
      {v.stale && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">No progress for a while: processing may have stopped responding. The run is closed automatically if it has; you can then retry.</p>}
      {active && v.lastUpdateSeconds !== null && <p className="mt-0.5 text-xs text-muted-foreground">Last update {formatDuration(v.lastUpdateSeconds)} ago</p>}

      {v.error && (
        <div className="mt-1 space-y-2">
          <p className="break-words text-xs text-destructive">{v.error}</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retryDisabled}>
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}

