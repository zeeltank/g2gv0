import type { OutreachPerson } from '../../services/signals/outreach-types'
import { message } from '../outreach/fixtures'
import { computeFacets, filtersOf, narrow, NO_SETS, type FacetCatalog, type FacetSets } from './outreach-facet-engine'

/**
 * What the Outreach tab's four filters (Product, Sub-product, ICP, Region) are tested against: a small catalog and, for each fixture row, the SETS of values the server would work out
 * for it (docs/agentic-crm/briefs/OUTREACH-FILTERS-CONTRACT.md). The rows themselves (lib/signals/outreach-fixtures.ts) are the server's company and person rows, which carry none of
 * this: the sets live beside them, by id, exactly as the server keeps them beside the row. Most real signals lack one or more of these values, so some rows here lack them on purpose.
 *
 *   company 1 Riverdale Public School  two products (School ERP and Scholar Core), three sub-products (two of the first, one of the second), B2B, Gujarat and Ahmedabad
 *   company 2 Sunrise Academy          product Scholar Core, one sub-product and a code no product holds, B2C, Maharashtra and Nagpur
 *   company 3 Greenfield Traders       NOTHING recorded for product, sub-product or ICP; Gujarat and Surat
 */

export const PRODUCT_ERP = '11'
export const PRODUCT_CORE = '12'
export const PRODUCT_CRM = '13'
export const SUB_FEES = '21'
export const SUB_TIMETABLE = '22'
export const SUB_EXAMS = '23'
/** A sub-product code that no product master holds. */
export const SUB_CODE = 'offer:G2G-09'

export const FACET_CATALOG: FacetCatalog = {
  products: { [PRODUCT_ERP]: 'School ERP', [PRODUCT_CORE]: 'Scholar Core', [PRODUCT_CRM]: 'Admissions CRM' },
  subProducts: {
    [SUB_FEES]: { label: 'Fees and accounts', productId: PRODUCT_ERP },
    [SUB_TIMETABLE]: { label: 'Timetable', productId: PRODUCT_ERP },
    [SUB_EXAMS]: { label: 'Exam portal', productId: PRODUCT_CORE },
    [SUB_CODE]: { label: 'Legacy bundle', productId: null },
  },
  icps: { b2b: 'B2B: Private organisations', b2c: 'B2C: Consumers', b2g: 'B2G: Government and tenders' },
  regions: { gujarat: 'Gujarat', ahmedabad: 'Ahmedabad', surat: 'Surat', maharashtra: 'Maharashtra', nagpur: 'Nagpur', india: 'India' },
}

const COMPANY_SETS: Readonly<Record<number, FacetSets>> = {
  1: { products: [PRODUCT_ERP, PRODUCT_CORE], subProducts: [SUB_FEES, SUB_TIMETABLE, SUB_EXAMS], icps: ['b2b'], regions: ['gujarat', 'ahmedabad'] },
  2: { products: [PRODUCT_CORE], subProducts: [SUB_EXAMS, SUB_CODE], icps: ['b2c'], regions: ['maharashtra', 'nagpur'] },
  3: { products: [], subProducts: [], icps: [], regions: ['gujarat', 'surat'] },
}

/** A person's sets: their company's, plus their own place when it says something the company's does not (a person added by hand in another city). */
const PERSON_OWN_REGIONS: Readonly<Record<number, string[]>> = { 12: ['ahmedabad'] }

export function companySets(id: number): FacetSets {
  return COMPANY_SETS[id] ?? NO_SETS
}

export function personSets(person: Pick<OutreachPerson, 'id' | 'company_id'>): FacetSets {
  const company = companySets(person.company_id)
  const own = PERSON_OWN_REGIONS[person.id] ?? []

  return { ...company, regions: [...new Set([...company.regions, ...own])] }
}

/**
 * The queue's rows, with the sets of each. Message 14 is to a contact that is not a signal contact, so it has nothing recorded for any of the four filters; message 13's own product
 * (a product master id) is authoritative for Product, and its ICP and Region come from the person it is addressed to.
 */
export const MESSAGE_ROWS = [
  message({ id: 11, status: 'approved', contact_name: 'Asha Menon', account_name: 'Hillcrest Academy', subject: 'A quick idea for Hillcrest' }),
  message({ id: 12, status: 'draft', contact_id: 22, contact_name: 'Ravi Shah', contact_email: 'ravi@greenfield.example', account_name: 'Greenfield Traders', subject: 'Fees without paper' }),
  message({ id: 13, status: 'sent', contact_id: 23, contact_name: 'Meera Patel', contact_email: 'principal@riverdale.example', account_name: 'Riverdale Public School', subject: 'Following up on the timetable', sent_at: '2026-11-20 10:00:00' }),
  message({ id: 14, status: 'draft', contact_id: 24, contact_name: 'Walk-in lead', contact_email: 'walkin@example.net', account_name: 'Walk-in Traders', subject: 'Thank you for visiting' }),
  message({ id: 15, status: 'approved', contact_id: 25, contact_name: 'Anita Rao', contact_email: 'anita@sunrise.example', account_name: 'Sunrise Academy', subject: 'Exams without the rush' }),
]

export const MESSAGE_SETS: Readonly<Record<number, FacetSets>> = {
  11: { products: [PRODUCT_ERP], subProducts: [SUB_FEES], icps: ['b2b'], regions: ['gujarat', 'ahmedabad'] },
  12: { products: [PRODUCT_CORE], subProducts: [], icps: [], regions: ['gujarat', 'surat'] },
  13: { products: [PRODUCT_ERP], subProducts: [SUB_TIMETABLE], icps: ['b2b'], regions: ['gujarat', 'ahmedabad'] },
  14: NO_SETS,
  15: { products: [PRODUCT_CORE], subProducts: [SUB_EXAMS], icps: ['b2c'], regions: ['maharashtra', 'nagpur'] },
}

export const messageSets = (row: { id: unknown }): FacetSets => MESSAGE_SETS[Number(row.id)] ?? NO_SETS

/**
 * GET /api/gtm/outreach as the server answers it once the four filters exist: the rows that pass them (and the status asked for), the status `counts` of the rows the FILTERS leave
 * (so a tab's number is what that tab would show), and the options of each filter beside them. `setsOf` and `rows` are replaceable so a test can give one message two products.
 */
export function queueAnswer(query: URLSearchParams, setsOf: (row: { id: unknown }) => FacetSets = messageSets, rows: typeof MESSAGE_ROWS = MESSAGE_ROWS) {
  const filters = filtersOf(Object.fromEntries(query.entries()))
  const narrowed = narrow(rows, setsOf, filters)
  const counts: Record<string, number> = {}
  for (const row of narrowed) counts[String(row.status)] = (counts[String(row.status)] ?? 0) + 1
  const status = query.get('status')

  return { status: 1, data: { items: status ? narrowed.filter((row) => row.status === status) : narrowed, counts, facets: computeFacets(rows, setsOf, filters, FACET_CATALOG) } }
}
