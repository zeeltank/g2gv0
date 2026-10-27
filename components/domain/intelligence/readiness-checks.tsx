'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReadinessMeasure, ReadinessState } from '@/types/intelligence'
import { ScreenLink } from './intelligence-shared'

const STATE: Record<ReadinessState, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive' }> = {
  ok: { label: 'Complete', variant: 'success' },
  attention: { label: 'Needs attention', variant: 'warning' },
  not_measurable: { label: 'Not measurable yet', variant: 'muted' },
  unavailable: { label: 'Could not be read', variant: 'destructive' },
}

function Check({ m }: { m: ReadinessMeasure }) {
  const s = STATE[m.state]
  const showBar = (m.state === 'ok' || m.state === 'attention') && m.percent !== null

  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0" data-readiness={m.key}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{m.label}</p>
        <Badge variant={s.variant}>{s.label}</Badge>
      </div>

      {showBar && (
        <div className="space-y-1">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={m.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={m.label}
          >
            <div
              className={cn('h-full rounded-full', m.state === 'ok' ? 'bg-success' : 'bg-warning')}
              style={{ width: `${m.percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {m.complete} of {m.total} ({m.percent}%)
          </p>
        </div>
      )}
      {m.state === 'not_measurable' && (
        <p className="text-xs text-muted-foreground">Nothing is recorded yet, so there is nothing to measure.</p>
      )}
      {m.state === 'unavailable' && (
        <p className="text-xs text-muted-foreground">
          This check could not be read right now. It is not counted as complete or incomplete.
        </p>
      )}

      <p className="text-xs text-muted-foreground">{m.explanation}</p>
      {m.state === 'attention' && (
        <ScreenLink to={m.link} variant="link" reason="This screen is not available to your organisation.">
          Go to the related screen
        </ScreenLink>
      )}
    </li>
  )
}

export function ReadinessChecks({ measures }: { measures: ReadinessMeasure[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data readiness</CardTitle>
        <p className="text-sm text-muted-foreground">
          How complete the records behind the findings are. A missing link shows up elsewhere as &ldquo;unmeasured&rdquo;,
          not as a problem, so it is easy to overlook.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {measures.map((m) => (
            <Check key={m.key} m={m} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
