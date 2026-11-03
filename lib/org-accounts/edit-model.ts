import type { OrgPatchRequest } from '@/services/org-accounts/api-types'
import type { Org360, OrgLifecycle } from '@/services/org-accounts/types'

/** The edit drawer's state, and how it becomes the API's request. The form's field names are the API's, so a 422 keyed by one lands beside its field. */
export interface EditForm {
  lifecycle: OrgLifecycle
  /** The select's value: a user id, or "" for nobody. */
  owner: string
}

export const EDIT_FIELDS = ['lifecycle', 'owner_user_id'] as const

export interface OwnerOption {
  id: string
  name: string
}

export function formFromIdentity(identity: Pick<Org360['identity'], 'lifecycle' | 'owner_user_id'>): EditForm {
  return { lifecycle: identity.lifecycle, owner: identity.owner_user_id === null ? '' : String(identity.owner_user_id) }
}

export function isDirty(initial: EditForm, form: EditForm): boolean {
  return initial.lifecycle !== form.lifecycle || initial.owner !== form.owner
}

/** Only the fields that changed; taking the owner off sends `null`, which is not the same as leaving the owner alone. */
export function patchBody(initial: EditForm, form: EditForm): OrgPatchRequest {
  const body: OrgPatchRequest = {}
  if (form.lifecycle !== initial.lifecycle) body.lifecycle = form.lifecycle
  if (form.owner !== initial.owner) body.owner_user_id = form.owner === '' ? null : Number(form.owner)
  return body
}

/** Nobody, then the people of the organisation. The current owner is kept even when the list has not loaded or does not name them. */
export function ownerChoices(owners: readonly OwnerOption[], current: { owner_user_id: number | null; owner_name: string | null }): OwnerOption[] {
  const choices = [...owners]
  if (current.owner_user_id !== null && !choices.some((o) => o.id === String(current.owner_user_id))) {
    choices.unshift({ id: String(current.owner_user_id), name: current.owner_name ?? `User #${current.owner_user_id}` })
  }
  return choices
}
