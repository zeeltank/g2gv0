'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CHIP_BASE, CHIP_TONE } from '@/lib/org-accounts/tones'
import { messageSignature } from '@/lib/outreach/model'
import {
  draftSummary, fillTokens, messageFormErrors, MESSAGE_BODY_MIN, MESSAGE_SUBJECT_MAX, MESSAGE_TOKENS, outreachHref, personLabel, whyNotReachable,
} from '@/lib/signals/outreach-model'
import { outreachService as gtmOutreach } from '@/services/gtm/gtm'
import { gateService, type GateApi } from '@/services/outreach/gate-service'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { OutreachPerson, WriteMessageResult } from '@/services/signals/outreach-types'
import { OutreachChecks } from '@/components/domain/gtm/outreach-checks'
import { ConsentChip, ReachChip } from './reach-chip'
import { FormAlert, FormNote, TextField } from './outreach-form-fields'
import { errorText } from './outreach-parts'
import { useFreshKey } from './use-fresh-key'

/** What the dialog reaches outside the Outreach API for. Both default to the real thing; a test hands in fakes. */
export interface MessageDeps {
  /** The reads of the existing outreach checks (what the Checks section of a draft shows). */
  gate?: GateApi
  /** Puts one saved draft in the approval queue: the existing GTM call, and the only one this screen makes. */
  submit?: (messageId: number) => Promise<unknown>
}

const submitDraft = (messageId: number) => gtmOutreach.submit(messageId)

/** Why a person is left out of the message, or null when they can be written to by email. The server has the last word and may refuse more. */
export function skipReason(person: OutreachPerson): string | null {
  const blocked = whyNotReachable(person)
  if (blocked) return blocked

  return person.email ? null : 'no email address'
}

export const SMS_OFF_TEXT = 'SMS is not switched on for this organisation.'

/**
 * Write one message to one or many people. Email is the only channel that works: SMS is shown so nobody wonders where it went, but it is switched off and cannot be chosen.
 * People who cannot be written to (they opted out, are on the do not contact list, or have no email address) are listed as skipped, with the reason, and are not sent to the server.
 *
 * "Save draft" saves ONE DRAFT PER PERSON and nothing else: no message leaves from here. After saving, each draft shows the same Checks the Messages queue shows, and a
 * "Submit for approval" button, which puts the draft in the approval queue. Approving and delivering happen in Messages, behind its own switches.
 */
