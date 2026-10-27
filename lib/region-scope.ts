/*
 * The geography one Generate Signals request is limited to. [] means "All Regions" (the existing behaviour, nothing is sent). The server validates
 * and normalises every selection again and is the authority; these checks only stop an obviously unusable choice before a request is made.
 * Nothing here is saved on a product or its ICP.
 */

export interface RegionSelection {
  country: string
  state?: string
  city?: string
}

export const MAX_REGIONS = 5
const NAME = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'’()-]*$/u

const clean = (v: string | undefined): string | undefined => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim()
  return t === '' ? undefined : t
}

/** The country names the browser knows, from its own locale data (no list is built into the app, and no country is favoured). */
export function countryOptions(locale = 'en'): { code: string; name: string }[] {
  let names: Intl.DisplayNames
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    return []
  }
  const out: { code: string; name: string }[] = []
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      let name: string | undefined
      try { name = names.of(code) } catch { name = undefined }
      // An unassigned code comes back as itself; a few are not countries at all.
      if (name && name !== code && !/^Unknown/i.test(name)) out.push({ code, name })
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name))
}

/** What is wrong with a selection (empty when it can be added). Country, then state/province, then city: a city needs its state. */
export function problemsWith(sel: RegionSelection): string[] {
  const out: string[] = []
  const country = clean(sel.country)
  const state = clean(sel.state)
  const city = clean(sel.city)
  if (!country) out.push('Choose a country.')
  for (const [label, v] of [['Country', country], ['State / province', state], ['City', city]] as const) {
    if (v !== undefined && (v.length < 2 || v.length > 80 || !NAME.test(v))) out.push(`${label}: 2 to 80 characters; letters, digits, spaces and . , ' ( ) - only.`)
  }
  if (city && !state) out.push('A city needs its state / province: choose the state first.')
  return out
}

const key = (s: RegionSelection) => [s.country, s.state ?? '', s.city ?? ''].map((x) => x.toLowerCase()).join('|')

/** The selection with spaces tidied and empty levels removed. */
export function normalise(sel: RegionSelection): RegionSelection {
  const country = clean(sel.country) as string
  const state = clean(sel.state)
  const city = clean(sel.city)
  return { country, ...(state ? { state } : {}), ...(state && city ? { city } : {}) }
}

/** Adds one selection (unless it is unusable, already chosen, or the list is full). Returns the new list and why nothing was added. */
export function addSelection(list: RegionSelection[], sel: RegionSelection): { list: RegionSelection[]; problems: string[] } {
  const problems = problemsWith(sel)
  if (problems.length > 0) return { list, problems }
  if (list.length >= MAX_REGIONS) return { list, problems: [`Choose at most ${MAX_REGIONS} places.`] }
  const next = normalise(sel)
  if (list.some((x) => key(x) === key(next))) return { list, problems: [] }
  return { list: [...list, next], problems: [] }
}

export const removeSelection = (list: RegionSelection[], index: number): RegionSelection[] => list.filter((_, i) => i !== index)

/** "Surat, Gujarat, India" or "All Regions". */
export function regionLabel(list: RegionSelection[]): string {
  if (list.length === 0) return 'All Regions'
  return list.map((s) => [s.city, s.state, s.country].filter(Boolean).join(', ')).join('; ')
}

/** A short form for the control itself: the first place, and how many more. */
export function regionShortLabel(list: RegionSelection[]): string {
  if (list.length === 0) return 'All Regions'
  const first = [list[0].city, list[0].state, list[0].country].filter(Boolean)[0] as string
  return list.length === 1 ? first : `${first} +${list.length - 1}`
}

/** The request body part: nothing at all for All Regions, so an unchanged request is byte-for-byte the one that was always sent. */
export function regionsPayload(list: RegionSelection[]): { regions?: RegionSelection[] } {
  return list.length === 0 ? {} : { regions: list.map(normalise) }
}
