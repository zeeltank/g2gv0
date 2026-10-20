import type { ProductOffer } from '@/services/portfolio/types'

/*
 * The Product Portfolio's create / edit form <-> the server's offer fields. Pure functions (no React) so they can be tested: the form never fills in a
 * value the person did not type, empty optional fields go to the server as null, and the checks mirror the server's (which stays the authority).
 */

export interface ProductFormState {
  offer_id: string
  name: string
  parent_product: string
  readiness_status: string
  what_it_does: string
  modules_components: string
  primary_segments: string[]
  needs_solved: string[]
  trigger_signals: string[]
  proof_points: string
  pricing_model: string
  typical_deal_band: string
  deployment_model: string
  implementation_effort: string
  delivery_owner: string
  notes: string
}

export type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>

export const emptyProductForm = (): ProductFormState => ({
  offer_id: '', name: '', parent_product: '', readiness_status: '', what_it_does: '', modules_components: '', primary_segments: [], needs_solved: [], trigger_signals: [],
  proof_points: '', pricing_model: '', typical_deal_band: '', deployment_model: '', implementation_effort: '', delivery_owner: '', notes: '',
})

export const fromOffer = (o: ProductOffer): ProductFormState => ({
  offer_id: o.offer_id,
  name: o.name,
  parent_product: o.parent_product ?? '',
  readiness_status: o.readiness_status ?? '',
  what_it_does: o.what_it_does ?? '',
  modules_components: o.modules_components ?? '',
  primary_segments: [...(o.primary_segments ?? [])],
  needs_solved: [...(o.needs_solved ?? [])],
  trigger_signals: [...(o.trigger_signals ?? [])],
  proof_points: o.proof_points ?? '',
  pricing_model: o.pricing_model ?? '',
  typical_deal_band: o.typical_deal_band ?? '',
  deployment_model: o.deployment_model ?? '',
  implementation_effort: o.implementation_effort ?? '',
  delivery_owner: o.delivery_owner ?? '',
  notes: o.notes ?? '',
})

const ID = /^[A-Za-z0-9._-]{1,50}$/

/** What is wrong with the form (empty when it can be sent). The server checks again and its answer is shown too. */
export function validateProductForm(f: ProductFormState, mode: 'create' | 'edit'): ProductFormErrors {
  const e: ProductFormErrors = {}
  if (mode === 'create') {
    if (!f.offer_id.trim()) e.offer_id = 'A product ID is required.'
    else if (!ID.test(f.offer_id.trim())) e.offer_id = 'Use letters, digits, dot, dash or underscore (up to 50 characters).'
  }
  if (!f.name.trim()) e.name = 'A name is required.'
  else if (f.name.trim().length > 191) e.name = 'At most 191 characters.'
  if (!f.parent_product.trim()) e.parent_product = 'Choose a category.'
  if (!f.readiness_status.trim()) e.readiness_status = 'Choose a status.'
  if (f.pricing_model.length > 191) e.pricing_model = 'At most 191 characters.'
  if (f.typical_deal_band.length > 50) e.typical_deal_band = 'At most 50 characters.'
  if (f.deployment_model.length > 100) e.deployment_model = 'At most 100 characters.'
  if (f.implementation_effort.length > 100) e.implementation_effort = 'At most 100 characters.'
  if (f.delivery_owner.length > 100) e.delivery_owner = 'At most 100 characters.'

  return e
}

const text = (v: string): string | null => (v.trim() === '' ? null : v.trim())

/** The body for POST (create) or PUT (edit: the Offer ID never changes). */
export function toPayload(f: ProductFormState, mode: 'create' | 'edit'): Record<string, unknown> {
  return {
    ...(mode === 'create' ? { offer_id: f.offer_id.trim() } : {}),
    name: f.name.trim(),
    parent_product: f.parent_product.trim(),
    readiness_status: f.readiness_status.trim(),
    what_it_does: text(f.what_it_does),
    modules_components: text(f.modules_components),
    primary_segments: f.primary_segments,
    needs_solved: f.needs_solved,
    trigger_signals: f.trigger_signals,
    proof_points: text(f.proof_points),
    pricing_model: text(f.pricing_model),
    typical_deal_band: text(f.typical_deal_band),
    deployment_model: text(f.deployment_model),
    implementation_effort: text(f.implementation_effort),
    delivery_owner: text(f.delivery_owner),
    notes: text(f.notes),
  }
}

/** The server's field errors (`ApiError.errors`: `{ field: [message] }`) as one message per field. */
export function serverErrors(errors: Record<string, string[] | string> | undefined | null): ProductFormErrors {
  const out: ProductFormErrors = {}
  if (!errors) return out
  for (const [k, v] of Object.entries(errors)) out[k as keyof ProductFormState] = Array.isArray(v) ? v[0] : String(v)

  return out
}

/** The confirmation shown before a product is deleted. */
export const deleteConfirmation = (name: string): string =>
  `Delete "${name}" from the Product Portfolio? This cannot be undone. If an ICP uses it, it will not be deleted until you remove it from that ICP.`

/** Adds or removes one code from a list (for the multi-select checkboxes). */
export const toggle = (list: string[], code: string): string[] => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code])
