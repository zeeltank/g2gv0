'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { convertNotice, opportunityOf, withOpportunity } from '@/lib/signals/funnel'
import { BANNER_TONE } from '@/lib/signals/tones'
import { cn } from '@/lib/utils'
import type { SignalFunnelApi } from '@/services/signal-review/signal-funnel-service'
import type { SignalConvertResponse } from '@/services/signal-review/signal-types'
import type { Opportunity } from '@/services/signals/opportunities'
import { ConvertSignalDialog } from './convert-signal-dialog'

/** What "Convert to opportunity" says once it has run: a confirmation, and the place it can take the person. */
export interface FunnelFeedback {
  text: string
  links?: Array<{ label: string; href: string }>
}

/**
 * "Convert to opportunity" on a signal card (S20): opens the pop-up that makes the organization, the optional person and the opportunity, and tells the person what
 * happened. A repeat press is never an error (the server answers the same opportunity).
 */
export function useSignalFunnel({ signal, funnel, onChanged }: { signal: Opportunity; funnel: SignalFunnelApi; onChanged: (next: Opportunity) => void }) {
  const [converting, setConverting] = useState(false)
  const [feedback, setFeedback] = useState<FunnelFeedback | null>(null)

  const current = useRef(signal)
  const changed = useRef(onChanged)
  useEffect(() => { current.current = signal; changed.current = onChanged })

  const openConvert = useCallback(() => { setFeedback(null); setConverting(true) }, [])
  const closeConvert = useCallback(() => setConverting(false), [])

  const onConverted = useCallback((data: SignalConvertResponse['data']) => {
    const name = typeof data.opportunity_name === 'string' && data.opportunity_name !== '' ? data.opportunity_name : `Opportunity #${data.opportunity_id}`
    const next = withOpportunity(current.current, data.opportunity_id, name)
    changed.current(next)
    const href = opportunityOf(next)?.href
    setFeedback({ text: convertNotice(data.created === true), links: href ? [{ label: 'Open opportunity', href }] : [] })
  }, [])

  const clear = useCallback(() => setFeedback(null), [])

  return { converting, feedback, openConvert, closeConvert, onConverted, clear, funnel }
}

export type SignalFunnelState = ReturnType<typeof useSignalFunnel>

/** The opportunity the signal became ("Opportunity: <name>", a link) or the "Convert to opportunity" button. */
export function SignalFunnelActions({ funnel, signal, disabled }: { funnel: SignalFunnelState; signal: Opportunity; disabled: boolean }) {
  const opportunity = opportunityOf(signal)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-funnel>
        {opportunity ? (
          <span className="inline-flex flex-wrap items-center gap-x-1">
            <span className="text-muted-foreground">Opportunity:</span>
            <NextLink href={opportunity.href} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{opportunity.name}</NextLink>
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={funnel.openConvert}>
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
  return <p role="status" className={cn('w-full rounded-lg border p-2.5 text-sm', BANNER_TONE.success)}>{feedback.text}{links}</p>
}
