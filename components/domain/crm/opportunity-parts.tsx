'use client'

import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { NativeSelect } from '@/components/shared/scaffolds'
import { SectionCard } from '@/components/shared/business/shared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  lossReasonProblem, lossReasonView, productChoices, productText, reasonChoices, showProductChoice, type Refusal,
} from '@/lib/opportunities/model'
import { FIELD_ERROR_TEXT, NOTICE_TONE } from '@/lib/opportunities/tones'
import { cn } from '@/lib/utils'
import type { PmOption } from '@/services/product-master/types'
import type { OpportunityLossReasonOption, OpportunityLossReasonRef, OpportunityProductRef } from '@/types/crm'

/**
 * The parts the opportunity screens gained with slice 11b (hp_erp docs/agentic-crm/slices/S11-pipeline-and-forecast.md): the dialog that asks why a deal was
 * lost, the Reason box of the edit form, the form's optional Product box, the product line under a deal's title and the Reason Lost card. The rules (what is
 * sent, what a sentence says, when a part shows) are in lib/opportunities/model.ts and the colours in lib/opportunities/tones.ts. Every part draws nothing when
 * the server told it nothing (an older server), so the screens are as they were. Nothing here sends or schedules anything.
 */

/** The server's cap on a free-text reason (`closeReason` is validated `max:1000` on a stage move). The box stops here, so a reason is never cut by the server. */
const NOTE_MAX = 1000

// ── The Product ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The form's optional Product box: "No product" and every product the Product Master lists. A native select: a short list that needs no search, it takes a
 * label, and it needs nothing special inside a dialog. Not drawn when there is nothing to choose and nothing chosen (no right, a server without the master).
 */
