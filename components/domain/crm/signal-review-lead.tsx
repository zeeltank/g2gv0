'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { classifyPromoteFailure, LEAD_CONFIRM, leadIdFrom, NO_LEAD_ID_TEXT, promoteNotice, type SignalLead } from '@/lib/signal-review/lead-action'
import { BANNER_TONE } from '@/lib/signal-review/tones'
import { cn } from '@/lib/utils'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { SignalRow } from '@/services/signal-review/signal-types'

/** What the lead action says after it has run: a confirmation (a status message) or a refusal (an alert). */
export interface LeadFeedback {
  tone: 'done' | 'error'
  text: string
}

/**
 * Turning one signal into a CRM lead: asks first, sends the request once, and turns every way the server can answer into a message. A signal that
 * already has a lead is not an error (the server answers 200 with the same lead), so a second press and a press from two tabs both end well.
 * The drawer decides what to do with a lead id (update the row, reload the history); this only runs the request.
 */
export function useSignalLead({ service, signal, onPromoted }: {
  service: Pick<SignalReviewApi, 'promote'>
  signal: Pick<SignalRow, 'id'>
  /** The server named the lead. `created` is false when the signal already had it. */
  onPromoted: (leadId: string, created: boolean) => void
}) {
  const { confirm, confirmDialog } = useConfirm()
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [feedback, setFeedback] = useState<LeadFeedback | null>(null)

  // Refs, not state: they are read inside an async call that outlives the render it started in.
  const signalRef = useRef(signal)
  const promoted = useRef(onPromoted)
  useEffect(() => { signalRef.current = signal; promoted.current = onPromoted })
  // Set from the first press until the answer is in, so a press while the question is open or the request is running starts nothing.
  const busy = useRef(false)

  const request = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setFeedback(null)
    try {
      if (!(await confirm(LEAD_CONFIRM))) return
      setSaving(true)
      const result = await service.promote(signalRef.current.id)
      const leadId = leadIdFrom(result)
      if (!leadId) {
        setFeedback({ tone: 'error', text: NO_LEAD_ID_TEXT })
        return
      }
      const created = result.data.created === true
      promoted.current(leadId, created)
      setFeedback({ tone: 'done', text: promoteNotice(created) })
    } catch (cause) {
      const failure = classifyPromoteFailure(cause)
      if (failure.kind === 'forbidden') setForbidden(true)
      setFeedback({ tone: 'error', text: failure.message })
    } finally {
      busy.current = false
      setSaving(false)
    }
  }, [confirm, service])

  const clear = useCallback(() => setFeedback(null), [])

  return { request, saving, forbidden, feedback, clear, confirmDialog }
}

/** The lead action's message, under the drawer's buttons where the person just pressed. */
export function LeadFeedbackMessage({ feedback }: { feedback: LeadFeedback | null }) {
  if (!feedback) return null
  return feedback.tone === 'error'
    ? <p role="alert" className="w-full rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">{feedback.text}</p>
    : <p role="status" className={cn('w-full rounded-lg border p-2.5 text-sm', BANNER_TONE.success)}>{feedback.text}</p>
}

/**
 * "Turn into a lead", or, once the signal has a lead, "Lead created" with a link to it: the button is never offered again, so a lead cannot be made
 * twice from here.
 */
export function SignalLeadAction({ lead, saving, disabled, onRequest }: {
  lead: SignalLead | null
  saving: boolean
  disabled: boolean
  onRequest: () => void
}) {
  if (lead) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          Lead created
        </span>
        <NextLink href={lead.href} className="text-foreground underline underline-offset-2 hover:no-underline">Open lead{lead.number ? ` ${lead.number}` : ''}</NextLink>
        {lead.status && <span className="text-muted-foreground">· status: {lead.status}</span>}
      </div>
    )
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={saving || disabled} onClick={onRequest}>
      {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      {saving ? 'Creating lead…' : 'Turn into a lead'}
    </Button>
  )
}
