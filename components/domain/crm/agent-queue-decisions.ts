'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { returnFocusTo } from '@/lib/agent/focus'
import { acceptNotice, dismissNotice, type Notice } from '@/lib/agent/model'
import { decisionFailureText } from '@/lib/agent/queue-model'
import type { AgentApi } from '@/services/agent/api-types'
import type { QueuedProposal } from '@/services/agent/types'

/** What is in flight. While anything is, every button waits, so nothing is pressed twice. */
export type QueueBusy = { kind: 'accept' | 'dismiss'; id: number }

export interface QueueDecisionsOptions {
  service: AgentApi
  /** Reads the list again, quietly, after a decision or a refusal, so it shows what became of the proposal. */
  reload: () => Promise<unknown>
  /** Something was decided or refused: what depends on it (the counters and the kill switch on the Autonomy side) reads again. */
  onChanged?: () => void
}

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

/**
 * Accepting and dismissing the proposals of the waiting queue, through the EXISTING accept and dismiss routes (there is no second way to apply one): one
 * action in flight at a time (a second press is ignored even within the same tick, which a `busy` state alone does not do: both presses see it still null), a
 * message after each, the focus on that message once the button that was pressed has left the page, an optional reason form that Escape closes and gives the
 * focus back from, and every refusal reading the list again so it never keeps offering what the server has just refused. A refusal of the right (403) takes
 * the buttons away and says why.
 */
export function useQueueDecisions({ service, reload, onChanged }: QueueDecisionsOptions) {
  const [busy, setBusy] = useState<QueueBusy | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  // A refusal showed this person may not decide: the buttons are gone and a sentence says why, without waiting for the next read to say so.
  const [noRight, setNoRight] = useState(false)

  const noticeBar = useRef<HTMLDivElement | null>(null)
  // A callback ref, not the ref object: a hook that returns a ref object makes every value read from it look like a ref read during render.
  const noticeRef = useCallback((element: HTMLDivElement | null) => { noticeBar.current = element }, [])
  const focusNotice = useRef(false)
  const inFlight = useRef(false)

  // After the button that was pressed has left the page (its proposal was decided), the focus goes to the message instead of to nowhere.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeBar.current?.focus()
    }
  }, [notice])

  const announce = useCallback((next: Notice) => {
    focusNotice.current = true
    setNotice(next)
  }, [])

  const accept = async (proposal: QueuedProposal) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy({ kind: 'accept', id: proposal.id })
    setNotice(null)
    setDismissing(null)
    try {
      const response = await service.accept(proposal.id)
      await reload()
      announce({ tone: 'success', text: acceptNotice(proposal.action, response.data.outcome) })
    } catch (cause) {
      if (statusOf(cause) === 403) setNoRight(true)
      // A proposal that could not be applied, was already decided, or may no longer be applied (the agent was switched off meanwhile): the list is read again so
      // it shows what became of it, whatever the reason was.
      await reload()
      announce({ tone: 'error', text: decisionFailureText(cause, 'The proposal could not be accepted.') })
    } finally {
      inFlight.current = false
      setBusy(null)
      onChanged?.()
    }
  }

  const confirmDismiss = async (proposal: QueuedProposal) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy({ kind: 'dismiss', id: proposal.id })
    setNotice(null)
    try {
      const response = await service.dismiss(proposal.id, reason)
      setDismissing(null)
      setReason('')
      await reload()
      announce({ tone: 'success', text: dismissNotice(response.data.outcome) })
    } catch (cause) {
      const status = statusOf(cause)
      if (status === 403) setNoRight(true)
      // The server said what became of the proposal, or that this person may not dismiss it: the form has nothing left to ask about. A lost connection or a
      // reason that was too long keeps the form open, with what was typed.
      if (status === 403 || status === 404 || status === 409) { setDismissing(null); setReason('') }
      await reload()
      announce({ tone: 'error', text: decisionFailureText(cause, 'The proposal could not be dismissed.') })
    } finally {
      inFlight.current = false
      setBusy(null)
      onChanged?.()
    }
  }

  const openDismiss = (proposal: QueuedProposal) => {
    setNotice(null)
    setReason('')
    setDismissing(proposal.id)
  }

  const cancelDismiss = (trigger: HTMLElement | null) => {
    setDismissing(null)
    setReason('')
    returnFocusTo(trigger)
  }

  return { busy, notice, setNotice, noticeRef, dismissing, reason, setReason, noRight, accept, confirmDismiss, openDismiss, cancelDismiss }
}
