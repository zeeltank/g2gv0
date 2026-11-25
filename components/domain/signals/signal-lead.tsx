'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { PersonChoice } from '@/components/domain/gtm/person-choice'
import { NO_PERSON_YET } from '@/lib/gtm/qualify-model'
import { prospectingOf } from '@/lib/signals/funnel'
import {
  classifyPromoteFailure, CONVERT_TO_LEAD, CONVERTING_LEAD, LEAD_CONFIRM, LEAD_PERSON_CONFIRM, leadIdFrom, NO_LEAD_ID_TEXT, promoteNotice, type SignalLead,
} from '@/lib/signals/lead-action'
import { BANNER_TONE } from '@/lib/signals/tones'
import { cn } from '@/lib/utils'
import { gtmService, type GtmContact } from '@/services/gtm/gtm'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { SignalRow } from '@/services/signal-review/signal-types'

/** What the lead action says after it has run: a confirmation (a status message) or a refusal (an alert). */
export interface LeadFeedback {
  tone: 'done' | 'error'
  text: string
}

/** The people at the company's Prospecting account, for the "which person" question. A server that refuses (no Prospecting right) answers none, and the lead is then converted as it always was. */
const loadPeopleOfAccount = async (accountId: number): Promise<GtmContact[]> => (await gtmService.getAccount(accountId)).data.contacts

/**
 * Converting one signal to a CRM lead: asks first, sends the request once, and turns every way the server can answer into a message. A signal that already has a lead is
 * not an error (the server answers 200 with the same lead), so a second press and a press from two tabs both end well. S20: when the signal's company has people in
 * Prospecting, the question is "which person" (or "No person yet", the lead named after the company); with none, it is the one-click confirmation it always was.
 * The drawer decides what to do with a lead id (update the row, reload the history); this only runs the request.
 */
export function useSignalLead({ service, signal, onPromoted, loadPeople = loadPeopleOfAccount }: {
  service: Pick<SignalReviewApi, 'promote'>
  signal: Pick<SignalRow, 'id'> & Pick<SignalRow, 'prospecting'>
  /** The server named the lead. `created` is false when the signal already had it. */
  onPromoted: (leadId: string, created: boolean) => void
  /** Reads the people of an account; a fake in a test. */
  loadPeople?: (accountId: number) => Promise<GtmContact[]>
}) {
  const { confirm, confirmDialog } = useConfirm()
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [feedback, setFeedback] = useState<LeadFeedback | null>(null)
  const [people, setPeople] = useState<GtmContact[] | null>(null)

  // Refs, not state: they are read inside an async call that outlives the render it started in.
  const signalRef = useRef(signal)
  const promoted = useRef(onPromoted)
  useEffect(() => { signalRef.current = signal; promoted.current = onPromoted })
  // Set from the first press until the answer is in, so a press while the question is open or the request is running starts nothing.
  const busy = useRef(false)

  /** Sends the request (with the person when one was chosen) and says what happened. Holds `busy` for its length. */
  const send = useCallback(async (contactId: number | null) => {
    setSaving(true)
    try {
      const result = contactId ? await service.promote(signalRef.current.id, { contactId }) : await service.promote(signalRef.current.id)
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
      setSaving(false)
    }
  }, [service])

  const request = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setFeedback(null)
    try {
      const account = prospectingOf(signalRef.current)
      if (account && account.contactsCount > 0) {
        let list: GtmContact[] = []
        try { list = await loadPeople(account.accountId) } catch { list = [] }
        if (list.length > 0) {
          setPeople(list)
          return
        }
      }
      if (!(await confirm(LEAD_CONFIRM))) return
      await send(null)
    } finally {
      busy.current = false
    }
  }, [confirm, send, loadPeople])

  /** The person question was answered: a person's id, or null for "No person yet". */
  const choose = useCallback(async (contactId: number | null) => {
    if (busy.current) return
    busy.current = true
    setPeople(null)
    setFeedback(null)
    try {
      await send(contactId)
    } finally {
      busy.current = false
    }
  }, [send])

  const clear = useCallback(() => setFeedback(null), [])

  const personDialog = people && (
    <LeadPersonDialog people={people} onChoose={(id) => void choose(id)} onCancel={() => setPeople(null)} />
  )

  return { request, saving, forbidden, feedback, clear, confirmDialog, personDialog }
}

/** The question when the company has people in Prospecting: which one the lead is for, or none yet. Nobody who asked not to be contacted can be chosen. */
export function LeadPersonDialog({ people, onChoose, onCancel }: { people: GtmContact[]; onChoose: (contactId: number | null) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const none = 'none'
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{LEAD_PERSON_CONFIRM.title}</DialogTitle>
          <DialogDescription>{LEAD_PERSON_CONFIRM.description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <PersonChoice contacts={people} value={value} onChange={setValue} name="lead-person" extra={{ value: none, label: NO_PERSON_YET }} />
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={value === ''} onClick={() => onChoose(value === none ? null : Number(value))}>{LEAD_PERSON_CONFIRM.confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The lead action's message, under the drawer's buttons where the person just pressed. */
export function LeadFeedbackMessage({ feedback }: { feedback: LeadFeedback | null }) {
  if (!feedback) return null
  return feedback.tone === 'error'
    ? <p role="alert" className="w-full rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-sm">{feedback.text}</p>
    : <p role="status" className={cn('w-full rounded-lg border p-2.5 text-sm', BANNER_TONE.success)}>{feedback.text}</p>
}

/**
 * "Convert to lead", or, once the signal has a lead, "Lead created" with a link to it: the button is never offered again, so a lead cannot be made
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
      {saving ? CONVERTING_LEAD : CONVERT_TO_LEAD}
    </Button>
  )
}
