'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { entityPath, lastPage, loadFailure, NO_DECIDE_TEXT, queueParams, rangeText, type LoadFailureKind, type TypeFilter, TYPE_FILTERS } from '@/lib/facts/model'
import { NOTICE_LOOK } from '@/lib/facts/tones'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import type { FactsApi } from '@/services/facts/api-types'
import { factsService } from '@/services/facts/facts-service'
import type { FactsQueueData } from '@/services/facts/types'
import { useFactDecisions } from './fact-decisions'
import { useLatestRead } from './fact-latest'
import { FactCard, FactNotice } from './fact-parts'
import { Facet } from './org-account-parts'

type Phase = 'loading' | 'ready' | 'error' | LoadFailureKind

export interface FactSuggestionsProps {
  /** For tests and for a page that already has one. */
  service?: FactsApi
  /** Something was decided (or refused): the switch that shows how many are waiting reads its count again. */
  onChanged?: () => void
  className?: string
}

/**
 * The Suggestions scope of the Contacts screen: the facts an agent or a source suggested about the organisation's contacts, organisations and leads, newest
 * first, each with its evidence, waiting for a person to accept or dismiss. Nothing changes until a person accepts, and accepting writes the record's own
 * field only when it is blank. Reading follows the view right of each kind of record; deciding follows the edit right, and a person who may only read sees
 * the suggestions without the buttons.
 */
export function FactSuggestions({ service = factsService, onChanged, className }: FactSuggestionsProps) {
  const context = useMemo(() => getLaravelContext(), [])
  const { resolveAccessLink } = useSidebarNavigation()
  const titleId = useId()

  const [type, setType] = useState<TypeFilter>('')
  const [page, setPage] = useState(1)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState<FactsQueueData | null>(null)
  // A new page or kind is being read while the list that is on screen stays: the filter must not vanish under the person's hands (their focus would be lost).
  const [refreshing, setRefreshing] = useState(false)
  // Only the newest read may change what is shown: a slow answer for the page or filter the person has left must not replace the one they are on.
  const latest = useLatestRead()

  /** `quiet` reads again behind the list, without the "Opening…" state, and never throws. It answers whether it worked. */
  const load = useCallback(async (quiet = false): Promise<boolean> => {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setPhase('error')
      return false
    }
    const mine = latest.begin()
    // A read the person asked for (opening, another page or kind, Retry). The list on screen, if there is one, stays while it is under way.
    if (!quiet) setRefreshing(true)
    try {
      const response = await service.queue(queueParams(type, page))
      if (!latest.isCurrent(mine)) return false
      // The page the person was on has emptied (its last suggestion was decided): step back to the last one that has rows.
      if (response.data.rows.length === 0 && page > 1 && response.data.pagination.total > 0) {
        setPage(lastPage(response.data.pagination))
        return true
      }
      setData(response.data)
      setPhase('ready')
      setRefreshing(false)
      return true
    } catch (cause) {
      if (!latest.isCurrent(mine) || quiet) return false
      const problem = loadFailure(cause, 'The suggestions could not be loaded.', 'suggestions')
      setData(null)
      setRefreshing(false)
      setError(problem.message)
      setPhase(problem.kind)
      return false
    }
  }, [context, service, type, page, latest])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const reload = useCallback(async () => {
    const ok = await load(true)
    onChanged?.()
    return ok
  }, [load, onChanged])

  const decisions = useFactDecisions({ service, scopeKey: 'queue', reload })

  const frame = 'space-y-4'

  const heading = (
    <div className="space-y-1">
      <h2 id={titleId} className="text-base font-semibold text-foreground">Suggestions</h2>
      <p className="text-sm text-muted-foreground">
        Facts an agent or a source found about your contacts, organisations and leads, each with the evidence it rests on. Nothing changes until you accept it, and
        accepting never replaces a value someone typed.
      </p>
    </div>
  )

  // Nothing to show yet: the first read, or a Retry after an error.
  if (data === null && (phase === 'loading' || refreshing)) {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn(frame, className)}>
        {heading}
        <p role="status" className="text-sm text-muted-foreground">Opening the suggestions…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'notFound' || phase === 'unavailable') {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)} data-queue-state={phase}>
        {heading}
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <section aria-labelledby={titleId} className={cn(frame, className)} data-queue-state="error">
        {heading}
        <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', NOTICE_LOOK.error)}>
          <span><strong>The suggestions could not be loaded.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { void load() }}><RefreshCw aria-hidden /> Retry</Button>
        </div>
      </section>
    )
  }

  const rows = data.rows
  const total = data.pagination.total
  const pages = lastPage(data.pagination)
  const range = rangeText(data.pagination, rows.length)
  // While a decision is in flight, or another page or kind is being read, nothing can be decided or paged: the rows on screen may be about to change.
  const anyBusy = decisions.busy !== null || refreshing
  const busyFor = (id: number): 'accept' | 'dismiss' | null => (decisions.busy && decisions.busy.id === id ? decisions.busy.kind : null)
  const mayDecideSome = rows.some((fact) => decisions.canDecide(fact, data.can))

  return (
    <section aria-labelledby={titleId} aria-busy={anyBusy} className={cn(frame, className)} data-queue-state="ready">
      {heading}

      <p className="sr-only" role="status" aria-live="polite">{decisions.busy ? 'Working…' : refreshing ? 'Loading the list…' : ''}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Facet label="Show" value={type} choices={TYPE_FILTERS} onChange={(value) => { setPage(1); setType(value as TypeFilter) }} />
        <p className="pb-2 text-sm text-muted-foreground" data-total>
          {total === 0 ? 'Nothing is waiting' : `${total} waiting for you`}
        </p>
      </div>

      {decisions.notice && <FactNotice register={decisions.noticeRef} notice={decisions.notice} onDismiss={() => decisions.setNotice(null)} />}

      {rows.length > 0 && !mayDecideSome && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground" data-view-only>{NO_DECIDE_TEXT}</p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-empty>
          {type === ''
            ? 'Nothing is waiting for you. When an agent or a source suggests an email address, a phone number or a website, it appears here with its evidence.'
            : 'Nothing is waiting for you in this kind of record.'}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Suggestions waiting for you">
          {rows.map((fact) => (
            <FactCard
              key={fact.id} fact={fact} showRecord recordHref={entityPath(fact.entity_type, fact.entity_id, resolveAccessLink)} canDecide={decisions.canDecide(fact, data.can)}
              viewOnlyNote={mayDecideSome && !decisions.canDecide(fact, data.can)} busy={busyFor(fact.id)} anyBusy={anyBusy} dismissing={decisions.dismissing === fact.id} reason={decisions.reason} onReason={decisions.setReason}
              onAccept={(f) => { void decisions.accept(f) }} onOpenDismiss={decisions.openDismiss} onCancelDismiss={decisions.cancelDismiss}
              onConfirmDismiss={(f) => { void decisions.confirmDismiss(f) }}
            />
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{range ?? ''}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || anyBusy} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages || anyBusy} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  )
}
