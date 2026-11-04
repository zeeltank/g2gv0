'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { acceptNotice, DISMISS_NOTICE, failureText, isNoRight, wroteRecord, type Notice } from '@/lib/facts/model'
import type { FactsApi } from '@/services/facts/api-types'
import type { Fact, FactCan, FactEntityType } from '@/services/facts/types'

/** What is in flight. While anything is, every button waits, so nothing is pressed twice. */
export type FactBusy = { kind: 'accept' | 'dismiss'; id: number }

export interface FactDecisionsOptions {
  service: FactsApi
  /** Which records the decisions belong to. Work that finishes after this has changed (another record is open) must not touch the new one. */
  scopeKey: string
  /** Reads what the screen shows again, quietly, after a decision or a refusal (so it shows what became of the fact). */
  reload: () => Promise<unknown>
  /** An accepted fact wrote the record's own field: the page that shows that field must show the new value. */
  onWroteRecord?: (fact: Fact) => void
  /** The sentence after an accepted fact. Defaults to the plain one; a screen may add to it. */
  acceptText?: (fact: Fact) => string
}

/**
 * Accepting and dismissing facts, shared by the suggestions queue and a record's evidence section: one action in flight at a time (a second press is
 * ignored even within the same tick), a message after each, the focus on that message once the button that was pressed has left the page, an optional
 * reason form that Escape closes, a refusal that reads the state again, and an answer that arrives after the screen moved on to another record dropped.
 */
export function useFactDecisions({ service, scopeKey, reload, onWroteRecord, acceptText }: FactDecisionsOptions) {
  const [busy, setBusy] = useState<FactBusy | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  // The kinds of record a refusal showed this person may not decide: their buttons are gone and a sentence says why.
  const [readOnlyKinds, setReadOnlyKinds] = useState<FactEntityType[]>([])

  const noticeBar = useRef<HTMLDivElement | null>(null)
  // A callback ref, not the ref object: a hook that returns a ref object makes every value read from it look like a ref read during render.
  const noticeRef = useCallback((element: HTMLDivElement | null) => { noticeBar.current = element }, [])
  const focusNotice = useRef(false)
  const inFlight = useRef(false)
  const shown = useRef(scopeKey)

  // Another record starts clean: a message, an open reason form, a half-typed reason and what a refusal showed belong to the one before.
  useEffect(() => {
    shown.current = scopeKey
    inFlight.current = false
    queueMicrotask(() => { setBusy(null); setNotice(null); setDismissing(null); setReason(''); setReadOnlyKinds([]) })
  }, [scopeKey])

  // After the button that was pressed has left the page (its fact was decided), the focus goes to the message instead of to nowhere.
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

  const refused = (cause: unknown, fact: Fact) => {
    if (isNoRight(cause)) setReadOnlyKinds((kinds) => (kinds.includes(fact.entity_type) ? kinds : [...kinds, fact.entity_type]))
  }

  const accept = async (fact: Fact) => {
    if (inFlight.current) return
    const key = scopeKey
    inFlight.current = true
    setBusy({ kind: 'accept', id: fact.id })
    setNotice(null)
    setDismissing(null)
    try {
      const response = await service.accept(fact.id)
      if (shown.current !== key) return
      await reload()
      const decided = response.data.fact
      announce({ tone: 'success', text: acceptText ? acceptText(decided) : acceptNotice(decided) })
      if (wroteRecord(decided)) onWroteRecord?.(decided)
    } catch (cause) {
      if (shown.current !== key) return
      refused(cause, fact)
      // A fact that was decided meanwhile, whose record is gone, or that this person may not decide: the screen is read again so it shows what became of it.
      await reload()
      announce({ tone: 'error', text: failureText(cause, 'The suggestion could not be accepted.') })
    } finally {
      if (shown.current === key) { inFlight.current = false; setBusy(null) }
    }
  }

  const confirmDismiss = async (fact: Fact) => {
    if (inFlight.current) return
    const key = scopeKey
    inFlight.current = true
    setBusy({ kind: 'dismiss', id: fact.id })
    setNotice(null)
    try {
      await service.dismiss(fact.id, reason)
      if (shown.current !== key) return
      setDismissing(null)
      setReason('')
      await reload()
      announce({ tone: 'success', text: DISMISS_NOTICE })
    } catch (cause) {
      if (shown.current !== key) return
      refused(cause, fact)
      // The server said what became of the fact (or that it may not be dismissed by this person): the form has nothing left to ask about. A lost connection or
      // a reason that was too long keeps the form open, with what was typed.
      const status = (cause as { status?: unknown } | null)?.status
      if (status === 403 || status === 404 || status === 409) { setDismissing(null); setReason('') }
      await reload()
      announce({ tone: 'error', text: failureText(cause, 'The suggestion could not be dismissed.') })
    } finally {
      if (shown.current === key) { inFlight.current = false; setBusy(null) }
    }
  }

  const openDismiss = (fact: Fact) => {
    setNotice(null)
    setReason('')
    setDismissing(fact.id)
  }

  const cancelDismiss = (returnFocus: () => void) => {
    setDismissing(null)
    setReason('')
    returnFocus()
  }

  /**
   * Whether the buttons are offered for this fact: the server did not say no (`can.decide`), the kind of record is one it lists (`can.decide_types`, the queue
   * only), and no refusal has shown this person may not decide this kind of record.
   */
  const canDecide = (fact: Fact, can: FactCan | undefined): boolean => can?.decide !== false
    && (can?.decide_types === undefined || can.decide_types.includes(fact.entity_type))
    && !readOnlyKinds.includes(fact.entity_type)

  return { busy, notice, setNotice, dismissing, reason, setReason, noticeRef, accept, confirmDismiss, openDismiss, cancelDismiss, canDecide, readOnlyKinds }
}

export type FactDecisions = ReturnType<typeof useFactDecisions>
