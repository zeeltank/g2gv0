'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { signalsService, type Signal, type SignalStatusResponse } from '@/services/signals'

function errMsg(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}

const PRIORITY_VARIANT: Record<Signal['priority'], 'destructive' | 'warning' | 'muted'> = {
  High: 'destructive',
  Medium: 'warning',
  Low: 'muted',
}

const STATUS_VARIANT: Record<Signal['status'], 'default' | 'success' | 'muted'> = {
  New: 'default',
  Reviewed: 'success',
  Dismissed: 'muted',
}

/**
 * The real per-department AI Signals feed (organisational/HR insight - staffing gaps, policy
 * and process health - generated daily from this department's own aggregate counts). Distinct
 * from the org-wide Company Opportunity Intelligence hub, which lives under Sales & Marketing ->
 * Signals now (see Docs/sales-marketing-merge/DECISIONS.md, Phase 5). `signalsService` already
 * supported a `departmentId` filter end to end; this is its first caller anywhere in the app.
 */
export function DepartmentSignalsPanel({
  department,
  context,
}: {
  department: Department
  context: LaravelContext
}) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [status, setStatus] = useState<SignalStatusResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Signal | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, statusResp] = await Promise.all([
        signalsService.list(context, { departmentId: department.id, perPage: 50 }),
        signalsService.getStatus(context),
      ])
      setSignals(list.data)
      setStatus(statusResp.data)
    } catch (cause) {
      setError(errMsg(cause, 'Failed to load signals for this department.'))
    } finally {
      setLoading(false)
    }
  }, [context, department.id])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      await signalsService.generate(context)
      await load()
    } catch (cause) {
      setError(errMsg(cause, 'Failed to start signal generation.'))
    } finally {
      setGenerating(false)
    }
  }

  async function act(signal: Signal, action: 'review' | 'dismiss') {
    setActingId(signal.id)
    setError('')
    try {
      await (action === 'review' ? signalsService.review(context, signal.id) : signalsService.dismiss(context, signal.id))
      setDetail(null)
      await load()
    } catch (cause) {
      setError(errMsg(cause, `Failed to ${action === 'review' ? 'mark signal as reviewed' : 'dismiss signal'}.`))
    } finally {
      setActingId(null)
    }
  }

  async function openDetail(signal: Signal) {
    setError('')
    try {
      const resp = await signalsService.get(context, signal.id)
      setDetail(resp.data)
    } catch (cause) {
      setError(errMsg(cause, 'Failed to load signal detail.'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error && signals.length === 0 && !status) {
    return <ErrorState title="Couldn't load signals" description={error} retry={() => void load()} />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {status?.ai_configured ? (
              <span>
                {status.schedule.enabled
                  ? `Runs daily at ${status.schedule.time} (${status.schedule.timezone}).`
                  : 'Scheduled daily run is off.'}{' '}
                {status.last_generated_at && `Last generated ${new Date(status.last_generated_at).toLocaleString()}.`}
              </span>
            ) : (
              <span>AI provider not configured for Signals yet - generation will fail until an administrator sets one up.</span>
            )}
          </div>
          <Button size="sm" variant="outline" disabled={generating || Boolean(status?.running)} onClick={() => void handleGenerate()}>
            {generating || status?.running ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Running...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 size-3.5" /> Generate now (org-wide)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {signals.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-8" />}
          title="No signals for this department yet"
          description="AI Signals analyses this department's staffing, policy and process data on its daily schedule. Check back after the next run, or generate one now."
        />
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <Card
              key={signal.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => void openDetail(signal)}
            >
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={PRIORITY_VARIANT[signal.priority]}>{signal.priority}</Badge>
                    <span className="text-xs text-muted-foreground">{signal.signal_type_label}</span>
                    <Badge variant={STATUS_VARIANT[signal.status]}>{signal.status}</Badge>
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{signal.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{signal.summary}</p>
                </div>
                {signal.status === 'New' && (
                  <div className="flex shrink-0 gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" variant="outline" disabled={actingId === signal.id} onClick={() => void act(signal, 'review')}>
                      <CheckCircle2 className="mr-1 size-3.5" /> Review
                    </Button>
                    <Button size="sm" variant="ghost" disabled={actingId === signal.id} onClick={() => void act(signal, 'dismiss')}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[detail.priority]}>{detail.priority}</Badge>
                  {detail.title}
                </DialogTitle>
                <DialogDescription>
                  {detail.signal_type_label} &middot; generated {new Date(detail.generated_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-foreground">{detail.explanation ?? detail.summary}</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</p>
                  <p className="text-foreground">{detail.why_it_matters}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended action</p>
                  <p className="text-foreground">{detail.recommended_action}</p>
                </div>
                {detail.evidence && detail.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-foreground">
                      {detail.evidence.map((item, index) => (
                        <li key={index}>
                          {item.metric}: {item.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {detail.status === 'New' && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" disabled={actingId === detail.id} onClick={() => void act(detail, 'dismiss')}>
                    Dismiss
                  </Button>
                  <Button disabled={actingId === detail.id} onClick={() => void act(detail, 'review')}>
                    Mark reviewed
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