export function WriteMessageDialog({ people, open, onOpenChange, service = outreachService, gate = gateService, submit = submitDraft, onSaved }: {
  people: OutreachPerson[]
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: OutreachApi
  /** Drafts were saved: whoever lists messages can read them again. */
  onSaved?: () => void
} & MessageDeps) {
  const fresh = useFreshKey(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <WriteForm key={fresh} people={people} service={service} gate={gate} submit={submit} onSaved={onSaved} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type Token = 'subject' | 'body'
type Saved = { results: WriteMessageResult[]; drafted: number; refused: number }

function WriteForm({ people, service, gate, submit, onSaved, onClose }: {
  people: OutreachPerson[]
  service: OutreachApi
  gate: GateApi
  submit: (messageId: number) => Promise<unknown>
  onSaved?: () => void
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')
  const [saved, setSaved] = useState<Saved | null>(null)
  // What happened to each saved draft when it was put in the approval queue: busy, done, or the sentence that says why not.
  const [queued, setQueued] = useState<Record<number, 'busy' | 'done' | string>>({})
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set())
  const lastField = useRef<Token>('body')
  const subjectBox = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const bodyBox = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const rows = people.map((person) => ({ person, skip: skipReason(person) }))
  const writable = rows.filter((row) => row.skip === null).map((row) => row.person)
  const skipped = rows.filter((row) => row.skip !== null)
  const errors = messageFormErrors({ subject, body, recipients: writable.length })
  const first = writable[0] ?? null

  /** Puts a merge word where the caret was in the box the person last used (the end if it never had one), then puts the caret after it. */
  const addToken = (token: string) => {
    const field = lastField.current
    const box = field === 'subject' ? subjectBox.current : bodyBox.current
    const value = field === 'subject' ? subject : body
    const start = box?.selectionStart ?? value.length
    const end = box?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    if (field === 'subject') setSubject(next)
    else setBody(next)
    queueMicrotask(() => { box?.focus(); box?.setSelectionRange(start + token.length, start + token.length) })
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(errors).length > 0 || saving) return
    setSaving(true)
    setFailure('')
    try {
      const response = await service.writeMessages({ person_ids: writable.map((person) => person.id), subject: subject.trim(), body })
      setSaved(response.data)
      onSaved?.()
    } catch (cause) {
      setFailure(errorText(cause, 'The drafts could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  const putInQueue = async (messageId: number) => {
    setQueued((current) => ({ ...current, [messageId]: 'busy' }))
    try {
      await submit(messageId)
      setQueued((current) => ({ ...current, [messageId]: 'done' }))
    } catch (cause) {
      setQueued((current) => ({ ...current, [messageId]: errorText(cause, 'This draft could not be submitted.') }))
    }
  }

  const toggleChecks = (messageId: number) => setShown((current) => {
    const next = new Set(current)
    if (next.has(messageId)) next.delete(messageId)
    else next.add(messageId)
    return next
  })

  if (saved) {
    const byId = new Map(people.map((person) => [person.id, person]))
    const many = saved.results.filter((result) => result.ok).length > 1

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <DialogHeader className="mb-0 shrink-0">
          <DialogTitle>Drafts saved</DialogTitle>
          <DialogDescription>Nothing has been sent. Check each draft, then submit it for approval.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          <p role="status" data-draft-summary className="rounded-lg border border-success bg-card p-3 text-sm font-medium text-foreground">{draftSummary(saved.drafted, saved.refused)}</p>

          <ul className="space-y-3">
            {saved.results.map((result) => {
              const person = byId.get(result.person_id)
              const name = person ? personLabel(person) : `Person ${result.person_id}`
              if (!result.ok || result.message_id === null) {
                return (
                  <li key={result.person_id} data-draft-refused={result.person_id} className="rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">
                    <p className="font-medium">{name}</p>
                    <p>Could not be written: {result.message ?? 'The server did not say why.'}</p>
                  </li>
                )
              }
              const messageId = result.message_id
              const state = queued[messageId]
              const open = !many || shown.has(messageId)
              return (
                <li key={result.person_id} data-draft={messageId} className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{name} <span className="font-normal text-muted-foreground">· Draft saved</span></p>
                    <div className="flex flex-wrap items-center gap-2">
                      {many && (
                        <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={() => toggleChecks(messageId)}>{open ? 'Hide checks' : 'Show checks'}</Button>
                      )}
                      {state === 'done'
                        ? <span data-submitted={messageId} className={cn(CHIP_BASE, CHIP_TONE.positive)}>Submitted for approval</span>
                        : <Button type="button" size="sm" disabled={state === 'busy'} onClick={() => void putInQueue(messageId)}>{state === 'busy' ? 'Submitting…' : 'Submit for approval'}</Button>}
                    </div>
                  </div>
                  {state && state !== 'busy' && state !== 'done' && <FormAlert text={state} />}
                  {open && (
                    <OutreachChecks
                      messageId={messageId}
                      signature={messageSignature({ subject: person ? fillTokens(subject, person) : subject, body: person ? fillTokens(body, person) : body, contact_email: person?.email, contact_status: person?.reach })}
                      dirty={false}
                      productId={null}
                      refusal={null}
                      api={gate}
                    />
                  )}
                </li>
              )
            })}
          </ul>

          {skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped: {skipped.map((row) => `${personLabel(row.person)} (${(row.skip ?? '').replace(/\.$/, '')})`).join('; ')}.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Approving and sending happen in <Link href={outreachHref('messages')} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">Messages</Link>.
          </p>
        </div>

        <DialogFooter className="mt-0 shrink-0">
          <Button type="button" onClick={onClose}>Close</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
      <DialogHeader className="mb-0 shrink-0">
        <DialogTitle>Write a message</DialogTitle>
        <DialogDescription>One draft is saved for each person. Nothing is sent from here.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">How</p>
          <div role="group" aria-label="How to write" className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed="true" className="rounded-full border border-primary bg-muted px-3 py-1 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">Email</button>
            <button type="button" aria-pressed="false" disabled title={SMS_OFF_TEXT} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground opacity-60">SMS</button>
            <span data-sms-off className="text-xs text-muted-foreground">{SMS_OFF_TEXT}</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">To</p>
          {writable.length > 0 ? (
            <ul aria-label="Will be written to" className="max-h-40 space-y-1.5 overflow-y-auto">
              {writable.map((person) => (
                <li key={person.id} data-recipient={person.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground">
                  <span className="font-medium">{personLabel(person)}</span>
                  {person.full_name && <span className="text-xs text-muted-foreground">{person.company_name}</span>}
                  <ReachChip reach={person.reach} />
                  {person.consent_status !== 'unknown' && <ConsentChip status={person.consent_status} />}
                </li>
              ))}
            </ul>
          ) : (
            <p role="note" className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">Nobody here can be written to yet. Add an email address first.</p>
          )}
          {skipped.length > 0 && (
            <ul aria-label="Will be skipped" className="space-y-1">
              {skipped.map((row) => (
                <li key={row.person.id} data-skipped={row.person.id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{personLabel(row.person)}</span>: Will be skipped: {row.skip}{row.skip?.endsWith('.') ? '' : '.'}
                </li>
              ))}
            </ul>
          )}
          {errors.recipients && attempted && <p className="text-xs text-red-700 dark:text-red-300">{errors.recipients}</p>}
        </div>

        <TextField
          label="Subject"
          value={subject}
          onChange={setSubject}
          error={attempted ? errors.subject : undefined}
          maxLength={MESSAGE_SUBJECT_MAX}
          onFocus={() => { lastField.current = 'subject' }}
          inputRef={subjectBox}
          required
        />

        <div className="space-y-1.5">
          <TextField
            label="Message"
            value={body}
            onChange={setBody}
            error={attempted ? errors.body : undefined}
            hint={`Write at least ${MESSAGE_BODY_MIN} characters. ${body.trim().length} so far.`}
            multiline
            rows={7}
            onFocus={() => { lastField.current = 'body' }}
            inputRef={bodyBox}
            required
          />
          <div role="group" aria-label="Add a name to the message" className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Fills in each person’s own details:</span>
            {MESSAGE_TOKENS.map((token) => (
              <Button key={token.token} type="button" size="sm" variant="outline" title={`Adds ${token.token}`} onClick={() => addToken(token.token)}>{token.label}</Button>
            ))}
          </div>
        </div>

        {first && (subject.trim() !== '' || body.trim() !== '') && (
          <section aria-label="Preview" data-preview className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview for {personLabel(first)}</p>
            <p className="font-medium">{fillTokens(subject, first) || '(no subject yet)'}</p>
            <p className="whitespace-pre-wrap break-words">{fillTokens(body, first) || '(no message yet)'}</p>
          </section>
        )}

        <FormNote>
          You will check each draft and submit it for approval next. Approving and sending happen in <Link href={outreachHref('messages')} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">Messages</Link>.
        </FormNote>
        {failure && <FormAlert text={failure} />}
      </div>

      <DialogFooter className="mt-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || writable.length === 0}>{saving ? 'Saving…' : 'Save draft'}</Button>
      </DialogFooter>
    </form>
  )
}
