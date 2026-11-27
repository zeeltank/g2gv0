'use client'

import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CONSENT_LABEL, personLabel } from '@/lib/signals/outreach-model'
import { outreachService, type OutreachApi } from '@/services/signals/outreach'
import type { ConsentBody, ConsentStatus, OutreachPerson } from '@/services/signals/outreach-types'
import { FormAlert, FormNote, TextField } from './outreach-form-fields'
import { errorText } from './outreach-parts'
import { useFreshKey } from './use-fresh-key'

/** The three answers a person can give. "Suppressed" is not one of them: the system sets it (a bounce, a complaint), and nobody can lift it from here. */
const ANSWERS: ReadonlyArray<{ id: Exclude<ConsentStatus, 'suppressed'>; hint: string }> = [
  { id: 'opted_in', hint: 'They said they are happy to hear from us.' },
  { id: 'unknown', hint: 'We have not asked, or they have not replied.' },
  { id: 'opted_out', hint: 'They asked us to stop writing to them.' },
]

/**
 * What this person has agreed to: whether they want to hear from us, and whether they may be emailed or called. It is how a person is taken off the list of people we write to,
 * so a found person (who cannot be deleted) is kept out with "Do not contact" instead. `preset="do_not_contact"` opens it already set to that.
 */
export function ConsentDialog({ open, onOpenChange, person, service = outreachService, preset, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: OutreachPerson
  service?: OutreachApi
  preset?: 'do_not_contact'
  onSaved: (person: OutreachPerson) => void
}) {
  const fresh = useFreshKey(open)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <ConsentForm key={fresh} person={person} service={service} preset={preset} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

function ConsentForm({ person, service, preset, onClose, onSaved }: {
  person: OutreachPerson
  service: OutreachApi
  preset?: 'do_not_contact'
  onClose: () => void
  onSaved: (person: OutreachPerson) => void
}) {
  const name = useId()
  const locked = person.consent_status === 'suppressed'
  const [status, setStatus] = useState<ConsentStatus>(preset ? 'opted_out' : person.consent_status)
  const [noEmail, setNoEmail] = useState(preset ? true : person.email_opt_out)
  const [noCalls, setNoCalls] = useState(preset ? true : person.do_not_call)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')

  const unchanged = status === person.consent_status && noEmail === person.email_opt_out && noCalls === person.do_not_call
  const label = personLabel(person)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked || unchanged || saving) return
    setSaving(true)
    setFailure('')
    try {
      const body: ConsentBody = { consent_status: status, email_opt_out: noEmail, do_not_call: noCalls }
      if (reason.trim()) body.reason = reason.trim()
      const response = await service.setConsent(person.id, body)
      onSaved(response.data)
      onClose()
    } catch (cause) {
      setFailure(errorText(cause, 'The answer could not be saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col gap-4">
      <DialogHeader className="mb-0 shrink-0">
        <DialogTitle>{preset ? 'Mark as do not contact' : 'What they agreed to'}</DialogTitle>
        <DialogDescription>{label}: say whether we may write to them or call them. People who opted out are never written to.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        {locked ? (
          <FormNote>They are on the do not contact list because of a bounce, a complaint or an earlier request. That cannot be changed here.</FormNote>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-foreground">Do they want to hear from us?</legend>
              {ANSWERS.map((answer) => (
                <label key={answer.id} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-sm text-foreground">
                  <input type="radio" name={name} value={answer.id} checked={status === answer.id} onChange={() => setStatus(answer.id)} className="mt-0.5" />
                  <span>
                    <span className="block font-medium">{CONSENT_LABEL[answer.id]}</span>
                    <span className="block text-xs text-muted-foreground">{answer.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={noEmail} onChange={(event) => setNoEmail(event.target.checked)} />
                Do not email them
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={noCalls} onChange={(event) => setNoCalls(event.target.checked)} />
                Do not call them
              </label>
            </div>

            <TextField label="Why (optional)" value={reason} onChange={setReason} hint="For example: asked by phone on 12 Nov." maxLength={500} />
            {unchanged && <FormNote>This is already how it is set.</FormNote>}
          </>
        )}
        {failure && <FormAlert text={failure} />}
      </div>

      <DialogFooter className="mt-0 shrink-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || locked || unchanged}>{saving ? 'Saving…' : 'Save'}</Button>
      </DialogFooter>
    </form>
  )
}
