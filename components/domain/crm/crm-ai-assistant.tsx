'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, Sparkles, Copy, CheckCheck, AlertCircle, TrendingUp, Mail, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { crmService } from '@/services/crm'
import type { LaravelContext } from '@/lib/laravel-context'
import type { ProspectingResult, OutreachDraft, DealCoachResult } from '@/types/crm'

function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5 items-end h-4">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  )
}

interface Props {
  entityType: 'lead' | 'contact' | 'opportunity'
  entityId: string
  entityData: Record<string, unknown>
  context: LaravelContext
  onClose?: () => void
}

type CardState<T> = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: T } | { status: 'error'; message: string }

function riskColor(level: string) {
  if (level === 'low') return 'text-green-600 dark:text-green-400'
  if (level === 'high') return 'text-red-600 dark:text-red-400'
  return 'text-yellow-600 dark:text-yellow-400'
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? 'bg-green-500' : value >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  )
}

const POLL_INTERVAL = 3000
const POLL_TIMEOUT = 60000

export function CrmAiAssistant({ entityType, entityId, entityData, context, onClose }: Props) {
  const [prospecting, setProspecting] = useState<CardState<ProspectingResult>>({ status: 'idle' })
  const [outreach, setOutreach] = useState<CardState<OutreachDraft>>({ status: 'idle' })
  const [dealCoach, setDealCoach] = useState<CardState<DealCoachResult>>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollRun = useCallback(async <T,>(
    runId: string,
    setter: (s: CardState<T>) => void,
    extractResult: (run: import('@/types/crm').AgentRun) => T | null,
    errorMsg: string,
  ) => {
    const start = Date.now()
    const tick = async () => {
      if (Date.now() - start > POLL_TIMEOUT) {
        setter({ status: 'error', message: 'AI timed out. Please retry.' })
        return
      }
      try {
        const res = await crmService.getAgentRun(context, runId)
        const run = res.status === 1 ? res.data.run : null
        if (!run || run.status === 'running') {
          timerRef.current = setTimeout(tick, POLL_INTERVAL)
          return
        }
        if (run.status === 'completed') {
          const result = extractResult(run)
          if (result) {
            setter({ status: 'done', result })
          } else {
            setter({ status: 'error', message: errorMsg })
          }
        } else {
          setter({ status: 'error', message: errorMsg })
        }
      } catch {
        setter({ status: 'error', message: 'Network error.' })
      }
    }
    timerRef.current = setTimeout(tick, POLL_INTERVAL)
  }, [context])

  async function handleProspecting() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setProspecting({ status: 'loading' })
    try {
      const orgId = entityData.convertedOrganizationId as string | undefined
      const company = entityData.company as string | undefined
      const res = await crmService.runProspecting(context, { organizationId: orgId, companyName: company })
      if (res.status === 1) {
        const d = res.data as (ProspectingResult & { runId?: string }) | null
        if (d?.runId) {
          await pollRun<ProspectingResult>(d.runId, setProspecting, run => run.result as ProspectingResult | null, 'Research failed.')
        } else {
          setProspecting({ status: 'done', result: d as ProspectingResult })
        }
      } else {
        setProspecting({ status: 'error', message: 'Research failed.' })
      }
    } catch {
      setProspecting({ status: 'error', message: 'Network error.' })
    }
  }

  async function handleOutreach() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOutreach({ status: 'loading' })
    try {
      const payload = entityType === 'lead'
        ? { leadId: entityId }
        : { contactId: entityId }
      const res = await crmService.runOutreach(context, payload)
      if (res.status === 1) {
        const d = res.data as (OutreachDraft & { runId?: string }) | null
        if (d?.runId) {
          await pollRun<OutreachDraft>(d.runId, setOutreach, run => run.result as OutreachDraft | null, 'Draft failed.')
        } else {
          setOutreach({ status: 'done', result: d as OutreachDraft })
        }
      } else {
        setOutreach({ status: 'error', message: 'Draft failed.' })
      }
    } catch {
      setOutreach({ status: 'error', message: 'Network error.' })
    }
  }

  async function handleDealCoach() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDealCoach({ status: 'loading' })
    try {
      const res = await crmService.runDealCoach(context, { opportunityId: entityId })
      if (res.status === 1) {
        const d = res.data as (DealCoachResult & { runId?: string }) | null
        if (d?.runId) {
          await pollRun<DealCoachResult>(d.runId, setDealCoach, run => run.result as DealCoachResult | null, 'Coaching failed.')
        } else {
          setDealCoach({ status: 'done', result: d as DealCoachResult })
        }
      } else {
        setDealCoach({ status: 'error', message: 'Coaching failed.' })
      }
    } catch {
      setDealCoach({ status: 'error', message: 'Network error.' })
    }
  }

  async function copyDraft() {
    if (outreach.status !== 'done') return
    await navigator.clipboard.writeText(`Subject: ${outreach.result.subject}\n\n${outreach.result.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <span className="font-semibold text-sm">AI Assistant</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">×</Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Prospecting card — show for lead/contact */}
        {entityType !== 'opportunity' && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-500" />
              <span className="font-medium text-sm">Account Research</span>
            </div>

            {prospecting.status === 'idle' && (
              <Button size="sm" variant="outline" onClick={handleProspecting} className="w-full">
                Research this account
              </Button>
            )}
            {prospecting.status === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> AI is thinking… <ThinkingDots />
              </div>
            )}
            {prospecting.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4" /> {prospecting.message}
                <Button size="sm" variant="ghost" onClick={handleProspecting}>Retry</Button>
              </div>
            )}
            {prospecting.status === 'done' && (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ICP Fit</p>
                  <ScoreBar value={prospecting.result.icpFitScore} />
                </div>
                <p className="text-xs text-muted-foreground">{prospecting.result.icpFitReason}</p>
                <div className="rounded bg-muted px-3 py-2 text-xs font-medium">
                  💡 {prospecting.result.recommendation}
                </div>
                <Button size="sm" variant="ghost" onClick={handleProspecting} className="text-xs h-7">
                  Re-run
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Outreach draft card */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-green-500" />
            <span className="font-medium text-sm">Draft Outreach</span>
          </div>

          {outreach.status === 'idle' && (
            <Button size="sm" variant="outline" onClick={handleOutreach} className="w-full">
              Draft outreach email
            </Button>
          )}
          {outreach.status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> AI is thinking… <ThinkingDots />
            </div>
          )}
          {outreach.status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {outreach.message}
              <Button size="sm" variant="ghost" onClick={handleOutreach}>Retry</Button>
            </div>
          )}
          {outreach.status === 'done' && (
            <div className="space-y-2">
              <div className="rounded bg-muted p-3 text-xs space-y-1">
                <p className="font-medium">Subject: {outreach.result.subject}</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{outreach.result.body}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyDraft} className="h-7 text-xs gap-1">
                  {copied ? <><CheckCheck className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleOutreach} className="h-7 text-xs">Re-draft</Button>
              </div>
            </div>
          )}
        </div>

        {/* Deal Coach card — show for opportunity */}
        {entityType === 'opportunity' && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-yellow-500" />
              <span className="font-medium text-sm">Deal Coach</span>
            </div>

            {dealCoach.status === 'idle' && (
              <Button size="sm" variant="outline" onClick={handleDealCoach} className="w-full">
                Get coaching
              </Button>
            )}
            {dealCoach.status === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> AI is thinking… <ThinkingDots />
              </div>
            )}
            {dealCoach.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="size-4" /> {dealCoach.message}
                <Button size="sm" variant="ghost" onClick={handleDealCoach}>Retry</Button>
              </div>
            )}
            {dealCoach.status === 'done' && (
              <div className="space-y-2">
                <div className="rounded bg-muted px-3 py-2 text-xs">
                  <p className="font-medium">{dealCoach.result.nextBestAction}</p>
                  <p className="text-muted-foreground mt-1">{dealCoach.result.reason}</p>
                </div>
                <p className={cn('text-xs font-medium', riskColor(dealCoach.result.riskLevel))}>
                  Risk: {dealCoach.result.riskLevel}
                </p>
                <ul className="space-y-1">
                  {dealCoach.result.suggestions.map((s, i) => (
                    <li key={i} className="text-xs flex gap-1.5">
                      <span className="mt-0.5 size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="ghost" onClick={handleDealCoach} className="text-xs h-7">Re-run</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