export function OpportunityProductSelect({ options, current, value, onChange }: {
  options: readonly PmOption[]; current: OpportunityProductRef | null; value: string; onChange: (value: string) => void
}) {
  const id = useId()
  if (!showProductChoice(options, current)) return null

  return (
    <div className="space-y-1.5" data-opportunity-product-field>
      <Label htmlFor={id}>Product (optional)</Label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {productChoices(options, current).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
    </div>
  )
}

/** The line under a deal's title: "Product: School ERP", or "No product chosen". Nothing when the server did not say (an older server). */
export function OpportunityProductLine({ product }: { product: OpportunityProductRef | null | undefined }) {
  const text = productText(product)
  if (text === null) return null
  return <p className="break-words text-sm text-muted-foreground" data-opportunity-product>{product ? `Product: ${text}` : text}</p>
}

// ── The Reason ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The Reason box: a native select of the server's coded reasons. The error under it is its own paragraph (the shared Field's red is 3.97:1) and is tied to the
 * box, so a screen reader reads it with the box. A native control for the reason a portalled listbox gives inside a dialog: the wheel cannot scroll it there.
 */
export function LossReasonSelect({ reasons, current, value, onChange, error, disabled, selectRef }: {
  reasons: readonly OpportunityLossReasonOption[]
  current: OpportunityLossReasonRef | null
  value: string
  onChange: (value: string) => void
  error?: string | null
  disabled?: boolean
  selectRef?: Ref<HTMLSelectElement>
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="space-y-1.5" data-loss-reason-field>
      <Label htmlFor={id}>Reason lost</Label>
      <NativeSelect
        id={id}
        ref={selectRef}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {reasonChoices(reasons, current).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </NativeSelect>
      {error && <p id={errorId} className={cn('text-xs', FIELD_ERROR_TEXT)} data-loss-reason-error>{error}</p>}
    </div>
  )
}

/** What the person is asked on the board, and what comes of it. */
export interface LossReasonDialogProps {
  open: boolean
  /** The deal's name, so the question is about something. */
  opportunityName: string
  /** The server's coded reasons; empty for an older server, and then the box for words is the whole question. */
  reasons: readonly OpportunityLossReasonOption[]
  saving: boolean
  /** The server's refusal of the last attempt, if any. */
  refusal: Refusal | null
  onSubmit: (answer: { code: string; note: string }) => void
  /** Cancel, Escape and a click outside. Nothing was moved, so the card is where it was. */
  onCancel: () => void
  /** Called as the dialog closes, to put focus back on the card (the browser would otherwise leave it on the page). */
  onCloseFocus: () => void
}

/**
 * Asks why a deal was lost, when a card is dropped on Closed Lost: a reason from the server's coded list and, if the person wants, their own words. Nothing has
 * moved yet; the move is made (and only then shown) when the person answers. A refusal from the server stays in the dialog, next to the Reason box when it is
 * about the reason, so the person can answer again. Escape and Cancel leave the card where it was and give focus back to it.
 */
export function LossReasonDialog(props: LossReasonDialogProps) {
  const { open, saving, onCancel, onCloseFocus } = props

  // Every opening starts a fresh form, even if the previous one has not finished its exit animation (the content is still mounted then).
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onCancel() }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto"
        onCloseAutoFocus={(event) => { event.preventDefault(); onCloseFocus() }}
      >
        <LossReasonBody key={session} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function LossReasonBody({ opportunityName, reasons, saving, refusal, onSubmit, onCancel }: LossReasonDialogProps) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)
  // A server message stops being true when the person edits what it was about. It is tied to the answer it came with, so a new answer shows its own again.
  const [editedFor, setEditedFor] = useState<Refusal | null>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const focusedFor = useRef<Refusal | null>(null)

  const hasList = reasons.length > 0
  const shown = refusal !== null && editedFor !== refusal ? refusal : null
  // The sentence goes where the question is: next to the Reason box when there is one, else under the box for words. Anything else is an alert above the form.
  const reasonError = clientError ?? (shown && (shown.onReason || !hasList) ? shown.message : null)
  const alertText = shown && !shown.onReason && hasList ? shown.message : null

  // A refusal arrives while the controls are still disabled (`saving`), and a disabled control cannot take focus: wait until it is enabled.
  useEffect(() => {
    if (!shown || saving || focusedFor.current === shown) return
    focusedFor.current = shown
    const target = hasList ? selectRef.current : noteRef.current
    target?.focus()
  }, [shown, saving, hasList])

  const submit = () => {
    if (saving) return
    const problem = lossReasonProblem(reasons, code, note)
    setClientError(problem)
    if (problem) {
      const target = hasList ? selectRef.current : noteRef.current
      target?.focus()
      return
    }
    onSubmit({ code, note })
  }

  const changeCode = (value: string) => {
    setCode(value)
    setClientError(null)
    setEditedFor(refusal)
  }

  const changeNote = (value: string) => {
    setNote(value.slice(0, NOTE_MAX))
    setClientError(null)
    if (!hasList) setEditedFor(refusal)
  }

  const noteId = `${useId()}-note`
  const noteErrorId = `${noteId}-error`

  return (
    <>
      <DialogHeader>
        <DialogTitle>Why was this opportunity lost?</DialogTitle>
        <DialogDescription className="line-clamp-3 break-words">{opportunityName}</DialogDescription>
      </DialogHeader>

      <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); submit() }}>
        {alertText && <div role="alert" className={cn('rounded-lg border p-3 text-sm', NOTICE_TONE.error)} data-loss-reason-refusal>{alertText}</div>}

        {hasList && <LossReasonSelect reasons={reasons} current={null} value={code} onChange={changeCode} error={reasonError} disabled={saving} selectRef={selectRef} />}

        <div className="space-y-1.5">
          <Label htmlFor={noteId}>{hasList ? 'Anything to add? (optional)' : 'Reason lost'}</Label>
          <Textarea
            id={noteId}
            ref={noteRef}
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            disabled={saving}
            aria-required={hasList ? undefined : true}
            aria-invalid={!hasList && reasonError ? true : undefined}
            aria-describedby={!hasList && reasonError ? noteErrorId : undefined}
            onChange={(event) => changeNote(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{note.length} / {NOTE_MAX}</p>
          {!hasList && reasonError && <p id={noteErrorId} className={cn('text-xs', FIELD_ERROR_TEXT)} data-loss-reason-error>{reasonError}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Mark as lost'}</Button>
        </div>
      </form>
    </>
  )
}

/** The Reason Lost card of a deal's page: the coded reason in words, and what the person wrote when it says more. Nothing is drawn when there is neither. */
export function ReasonLostCard({ lossReason, closeReason }: { lossReason: OpportunityLossReasonRef | null | undefined; closeReason: string | null | undefined }) {
  const view = lossReasonView(lossReason, closeReason)
  if (!view) return null
  return (
    <SectionCard title="Reason Lost">
      <div className="space-y-1" data-loss-reason>
        {view.label && <p className="break-words text-sm font-medium text-foreground" data-loss-reason-label>{view.label}</p>}
        {view.note && <p className="whitespace-pre-wrap break-words text-sm text-foreground" data-loss-reason-note>{view.note}</p>}
      </div>
    </SectionCard>
  )
}
