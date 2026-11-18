'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect } from '@/components/shared/scaffolds/form-field'
import { FormErrorSummary, FormLayout } from '@/components/shared/scaffolds/form-layout'
import {
  decisionLabel, dialogTitle, formatDateTime, reasonText, relativeTime, statusLabel, submitLabel,
} from '@/lib/signal-review/format'
import type { DecisionDialogProps, ReviewHistoryEntry } from '@/services/signal-review/types'

/** The server's cap on a note (config signals.review.note_max). The box stops here, so a note is never cut by the server. */
const NOTE_MAX = 1000
/** The one reason that cannot stand alone: the person must say what "Other" means. */
const OTHER_REASON = 'other'

type ErrorField = 'reason_code' | 'note'
type FieldErrors = Partial<Record<ErrorField, string>>

/**
 * The dialog for deciding on a signal: "Not relevant" (a reason from the list is required), "Contacted", "Reviewed" (an optional note) and "Reopen".
 * It is presentational: it holds only its own form state and hands the answer to `onSubmit`; the screen calls the API and passes back what came of it
 * (`saving`, `serverErrors`, `formError`, or a `conflict` when someone else decided first).
 *
 * The reason list is a native select on purpose: a portalled listbox inside a dialog cannot be scrolled with the mouse wheel (react-remove-scroll
 * blocks the wheel outside the dialog), and the reasons are a short list that needs no search box.
 */
