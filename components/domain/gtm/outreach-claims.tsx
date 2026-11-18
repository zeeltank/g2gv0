'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { claimsHeading, classifyClaimsFailure, httpUrl, NO_CLAIMS_TEXT, readClaims, UNREADABLE_TEXT } from '@/lib/outreach/model'
import type { ClaimList, GateFailure } from '@/lib/outreach/types'
import { gateService, type GateApi } from '@/services/outreach/gate-service'

type Phase = { kind: 'loading' } | { kind: 'ready'; list: ClaimList } | { kind: 'failed'; failure: GateFailure }

/**
 * What IS approved, shown under a check that says a claim is not. READ-ONLY: it lists, it does not propose and it does not approve (the client cannot know
 * whether the person holds the Products right those two need, and the gate's claims are a safety control). It reads the approved claims of the product the
 * message is declared to be about, or all of them when the server does not say which product that is.
 */
export function OutreachClaims({ productId, api = gateService }: { productId: number | null; api?: GateApi }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const asked = useRef(0)

  const load = useCallback(async () => {
    const seq = ++asked.current
    try {
      const list = readClaims(await api.approvedClaims(productId))
      if (seq === asked.current) setPhase(list ? { kind: 'ready', list } : { kind: 'failed', failure: { kind: 'error', message: UNREADABLE_TEXT } })
    } catch (error) {
      if (seq === asked.current) setPhase({ kind: 'failed', failure: classifyClaimsFailure(error) })
    }
  }, [api, productId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const retry = () => { setPhase({ kind: 'loading' }); void load() }

  return (
    <section data-outreach-claims className="mt-3">
      <h4 className="mb-1 text-sm font-semibold text-foreground">{claimsHeading(productId)}</h4>
      {phase.kind === 'loading' && <p role="status" className="text-xs text-muted-foreground">Reading the approved claims…</p>}
      {phase.kind === 'failed' && (
        <div data-claims-failed>
          <p className="text-xs text-muted-foreground">{phase.failure.message}</p>
          {phase.failure.kind !== 'unavailable' && (
            <button type="button" onClick={retry} className="mt-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-muted">Retry</button>
          )}
        </div>
      )}
      {phase.kind === 'ready' && phase.list.claims.length === 0 && <p data-claims-empty className="text-xs text-muted-foreground">{NO_CLAIMS_TEXT}</p>}
      {phase.kind === 'ready' && phase.list.claims.length > 0 && (
        <>
          <ul className="space-y-1.5">
            {phase.list.claims.map((c) => {
              const link = httpUrl(c.sourceUrl)
              return (
                <li key={c.id} data-claim-id={c.id} className="rounded-md border border-border bg-card p-2 text-sm text-foreground">
                  <p className="break-words">{c.claim}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {productId === null && c.productName ? `${c.productName} · ` : ''}
                    {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-foreground underline">Source</a> : c.sourceUrl ? `Source: ${c.sourceUrl}` : 'No source recorded'}
                  </p>
                </li>
              )
            })}
          </ul>
          {phase.list.total > phase.list.claims.length && <p className="mt-1 text-xs text-muted-foreground">Showing {phase.list.claims.length} of {phase.list.total} approved claims.</p>}
        </>
      )}
      <p className="mt-1 text-xs text-muted-foreground">These are read-only here: a claim is proposed and approved by someone who holds the right to the Products screen.</p>
    </section>
  )
}
