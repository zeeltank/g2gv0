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
  /** Target customers: codes from the list the person ticked, and their own entries ("Other"), in one list. */
  primary_segments: string[]
  /** Customer problems solved, in the person's own words: one per line. */
  problems: string
  /** Older problem codes (N01...) a product already carries. Kept as they are; the person can remove them. */
  legacy_needs: string[]
  /** Buying events: signal families ticked, older event codes, and the person's own entries ("Other"), in one list. */
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
  offer_id: '', name: '', parent_product: '', readiness_status: '', what_it_does: '', modules_components: '', primary_segments: [], problems: '', legacy_needs: [], trigger_signals: [],
  proof_points: '', pricing_model: '', typical_deal_band: '', deployment_model: '', implementation_effort: '', delivery_owner: '', notes: '',
})

/** An older problem code such as N13. */
export const LEGACY_NEED = /^N\d{2}$/

export const MAX_PROBLEMS = 60
export const MAX_PROBLEM_LENGTH = 400
export const MAX_ENTRY_LENGTH = 160

/** A product's stored problem list as the form holds it: older codes kept apart, the person's own words one per line. */
export function splitNeeds(list: string[]): { codes: string[]; text: string } {
  const codes = list.filter((n) => LEGACY_NEED.test(n))

  return { codes, text: list.filter((n) => !LEGACY_NEED.test(n)).join('\n') }
}

/** The problems typed in the text box: one per line, trimmed, without blanks or repeats. */
export function problemLines(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || seen.has(line.toLowerCase())) continue
    seen.add(line.toLowerCase())
    out.push(line)
  }

  return out
}

/** The entries in a list that are not on the known list: what the person added themselves ("Other"). */
export const customEntries = (list: string[], known: string[]): string[] => list.filter((x) => !known.includes(x))

/** Adds the person's own entry once (ignoring case), trimmed and no longer than the server allows. Blank adds nothing. */
export function addCustom(list: string[], raw: string): string[] {
  const entry = raw.trim().slice(0, MAX_ENTRY_LENGTH)
  if (entry === '' || list.some((x) => x.toLowerCase() === entry.toLowerCase())) return list

  return [...list, entry]
}

export const removeEntry = (list: string[], entry: string): string[] => list.filter((x) => x !== entry)

export const fromOffer = (o: ProductOffer): ProductFormState => ({
  offer_id: o.offer_id,
  name: o.name,
  parent_product: o.parent_product ?? '',
  readiness_status: o.readiness_status ?? '',
  what_it_does: o.what_it_does ?? '',
  modules_components: o.modules_components ?? '',
  primary_segments: [...(o.primary_segments ?? [])],
  problems: splitNeeds(o.needs_solved ?? []).text,
  legacy_needs: splitNeeds(o.needs_solved ?? []).codes,
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
  const problems = problemLines(f.problems)
  if (problems.length + f.legacy_needs.length > MAX_PROBLEMS) e.problems = `At most ${MAX_PROBLEMS} problems.`
  else if (problems.some((p) => p.length > MAX_PROBLEM_LENGTH)) e.problems = `Each problem can be up to ${MAX_PROBLEM_LENGTH} characters. Put each one on its own line.`
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
    // Older codes the product already had, then the problems in the person's own words.
    needs_solved: [...f.legacy_needs, ...problemLines(f.problems)],
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
