'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Clock, MinusCircle, XCircle } from 'lucide-react'

import type { LifecyclePayload, StageStatus } from '@/lib/intelligence/ai-lifecycle'
import { ArtifactChips } from './artifact-chips'
import { ReportCard } from './report-card'

const STATUS: Record<StageStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ran: { icon: CheckCircle2, className: 'text-emerald-600', label: 'Done' },
  skipped: { icon: MinusCircle, className: 'text-muted-foreground', label: 'Skipped' },
  blocked: { icon: XCircle, className: 'text-destructive', label: 'Blocked' },
  failed: { icon: AlertCircle, className: 'text-destructive', label: 'Failed' },
  pending: { icon: Clock, className: 'text-amber-600', label: 'Waiting' },
  not_reached: { icon: CircleDashed, className: 'text-muted-foreground', label: 'Not reached' },
}

/**
 * What stands behind an assistant answer: a generated report, what to do next, the evidence it
 * read, and the twelve stages it went through. Renders only what the server returned - it holds
 * no data of its own - and nothing at all for a message that has no lifecycle.
 */
export function LifecyclePanel({
  payload,
  onSend,
}: {
  payload: LifecyclePayload
  onSend: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { trace, evidence, recommendations, report, reportSuggestions, templateSuggestions } = payload

  return (
    <div className="mt-2 space-y-3 text-sm">
      {report ? <ReportCard report={report} /> : null}

      {evidence.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Evidence</p>
          <ul className="space-y-1">
            {evidence.map((item) => (
              <li key={item.id} className="rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs">
                <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{item.id}</span>
                {item.label}: {item.total}
                {item.truncated ? '+' : ''} record{item.total === 1 ? '' : 's'}
                {item.personal ? ' (counts only)' : ''}
                <span className="text-muted-foreground"> · read {new Date(item.as_of).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.filter((item) => item.kind !== 'report').length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">You could also ask</p>
          <div className="flex flex-wrap gap-1.5">
            {recommendations
              .filter((item) => item.kind !== 'report')
              .map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => onSend(item.prompt)}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium transition hover:border-primary hover:text-primary"
                >
                  {item.title}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      <ArtifactChips reports={reportSuggestions} templates={templateSuggestions} onSend={onSend} />

      {trace.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={open}
          >
            {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            How this was answered
          </button>
          {open ? (
            <ol className="mt-1.5 space-y-1">
              {trace.map((stage, index) => {
                const status = STATUS[stage.status] ?? STATUS.ran
                const Icon = status.icon

                return (
                  <li key={stage.key} className="flex items-start gap-2 text-xs">
                    <Icon className={`mt-0.5 size-3.5 shrink-0 ${status.className}`} aria-label={status.label} />
                    <span>
                      <span className="font-medium">
                        {index + 1}. {stage.label}
                      </span>
                      <span className="text-muted-foreground"> - {stage.summary}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
