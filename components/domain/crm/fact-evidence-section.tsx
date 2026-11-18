'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptNotice, cappedText, countsText, entityLabel, groupFacts, loadFailure, NO_DECIDE_TEXT, wroteRecord, type LoadFailureKind } from '@/lib/facts/model'
import { NOTICE_LOOK } from '@/lib/facts/tones'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { FactsApi } from '@/services/facts/api-types'
import { factsService } from '@/services/facts/facts-service'
import type { Fact, FactEntityType, FactsEntityData } from '@/services/facts/types'
import { useFactDecisions } from './fact-decisions'
import { useLatestRead } from './fact-latest'
import { FactCard, FactNotice } from './fact-parts'

type Phase = 'loading' | 'ready' | 'error' | LoadFailureKind

export interface FactEvidenceSectionProps {
  entityType: FactEntityType
  entityId: number | string
  /** For tests and for a page that already has one. */
  service?: FactsApi
  /**
   * An accepted fact wrote the record's own field (its email, its website): the page that shows that field must show the new value, or editing the record
   * would start from the old one. A page that cannot do that leaves this out, and the message then asks for a reload.
   */
  onWroteRecord?: (fact: Fact) => void
  className?: string
}

/**
 * The Evidence section of one contact, organisation or lead: every fact an agent or a source suggested about the record, with the evidence it rests on, in
 * the order a person works (what waits, then what was accepted, dismissed and replaced). A person who may edit the record accepts or dismisses what waits;
 * accepting writes the record's own field only when it is blank, so what someone typed is never replaced. It fetches its own data and never sends anything.
 *
 * MOUNT it with the record: `<FactEvidenceSection entityType="contact" entityId={contact.id} onWroteRecord={showNewValue} />`. It needs no other prop.
 */
export function FactEvidenceSection({ entityType, entityId, service = factsService, onWroteRecord, className }: FactEvidenceSectionProps) {
  const context = useMemo(() => getLaravelContext(), [])
  const titleId = useId()
  const scopeKey = `${entityType}:${entityId}`

  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<FactsEntityData | null>(null)
  // Only the newest read may change what is shown: switching to another record while the first is still loading must not let its answer replace it.
  const latest = useLatestRead()

  /** `quiet` reads again behind the section, without the "Opening…" state, and never throws. */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setPhase('error')
      return false
    }
    const mine = latest.begin()
    if (!quiet) { setPhase('loading'); setData(null) }
    try {
      const response = await service.entity(entityType, entityId)
      if (!latest.isCurrent(mine)) return false
      setData(response.data)
      setPhase('ready')
      return true
    } catch (cause) {
      if (!latest.isCurrent(mine) || quiet) return false
      const problem = loadFailure(cause, 'The evidence could not be loaded.', 'the evidence')
      setError(problem.message)
      setPhase(problem.kind)
      return false
    }
  }, [context, service, entityType, entityId, latest])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const reload = useCallback(() => load(true), [load])

  // A page that cannot show the new value itself is told so, in the message that follows an accepted fact.
  const acceptText = useCallback((fact: Fact) => `${acceptNotice(fact)}${wroteRecord(fact) && !onWroteRecord ? ' Reload the page to see it in the details above.' : ''}`, [onWroteRecord])
  const decisions = useFactDecisions({ service, scopeKey, reload, onWroteRecord, acceptText })

  const frame = 'rounded-lg border border-border bg-card'
  const noun = entityLabel(entityType).toLowerCase()

  const header = (extra?: string) => (
    <header className="space-y-1 border-b border-border px-4 py-3">
      <h3 id={titleId} className="text-sm font-semibold text-foreground">Evidence</h3>
      <p className="text-xs text-muted-foreground">
        What an agent or a source found about this {noun}, and the evidence for each fact. Nothing changes the record until you accept it, and accepting never
        replaces a value someone typed.
      </p>
      {extra && <p className="text-xs text-muted-foreground" data-counts>{extra}</p>}
    </header>
  )

  if (phase === 'loading') {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn(frame, className)} data-section="Evidence">
        {header()}
        <p role="status" className="px-4 py-3 text-sm text-muted-foreground">Opening the evidence…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'notFound' || phase === 'unavailable') {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)} data-section="Evidence" data-evidence-state={phase}>
        {header()}
        <p className="px-4 py-3 text-sm text-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)} data-section="Evidence" data-evidence-state="error">
        {header()}
        <div className="p-4">
          <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', NOTICE_LOOK.error)}>
            <span><strong>The evidence could not be loaded.</strong> {error}</span>
            <Button size="sm" variant="outline" onClick={() => { void load() }}><RefreshCw aria-hidden /> Retry</Button>
          </div>
        </div>
      </section>
    )
  }

  const groups = groupFacts(data.facts)
  const capped = cappedText(data.counts, data.facts)
  const anyBusy = decisions.busy !== null
  const busyFor = (id: number): 'accept' | 'dismiss' | null => (decisions.busy && decisions.busy.id === id ? decisions.busy.kind : null)
  const waiting = data.facts.filter((fact) => fact.status === 'proposed')
  const mayDecideSome = waiting.some((fact) => decisions.canDecide(fact, data.can))

  return (
    <section aria-labelledby={titleId} aria-busy={anyBusy} className={cn(frame, className)} data-section="Evidence" data-evidence-state="ready">
      {header(countsText(data.counts))}
      <div className="space-y-4 p-4">
        <p className="sr-only" role="status" aria-live="polite">{anyBusy ? 'Working…' : ''}</p>

        {decisions.notice && <FactNotice register={decisions.noticeRef} notice={decisions.notice} onDismiss={() => decisions.setNotice(null)} />}

        {waiting.length > 0 && !mayDecideSome && <p className="text-sm text-foreground" data-view-only>{NO_DECIDE_TEXT}</p>}

        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground" data-empty>
            No facts have been suggested for this {noun} yet. When an agent or a source finds an email address, a phone number or a website, it appears here with its evidence.
          </p>
        ) : groups.map((group) => (
          <div key={group.key} data-group={group.key} className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">{group.title} ({group.facts.length})</h4>
            <ul className="space-y-2" aria-label={group.title}>
              {group.facts.map((fact) => (
                <FactCard
                  key={fact.id} fact={fact} canDecide={decisions.canDecide(fact, data.can)} viewOnlyNote={mayDecideSome && !decisions.canDecide(fact, data.can)}
                  busy={busyFor(fact.id)} anyBusy={anyBusy} dismissing={decisions.dismissing === fact.id} reason={decisions.reason} onReason={decisions.setReason}
                  onAccept={(f) => { void decisions.accept(f) }} onOpenDismiss={decisions.openDismiss} onCancelDismiss={decisions.cancelDismiss}
                  onConfirmDismiss={(f) => { void decisions.confirmDismiss(f) }}
                />
              ))}
            </ul>
          </div>
        ))}

        {capped && <p className="text-xs text-muted-foreground" data-capped>{capped}</p>}
      </div>
    </section>
  )
}
