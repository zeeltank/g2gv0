'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { consentRows, consentSourceText, consentSummary, entityLabel, loadFailure, type LoadFailureKind } from '@/lib/facts/model'
import { CHIP_BASE, NOTICE_LOOK, PILL_TONE } from '@/lib/facts/tones'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { FactsApi } from '@/services/facts/api-types'
import { factsService } from '@/services/facts/facts-service'
import type { ConsentData, FactEntityType } from '@/services/facts/types'
import { useLatestRead } from './fact-latest'

type Phase = 'loading' | 'ready' | 'error' | LoadFailureKind

/**
 * The consent line of one contact, organisation or lead: for each channel (email, SMS, WhatsApp) whether it may be used, in a word, and why not, read
 * through the one consent gate every sender must pass. Read-only: nothing is sent from here and nothing here changes a person's consent. A channel the
 * server did not report is left out, never assumed allowed.
 */
export function ConsentLine({ entityType, entityId, service = factsService, className }: {
  entityType: FactEntityType
  entityId: number | string
  /** For tests and for a page that already has one. */
  service?: FactsApi
  className?: string
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const titleId = useId()
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<ConsentData | null>(null)
  // Only the newest read may change what is shown (another record may have been opened meanwhile).
  const latest = useLatestRead()

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setPhase('error')
      return
    }
    const mine = latest.begin()
    setPhase('loading')
    setData(null)
    try {
      const response = await service.consent(entityType, entityId)
      if (!latest.isCurrent(mine)) return
      setData(response.data)
      setPhase('ready')
    } catch (cause) {
      if (!latest.isCurrent(mine)) return
      const problem = loadFailure(cause, 'The consent information could not be loaded.', 'consent information')
      setError(problem.message)
      setPhase(problem.kind)
    }
  }, [context, service, entityType, entityId, latest])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const frame = 'rounded-lg border border-border bg-card'
  const heading = <h3 id={titleId} className="text-sm font-semibold text-foreground">Consent</h3>

  if (phase === 'loading') {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn(frame, 'space-y-2 p-4', className)} data-section="Consent">
        {heading}
        <p role="status" className="text-sm text-muted-foreground">Checking consent…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'notFound' || phase === 'unavailable') {
    return (
      <section aria-labelledby={titleId} className={cn(frame, 'space-y-2 p-4', className)} data-section="Consent" data-consent-state={phase}>
        {heading}
        <p className="text-sm text-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <section aria-labelledby={titleId} className={cn(frame, 'space-y-2 p-4', className)} data-section="Consent" data-consent-state="error">
        {heading}
        <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', NOTICE_LOOK.error)}>
          <span><strong>Consent could not be loaded.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { void load() }}><RefreshCw aria-hidden /> Retry</Button>
        </div>
      </section>
    )
  }

  const rows = consentRows(data)
  const sources = data.sources ?? []
  return (
    <section aria-labelledby={titleId} className={cn(frame, 'space-y-3 p-4', className)} data-section="Consent" data-consent-state="ready">
      <div className="space-y-1">
        {heading}
        <p className="text-sm text-foreground" data-consent-summary>{rows.length > 0 ? consentSummary(rows) : `No channel was reported for this ${entityLabel(entityType).toLowerCase()}.`}</p>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-1.5" aria-label="Channels">
          {rows.map((row) => (
            <li key={row.key} data-channel={row.key} data-allowed={row.allowed ? 'true' : 'false'} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className={cn(CHIP_BASE, row.allowed ? PILL_TONE.positive : PILL_TONE.caution)}>{row.word}</span>
              {row.reason && <span className="min-w-0 break-words text-muted-foreground">{row.reason}</span>}
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Read from</h4>
          <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Where this was read from">
            {sources.map((source, index) => <li key={`${source.source}-${index}`} className="break-words">{consentSourceText(source)}</li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">This is the check every sender must pass. Nothing is sent from this screen, and nothing here changes anyone&apos;s consent.</p>
    </section>
  )
}
