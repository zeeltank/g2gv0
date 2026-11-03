'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDecisionRequest } from '@/lib/signal-review/decision-actions'
import { classifyDecisionFailure } from '@/lib/signal-review/decision-failure'
import type { SignalReviewApi } from '@/services/signal-review/signal-review-service'
import type { SignalDecisionResponse, SignalRow } from '@/services/signal-review/signal-types'
import type { DecisionDialogProps, DecisionDialogSubmit, ReviewDecisionCode, ReviewHistoryEntry, ReviewStatus } from '@/services/signal-review/types'

/**
 * Taking one decision on one signal: opens the dialog, sends the answer with the status the person was looking at, and turns every way the server can
 * refuse into what the dialog shows (field messages, a form message, or the decision that got there first). The dialog itself only holds its form.
 */
export function useSignalDecision({ service, signal, onSaved, onStale, onForbidden }: {
  service: Pick<SignalReviewApi, 'decide'>
  signal: Pick<SignalRow, 'id' | 'review_status'>
  /** The decision was saved: the server's new version of the signal and the history row it wrote. */
  onSaved: (result: SignalDecisionResponse) => void
  /** What the person was looking at is out of date. `entry` is the decision that got there first, when the server said. */
  onStale: (entry: ReviewHistoryEntry | null) => void
  /** The server said this person may view signals but not decide on them. */
  onForbidden: () => void
}) {
  // The mode outlives the dialog being open: it fades out after it closes, and its form must not change under it while it leaves.
  const [mode, setMode] = useState<ReviewDecisionCode>('reviewed')
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverErrors, setServerErrors] = useState<DecisionDialogProps['serverErrors']>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ReviewHistoryEntry | null>(null)

  // Refs, not state: they are read inside an async call that outlives the render it started in.
  const signalRef = useRef(signal)
  useEffect(() => { signalRef.current = signal })
  const expected = useRef<ReviewStatus>(signal.review_status)
  const lastAnswer = useRef<DecisionDialogSubmit | null>(null)
  const busy = useRef(false)

  const send = useCallback(async (answer: DecisionDialogSubmit) => {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setServerErrors(null)
    setFormError(null)
    try {
      const result = await service.decide(signalRef.current.id, buildDecisionRequest(answer, expected.current))
      setIsOpen(false)
      setConflict(null)
      onSaved(result)
    } catch (error) {
      const failure = classifyDecisionFailure(error)
      switch (failure.kind) {
        case 'fields':
          setServerErrors(failure.serverErrors)
          setFormError(failure.formError)
          break
        case 'conflict':
          if (failure.entry) setConflict(failure.entry)
          else setFormError(failure.message)
          onStale(failure.entry)
          break
        case 'unchanged':
          setFormError(failure.message)
          onStale(null)
          break
        case 'forbidden':
          setFormError(failure.message)
          onForbidden()
          break
        default:
          setFormError(failure.message)
      }
    } finally {
      busy.current = false
      setSaving(false)
    }
  }, [service, onSaved, onStale, onForbidden])

  const open = useCallback((next: ReviewDecisionCode) => {
    expected.current = signalRef.current.review_status
    lastAnswer.current = null
    setServerErrors(null)
    setFormError(null)
    setConflict(null)
    setMode(next)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    if (busy.current) return
    setIsOpen(false)
    setConflict(null)
    setServerErrors(null)
    setFormError(null)
  }, [])

  const submit = useCallback((answer: DecisionDialogSubmit) => {
    lastAnswer.current = answer
    void send(answer)
  }, [send])

  const resolveConflict = useCallback((choice: 'continue' | 'cancel') => {
    if (choice === 'cancel') return close()
    // "Continue anyway": the person has now seen the decision that got there first, so their own is sent against that status.
    if (!conflict || !lastAnswer.current) return
    expected.current = conflict.to_status
    setConflict(null)
    void send(lastAnswer.current)
  }, [conflict, close, send])

  /** The dialog's props, apart from the ones the drawer knows (the title, the status and the reasons). */
  const dialog: Pick<DecisionDialogProps, 'open' | 'mode' | 'saving' | 'serverErrors' | 'formError' | 'conflict' | 'onSubmit' | 'onResolveConflict' | 'onClose'> = {
    open: isOpen,
    mode,
    saving,
    serverErrors,
    formError,
    conflict,
    onSubmit: submit,
    onResolveConflict: resolveConflict,
    onClose: close,
  }

  return { dialog, open, saving }
}
