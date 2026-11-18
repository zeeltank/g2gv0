'use client'

import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { NativeSelect, type FieldControlProps } from '@/components/shared/scaffolds/form-field'
import { FormErrorSummary, FormLayout, FormSection } from '@/components/shared/scaffolds/form-layout'
import { RecordDrawer } from '@/components/shared/scaffolds/record-drawer'
import type { SplitErrors } from '@/components/shared/scaffolds/form-errors'
import { lifecycleLabel } from '@/lib/org-accounts/display'
import { EDIT_FIELDS, formFromIdentity, isDirty, ownerChoices, patchBody, type EditForm, type OwnerOption } from '@/lib/org-accounts/edit-model'
import { classifySaveFailure } from '@/lib/org-accounts/failure'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { cn } from '@/lib/utils'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import type { Org360, OrgLifecycle } from '@/services/org-accounts/types'

const NO_ERRORS: SplitErrors = { byField: {}, unplaced: [] }
const FORM_ID = 'org-account-edit-form'

/**
 * A labelled field whose error is ANNOUNCED. It does what the shared Field does (the label, the hint and the error are tied to the control, which is marked
 * invalid while there is an error), and the error is a `role="alert"` in a dark red that passes 4.5:1 (the shared Field's message is neither: it appears
 * silently, in 3.97:1 red). Kept here so the shared Field, which the product screens use, is left as it is.
 */
function EditField({ label, required, hint, error, children }: {
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: (control: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-primary">*</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required ? true : undefined })}
      {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className={cn('text-xs', FIELD_ERROR_TEXT)}>{error}</p>}
    </div>
  )
}

/**
 * Lifecycle and owner of one organisation, in a drawer. It sends only what changed and shows what the server answers, field by field: there is no
 * client-side validation, so the messages are the server's own. Mount it afresh (a new `key`) each time it is opened to start from the current values.
 */
export function OrgAccountEditForm({ open, identity, lifecycles, owners, service, onClose, onSaved }: {
  open: boolean
  identity: Org360['identity']
  /** The lifecycles the server accepts. */
  lifecycles: readonly OrgLifecycle[]
  owners: readonly OwnerOption[]
  service: OrgAccountsApi
  onClose: () => void
  onSaved: () => void
}) {
  const [initial] = useState<EditForm>(() => formFromIdentity(identity))
  const [form, setForm] = useState<EditForm>(initial)
  const [errors, setErrors] = useState<SplitErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)

  const dirty = isDirty(initial, form)
  const err = (name: string) => errors.byField[name]?.join(' ')
  /** An error stops being true when the person edits its field. */
  const set = (patch: Partial<EditForm>, field: string) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const byField = { ...e.byField }
      delete byField[field]
      return { ...e, byField }
    })
  }

  const submit = async () => {
    if (busy || !dirty) return
    setBusy(true)
    setErrors(NO_ERRORS)
    try {
      await service.patch(identity.id, patchBody(initial, form))
      onSaved()
    } catch (cause) {
      setErrors(classifySaveFailure(cause, EDIT_FIELDS))
    } finally {
      setBusy(false)
    }
  }

  // The current lifecycle is offered even if the server's list does not name it, so the box never shows a wrong value.
  const lifecycleOptions = lifecycles.includes(initial.lifecycle) ? lifecycles : [initial.lifecycle, ...lifecycles]

  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={`Edit ${identity.name}`}
      description="Where this organisation stands and who owns it. The name and the links to the CRM, GTM and Signals are not changed here."
      dirty={dirty}
      busy={busy}
      footer={(requestClose) => (
        <>
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </>
      )}
    >
      <FormLayout id={FORM_ID} onSubmit={() => void submit()}>
        <FormErrorSummary messages={errors.unplaced} />
        <FormSection title="Organisation" saves="saves to the organisation's linked records">
          <EditField label="Lifecycle" required error={err('lifecycle')} hint="Customer is set by a person; nothing is worked out for you.">
            {(c) => (
              <NativeSelect {...c} value={form.lifecycle} onChange={(e) => set({ lifecycle: e.target.value as OrgLifecycle }, 'lifecycle')} disabled={busy}>
                {lifecycleOptions.map((value) => <option key={value} value={value}>{lifecycleLabel(value)}</option>)}
              </NativeSelect>
            )}
          </EditField>
          <EditField label="Owner" error={err('owner_user_id')}>
            {(c) => (
              <NativeSelect {...c} value={form.owner} onChange={(e) => set({ owner: e.target.value }, 'owner_user_id')} disabled={busy}>
                <option value="">No owner</option>
                {ownerChoices(owners, identity).map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </NativeSelect>
            )}
          </EditField>
        </FormSection>
      </FormLayout>
    </RecordDrawer>
  )
}
