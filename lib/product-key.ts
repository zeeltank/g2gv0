/*
 * The key and name of a new top-level product, as the form checks them before asking the server. The server's rules are the authority (it also
 * refuses a key a built-in product already uses and a name another product already has); these only catch what can be seen without it.
 * The key doubles as the stored `business_fit` value (20 characters at most) and as the ICP product line.
 */

export const PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9_]{2,19}$/
export const RESERVED_KEYS = ['all', 'unassigned', 'none', 'null', 'new', 'undefined']
export const MAX_LABEL = 50

/** A key proposed from the name: lower-case words joined by underscores, at most 20 characters. The person can change it. */
export function suggestKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '')

  return base.slice(0, 20).replace(/_+$/, '')
}

export interface NewProductErrors { key?: string; label?: string }

export function validateNewProduct(key: string, label: string): NewProductErrors {
  const e: NewProductErrors = {}
  const l = label.trim()
  if (l.length < 2) e.label = 'Give the product a name (at least 2 characters).'
  else if (l.length > MAX_LABEL) e.label = `At most ${MAX_LABEL} characters.`
  if (!PRODUCT_KEY_PATTERN.test(key)) e.key = 'Use 3 to 20 characters: lower-case letters, digits and underscores, starting with a letter.'
  else if (RESERVED_KEYS.includes(key)) e.key = 'This word is reserved. Choose another key.'

  return e
}

/** The server's field errors (`{ key: [..], label: [..], general: [..] }`) as one message per field, plus anything that belongs to neither. */
export function serverProblems(errors: Record<string, string[] | string> | undefined | null): { fields: NewProductErrors; general: string[] } {
  const one = (v: string[] | string | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

  return { fields: { key: one(errors?.key)[0], label: one(errors?.label)[0] }, general: one(errors?.general) }
}
