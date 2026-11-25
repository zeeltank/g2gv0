'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { CheckCircle2, Loader2, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  accountIdFrom, ADD_TO_PROSPECTING, classifyFunnelFailure, convertNotice, IN_PROSPECTING, opportunityOf, OPEN_IN_PROSPECTING, prospectingNotice, prospectingOf,
  withOpportunity, withProspecting,
} from '@/lib/signals/funnel'
import { BANNER_TONE } from '@/lib/signals/tones'
import { cn } from '@/lib/utils'
import type { SignalFunnelApi } from '@/services/signal-review/signal-funnel-service'
import type { SignalConvertResponse } from '@/services/signal-review/signal-types'
import type { Opportunity } from '@/services/signals/opportunities'
import { ConvertSignalDialog } from './convert-signal-dialog'

/** What the funnel actions say after they have run: a confirmation (a status message) or a refusal (an alert), and the places it can take the person. */
export interface FunnelFeedback {
  tone: 'done' | 'error'
  text: string
  links?: Array<{ label: string; href: string }>
}

/**
 * The two funnel actions of a signal card beyond the lead (S20). "Add to Prospecting" is only the fallback for a company that is not in Prospecting (a signal goes in by
 * itself when it is saved); "Convert to opportunity" opens the pop-up that makes the organization, the optional person and the opportunity. Each answers once and is told
 * what happened; a repeat press is never an error (the server answers the same account or the same opportunity).
 */
export function useSignalFunnel({ signal, funnel, onChanged }: { signal: Opportunity; funnel: SignalFunnelApi; onChanged: (next: Opportunity) => void }) {
  const [adding, setAdding] = useState(false)
  const [converting, setConverting] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [feedback, setFeedback] = useState<FunnelFeedback | null>(null)

  const current = useRef(signal)
  const changed = useRef(onChanged)
  useEffect(() => { current.current = signal; changed.current = onChanged })
  const busy = useRef(false)

  const addToProspecting = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setFeedback(null)
    setAdding(true)
    try {
      const result = await funnel.sendToProspecting(current.current.id)
      const accountId = accountIdFrom(result)
      if (accountId === null) {
        setFeedback({ tone: 'error', text: 'The server did not say which account it made. Reload the page to see whether the company is in Prospecting.' })
        return
      }
      changed.current(withProspecting(current.current, accountId))
      setFeedback({ tone: 'done', text: prospectingNotice(result.data.created === true) })
    } catch (cause) {
      const failure = classifyFunnelFailure(cause)
      if (failure.kind === 'forbidden') setForbidden(true)
      setFeedback({ tone: 'error', text: failure.message })
    } finally {
      busy.current = false
      setAdding(false)
    }
  }, [funnel])

  const openConvert = useCallback(() => { setFeedback(null); setConverting(true) }, [])
  const closeConvert = useCallback(() => setConverting(false), [])

  const onConverted = useCallback((data: SignalConvertResponse['data']) => {
    const name = typeof data.opportunity_name === 'string' && data.opportunity_name !== '' ? data.opportunity_name : `Opportunity #${data.opportunity_id}`
    let next = withOpportunity(current.current, data.opportunity_id, name)
    if (typeof data.account_id === 'number' && data.account_id > 0) next = withProspecting(next, data.account_id)
    changed.current(next)
    const links = [{ label: 'Open opportunity', href: opportunityOf(next)?.href ?? '' }]
    const account = prospectingOf(next)
    if (account) links.push({ label: OPEN_IN_PROSPECTING, href: account.href })
    setFeedback({ tone: 'done', text: convertNotice(data.created === true), links: links.filter((l) => l.href !== '') })
  }, [])

  const clear = useCallback(() => setFeedback(null), [])

  return { adding, converting, forbidden, feedback, addToProspecting, openConvert, closeConvert, onConverted, clear, funnel }
}

export type SignalFunnelState = ReturnType<typeof useSignalFunnel>

/**
 * Where the signal's company is in Prospecting ("In Prospecting", with a link to open the account, or "Add to Prospecting" when it is not there) and the opportunity the
 * signal became ("Opportunity: <name>", a link) or the "Convert to opportunity" button.
 */
export function SignalFunnelActions({ funnel, signal, disabled }: { funnel: SignalFunnelState; signal: Opportunity; disabled: boolean }) {
  const account = prospectingOf(signal)
  const opportunity = opportunityOf(signal)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-funnel>
        {account ? (
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              {IN_PROSPECTING}
            </span>
            <NextLink href={account.href} className="text-foreground underline underline-offset-2 hover:no-underline">{OPEN_IN_PROSPECTING}</NextLink>
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={funnel.adding || funnel.forbidden || disabled} onClick={() => void funnel.addToProspecting()}>
            {funnel.adding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Target aria-hidden="true" />}
            {funnel.adding ? 'Adding…' : ADD_TO_PROSPECTING}
          </Button>
        )}
        {opportunity ? (
          <span className="inline-flex flex-wrap items-center gap-x-1">
            <span className="text-muted-foreground">Opportunity:</span>
            <NextLink href={opportunity.href} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{opportunity.name}</NextLink>
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={funnel.forbidden || disabled} onClick={funnel.openConvert}>
            <TrendingUp aria-hidden="true" />
            Convert to opportunity
          </Button>
        )}
      </div>
      <ConvertSignalDialog isOpen={funnel.converting} onClose={funnel.closeConvert} onConverted={funnel.onConverted} signal={signal} service={funnel.funnel} />
    </>
  )
}

/** What the last funnel action said, under the card's buttons, with the places it can take the person. */
export function FunnelFeedbackMessage({ feedback }: { feedback: FunnelFeedback | null }) {
  if (!feedback) return null
  const links = (feedback.links ?? []).map((l) => <NextLink key={l.label} href={l.href} className="ml-2 font-medium underline underline-offset-2 hover:no-underline">{l.label}</NextLink>)
  return feedback.tone === 'error'
    ? <p role="alert" className="w-full rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">{feedback.text}</p>
    : <p role="status" className={cn('w-full rounded-lg border p-2.5 text-sm', BANNER_TONE.success)}>{feedback.text}{links}</p>
}
