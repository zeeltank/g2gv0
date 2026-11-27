import type { OutreachFacetOption, OutreachFacets, OutreachFilterQuery, OutreachSubProductOption } from '../../services/signals/outreach-types'

/**
 * The four filters of the Outreach tab, worked out here the way the server's OutreachFacets class works them out (docs/agentic-crm/briefs/OUTREACH-FILTERS-CONTRACT.md), so the fake
 * service and the Messages stand-in filter FOR REAL and the screen tests exercise the filtering, not a canned answer. It is a stand-in for the server and used by tests only.
 *
 * A row has a SET of values per filter. A filter passes a row when the set holds the value; the value `none` passes a row whose set is EMPTY ("Not recorded"); the filters are
 * ANDed; a value nobody holds matches nothing and is no error. The options of each filter are counted with the OTHER three filters applied and not itself.
 */

/** The sets of one row: product ids, sub-product ids (or `offer:CODE`), `b2b`/`b2c`/`b2g`, and region keys. */
export interface FacetSets {
  products: string[]
  subProducts: string[]
  icps: string[]
  regions: string[]
}

export const NO_SETS: FacetSets = { products: [], subProducts: [], icps: [], regions: [] }

export interface FacetCatalog {
  products: Readonly<Record<string, string>>
  subProducts: Readonly<Record<string, { label: string; productId: string | null }>>
  icps: Readonly<Record<string, string>>
  /** Region key -> the first spelling seen. */
  regions: Readonly<Record<string, string>>
}

type FacetName = 'products' | 'subProducts' | 'icps' | 'regions'
const FACETS: ReadonlyArray<{ name: FacetName; param: keyof OutreachFilterQuery }> = [
  { name: 'products', param: 'product' }, { name: 'subProducts', param: 'sub_product' }, { name: 'icps', param: 'icp' }, { name: 'regions', param: 'region' },
]
const NONE = 'none'
const REGION_LIMIT = 50
const ICP_ORDER = ['b2b', 'b2c', 'b2g']

/** Does a row's sets pass the filters? `skip` leaves one filter out, which is how an option is counted without its own filter applied. */
export function passes(sets: FacetSets, filters: OutreachFilterQuery, skip?: FacetName): boolean {
  return FACETS.every(({ name, param }) => {
    const wanted = filters[param]
    if (!wanted || name === skip) return true
    if (wanted === NONE) return sets[name].length === 0

    return sets[name].includes(wanted)
  })
}

/** The rows that pass all four filters. */
export function narrow<T>(rows: readonly T[], setsOf: (row: T) => FacetSets, filters: OutreachFilterQuery): T[] {
  return rows.filter((row) => passes(setsOf(row), filters))
}

const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

/** The options of the four filters with their counts, over `rows` BEFORE any chip, search or paging. */
export function computeFacets<T>(rows: readonly T[], setsOf: (row: T) => FacetSets, filters: OutreachFilterQuery, catalog: FacetCatalog): OutreachFacets {
  const counted = (name: FacetName) => {
    const pool = rows.filter((row) => passes(setsOf(row), filters, name))
    const counts = new Map<string, number>()
    let notRecorded = 0
    for (const row of pool) {
      const set = setsOf(row)[name]
      if (set.length === 0) notRecorded += 1
      for (const value of new Set(set)) counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    return { counts, notRecorded }
  }
  const chosen = (name: FacetName) => filters[FACETS.find((facet) => facet.name === name)!.param]
  /** An option with no rows is left out unless it is the chosen one. */
  const keep = (name: FacetName, values: Map<string, number>): Array<[string, number]> => {
    const wanted = chosen(name)
    const entries = [...values.entries()].filter(([, count]) => count > 0)
    if (wanted && wanted !== NONE && !values.has(wanted)) entries.push([wanted, 0])

    return entries
  }

  const products = counted('products')
  const subProducts = counted('subProducts')
  const icps = counted('icps')
  const regions = counted('regions')

  const productOptions: OutreachFacetOption[] = keep('products', products.counts).map(([value, count]) => ({ value, label: catalog.products[value] ?? value, count })).sort(byName)
  const subProductOptions: OutreachSubProductOption[] = keep('subProducts', subProducts.counts).map(([value, count]) => {
    const known = catalog.subProducts[value]

    return { value, label: known?.label ?? (value.startsWith('offer:') ? value.slice('offer:'.length) : value), count, productId: known?.productId ? Number(known.productId) : null }
  }).sort(byName)
  const icpOptions: OutreachFacetOption[] = keep('icps', icps.counts).map(([value, count]) => ({ value, label: catalog.icps[value] ?? value, count }))
    .sort((a, b) => ICP_ORDER.indexOf(a.value) - ICP_ORDER.indexOf(b.value))
  const wantedRegion = chosen('regions')
  const regionAll = keep('regions', regions.counts).map(([value, count]) => ({ value, label: catalog.regions[value] ?? value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const regionOptions: OutreachFacetOption[] = regionAll.slice(0, REGION_LIMIT)
  const selected = regionAll.find((option) => option.value === wantedRegion)
  if (selected && !regionOptions.includes(selected)) regionOptions.push(selected)

  return {
    products: productOptions,
    subProducts: subProductOptions,
    icps: icpOptions,
    regions: regionOptions,
    notRecorded: { products: products.notRecorded, subProducts: subProducts.notRecorded, icps: icps.notRecorded, regions: regions.notRecorded },
    active: { product: filters.product ?? null, subProduct: filters.sub_product ?? null, icp: filters.icp ?? null, region: filters.region ?? null },
  }
}

/** The four filters a request holds, as the engine reads them (only the ones that are set). */
export function filtersOf(query: Partial<Record<keyof OutreachFilterQuery, unknown>>): OutreachFilterQuery {
  const out: OutreachFilterQuery = {}
  for (const { param } of FACETS) {
    const value = query[param]
    if (typeof value === 'string' && value !== '') out[param] = value
  }

  return out
}

export const hasFilters = (filters: OutreachFilterQuery): boolean => FACETS.some(({ param }) => Boolean(filters[param]))