export function SignalDecisionDialog(props: DecisionDialogProps) {
  const { open, mode, saving, onClose } = props

  // Every opening starts a fresh form, even if the previous one has not finished its exit animation (the content is still mounted then).
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto">
        <DecisionBody key={`${session}:${mode}`} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function DecisionBody({
  mode, signalTitle, currentStatus, reasons, saving, serverErrors, formError, conflict, onSubmit, onResolveConflict, onClose,
}: DecisionDialogProps) {
  const needsReason = mode === 'dismissed'
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  // A server message stops being true when the person edits its field. It is tied to the answer it came with, so a new answer shows its own again.
  const [edited, setEdited] = useState<{ source: DecisionDialogProps['serverErrors']; fields: readonly ErrorField[] }>({ source: serverErrors, fields: [] })
  const reasonRef = useRef<HTMLSelectElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const focusedFor = useRef<DecisionDialogProps['serverErrors']>(null)

  const noteRequired = needsReason && reason === OTHER_REASON
  const editedFields = edited.source === serverErrors ? edited.fields : []
  const fromServer = (field: ErrorField) => (editedFields.includes(field) ? undefined : serverErrors?.[field])
  const reasonError = clientErrors.reason_code ?? (needsReason ? fromServer('reason_code') : undefined)
  const noteError = clientErrors.note ?? fromServer('note')
  // What the form has no field to show: the screen's own message, and anything the server said about a field that is not on this form.
  const unplaced = [...new Set([formError, serverErrors?.decision, needsReason ? undefined : serverErrors?.reason_code].filter((m): m is string => !!m))]

  // Server messages arrive while the controls are still disabled (`saving`), and a disabled control cannot take focus: wait until it is enabled.
  useEffect(() => {
    if (!serverErrors || saving || focusedFor.current === serverErrors) return
    const target = needsReason && serverErrors.reason_code ? reasonRef.current : serverErrors.note ? noteRef.current : null
    if (!target) return
    target.focus()
    focusedFor.current = serverErrors
  }, [serverErrors, saving, needsReason])

  const markEdited = (field: ErrorField) => setEdited({ source: serverErrors, fields: [...editedFields, field] })

  const changeReason = (value: string) => {
    setReason(value)
    // Switching away from "Other" also ends "the note is required".
    setClientErrors({})
    markEdited('reason_code')
  }

  const changeNote = (value: string) => {
    setNote(value.slice(0, NOTE_MAX))
    setClientErrors((e) => ({ ...e, note: undefined }))
    markEdited('note')
  }

  const submit = () => {
    if (saving) return
    const trimmed = note.trim()
    const errors: FieldErrors = {}
    if (needsReason && !reason) errors.reason_code = 'Choose a reason to continue.'
    if (noteRequired && trimmed === '') errors.note = 'Add a note: say what “Other” means for this signal.'
    setClientErrors(errors)
    if (errors.reason_code) return void reasonRef.current?.focus()
    if (errors.note) return void noteRef.current?.focus()

    onSubmit({ decision: mode, ...(needsReason ? { reason_code: reason } : {}), ...(trimmed ? { note: trimmed } : {}) })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{dialogTitle(mode)}</DialogTitle>
        <DialogDescription className="line-clamp-3">{signalTitle}</DialogDescription>
        <p className="text-xs text-muted-foreground">Now: {statusLabel(currentStatus)}</p>
      </DialogHeader>

      {conflict ? (
        <ConflictView conflict={conflict} saving={saving} onResolve={onResolveConflict} />
      ) : (
        <FormLayout onSubmit={submit}>
          <FormErrorSummary messages={unplaced} />

          {mode === 'reopened' && (
            <p className="text-sm text-muted-foreground">
              Reopening puts this signal back in the list that needs a decision. Nothing is deleted: the earlier decisions stay in History.
            </p>
          )}

          {needsReason && (
            <Field label="Reason" required hint="Pick one. This helps us find better signals." error={reasonError}>
              {(control) => (
                <NativeSelect {...control} ref={reasonRef} value={reason} disabled={saving} onChange={(event) => changeReason(event.target.value)}>
                  <option value="">Choose a reason…</option>
                  {reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </NativeSelect>
              )}
            </Field>
          )}

          <Field label={noteRequired ? 'Note' : 'Note (optional)'} required={noteRequired} hint={`${note.length} / ${NOTE_MAX}`} error={noteError}>
            {(control) => (
              <Textarea {...control} ref={noteRef} rows={3} maxLength={NOTE_MAX} value={note} disabled={saving} onChange={(event) => changeNote(event.target.value)} />
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={needsReason ? 'destructive' : 'default'} disabled={saving}>
              {saving ? 'Saving…' : submitLabel(mode)}
            </Button>
          </div>
        </FormLayout>
      )}
    </>
  )
}

/** Shown in place of the form when the server answered 409: someone decided between the person opening the signal and pressing the button. */
function ConflictView({ conflict, saving, onResolve }: {
  conflict: ReviewHistoryEntry
  saving: boolean
  onResolve: DecisionDialogProps['onResolveConflict']
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { panel.current?.focus() }, [])

  const who = conflict.decided_by_name?.trim() || 'Someone'
  const reason = reasonText(conflict)
  const ago = relativeTime(conflict.decided_at)

  return (
    <div className="space-y-4">
      <div ref={panel} role="alert" tabIndex={-1} className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm outline-none">
        <p className="font-semibold text-foreground">Someone decided first</p>
        <p>{who} already decided on this signal{ago ? ` ${ago}` : ''}.</p>
        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Decision</dt>
          <dd>{decisionLabel(conflict.decision)}</dd>
          {reason && (<><dt className="text-muted-foreground">Reason</dt><dd>{reason}</dd></>)}
          {conflict.note && (<><dt className="text-muted-foreground">Note</dt><dd className="whitespace-pre-wrap break-words">{conflict.note}</dd></>)}
          <dt className="text-muted-foreground">When</dt>
          <dd>{formatDateTime(conflict.decided_at)}</dd>
        </dl>
      </div>
      <p className="text-sm text-muted-foreground">
        Continue anyway to add your decision after theirs. Nothing is overwritten: both stay in History.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={() => onResolve('cancel')}>Cancel</Button>
        <Button type="button" disabled={saving} onClick={() => onResolve('continue')}>Continue anyway</Button>
      </div>
    </div>
  )
}
