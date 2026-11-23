import type { MatchDecisionRow, MatchRow, MatchesData } from '../../services/product-master/portfolio-list-types'

/**
 * The answer of `GET /api/product-master/matches` for organisation 6 on the dev database, copied from the real dry run of `product-master:unify`
 * (Docs/agentic-crm/_evidence/s15/p2d-unify-dryrun-2026-11-13.txt, 13 Nov 2026): the nine live catalogue items, the verdicts, the scores, the reasons word for word, the usage
 * counts, the Sub-products they look like and the runner-up. Product names, SKUs and prices only: no person and no contact is in it. The shape is the one
 * `ProductMatchSuggester::suggest` builds (read in source: app/Domain/ProductMaster/ProductMatchSuggester.php, the `$rows[]` array at about line 731); keys the screen never
 * reads (`parts`, `rejected`, `state`, `thresholds`, `serviceRule`) are kept so the screen is proved against what the server really sends, not against a tidied copy.
 *
 * Not printed by the dry run, so written here by inference and said so: the master id of SCH-07 "School FTS / Digital Office" (52, the sequence of the Sub-product table),
 * the Sub-products' own Product id (1) and the `category` of the items other than the three the reasons name.
 */
const SCH_01 = { masterId: 46, offerRowId: 101, offerCode: 'SCH-01', name: 'Scholar School ERP', readiness: 'Prototype' }
const SCH_02 = { masterId: 47, offerRowId: 102, offerCode: 'SCH-02', name: 'Fees Intelligence & Decision Support', readiness: 'Live – with client' }
const SCH_03 = { masterId: 48, offerRowId: 103, offerCode: 'SCH-03', name: 'LMS-PAL (AI question generation)', readiness: 'In development' }
const SCH_07 = { masterId: 52, offerRowId: 107, offerCode: 'SCH-07', name: 'School FTS / Digital Office', readiness: 'Prototype' }

const usage = (parts: Partial<Record<'opp' | 'quote' | 'order' | 'inv' | 'pricebook' | 'campaign', number>>) => {
  const filled = { opp: 0, quote: 0, order: 0, inv: 0, pricebook: 0, campaign: 0, ...parts }
  return { ...filled, total: Object.values(filled).reduce((sum, n) => sum + n, 0) }
}

const item = (over: Partial<MatchRow> & Pick<MatchRow, 'itemMasterId' | 'crmId' | 'productNo' | 'name' | 'sku' | 'type' | 'price' | 'verdict'>): MatchRow => ({
  category: null, currency: 'INR', productId: 1, productName: 'ScholarClone', usage: usage({ pricebook: 3 }), candidate: null, score: 0, margin: 0, reasons: [], sharedWith: [], alternatives: [], ...over,
})

export const REAL_ITEMS: MatchRow[] = [
  item({
    itemMasterId: 66, crmId: 63, productNo: 'PRD-YBZIYOXY', name: 'Scholar One ERP - Gujarat Edition', sku: 'SCH-01-GUJ', category: 'School ERP', type: 'product', price: 120000, verdict: 'EDITION',
    usage: usage({ opp: 20, quote: 10, order: 8, inv: 8, pricebook: 3, campaign: 1 }), candidate: SCH_01, score: 98, margin: 98, sharedWith: [67],
    reasons: [
      "the category 'School ERP' is inside the Sub-product name (+40)",
      'the SKU SCH-01-GUJ holds the offer id SCH-01 (+30)',
      'the names share: erp (+12)',
      'the descriptions share 4 word(s): school, student, administration, fee (+16)',
      'item(s) 67 "Scholar Core School Management" have the same best Sub-product: they are cuts of one thing, choose which one is the pair',
    ],
    alternatives: [{ masterId: 46, offerCode: 'SCH-01', name: SCH_01.name, score: 98 }],
  }),
  item({
    itemMasterId: 67, crmId: 64, productNo: 'PRD-GUF4XAOI', name: 'Scholar Core School Management', sku: 'SCH-CORE-GUJ', category: 'School ERP', type: 'product', price: 75000, verdict: 'EDITION',
    usage: usage({ pricebook: 3 }), candidate: SCH_01, score: 60, margin: 48, sharedWith: [66],
    reasons: [
      "the category 'School ERP' is inside the Sub-product name (+40)",
      'the names share: school (+12)',
      'the descriptions share 2 word(s): student, admission (+8)',
      'item(s) 66 "Scholar One ERP - Gujarat Edition" have the same best Sub-product: they are cuts of one thing, choose which one is the pair',
    ],
    alternatives: [{ masterId: 46, offerCode: 'SCH-01', name: SCH_01.name, score: 60 }, { masterId: 52, offerCode: 'SCH-07', name: SCH_07.name, score: 12 }],
  }),
  item({
    itemMasterId: 68, crmId: 65, productNo: 'PRD-FN3XNIVX', name: 'Scholar CCB Fee Collection System', sku: 'SCH-CCB-GUJ', category: 'Fees Intelligence', type: 'product', price: 35000, verdict: 'AMBIGUOUS',
    usage: usage({ quote: 10, order: 4, inv: 4, pricebook: 3 }), candidate: SCH_02, score: 52, margin: 52,
    reasons: ["the category 'Fees Intelligence' is inside the Sub-product name (+40)", 'the names share: fee (+12)', 'weak: the score is below 55'],
    alternatives: [{ masterId: 47, offerCode: 'SCH-02', name: SCH_02.name, score: 52 }],
  }),
  item({
    itemMasterId: 69, crmId: 66, productNo: 'PRD-VDPTUTBD', name: 'Scholar LMS & Digital Classroom', sku: 'SCH-LMS-GUJ', type: 'product', price: 45000, verdict: 'AMBIGUOUS',
    usage: usage({ pricebook: 3, campaign: 1 }), candidate: SCH_03, score: 12, margin: 0,
    reasons: ['the names share: lms (+12)', 'weak: the score is below 55', 'close to the next Sub-product (School FTS / Digital Office, 12)'],
    alternatives: [{ masterId: 48, offerCode: 'SCH-03', name: SCH_03.name, score: 12 }, { masterId: 52, offerCode: 'SCH-07', name: SCH_07.name, score: 12 }],
  }),
  item({
    itemMasterId: 74, crmId: 71, productNo: 'SVC-QW5HKKSB', name: 'ScholarClone Faculty & Staff Certification Training', sku: 'SCH-SRV-TRN', type: 'service', price: 15000, verdict: 'SERVICE',
    reasons: ['a service is compared with Sub-products that say they are a service, and none of this Product does'],
  }),
  item({
    itemMasterId: 73, crmId: 70, productNo: 'SVC-FPF696XL', name: 'ScholarClone On-Premise & Cloud Implementation', sku: 'SCH-SRV-IMP', type: 'service', price: 25000, verdict: 'SERVICE',
    usage: usage({ quote: 10, order: 4, inv: 4, pricebook: 3 }),
    reasons: ['a service is compared with Sub-products that say they are a service, and none of this Product does'],
  }),
  item({ itemMasterId: 71, crmId: 68, productNo: 'PRD-O43M2MEE', name: 'Scholar Examination & CCE Report Engine', sku: 'SCH-EXAM-GUJ', type: 'product', price: 40000, verdict: 'NO-MATCH', reasons: ['no Sub-product of this Product reaches a score of 10'] }),
  item({ itemMasterId: 72, crmId: 69, productNo: 'PRD-UJMGTNLN', name: 'Scholar Fleet GPS Bus Tracking System', sku: 'SCH-BUS-GUJ', type: 'product', price: 50000, verdict: 'NO-MATCH', usage: usage({ pricebook: 3, campaign: 1 }), reasons: ['no Sub-product of this Product reaches a score of 10'] }),
  item({ itemMasterId: 70, crmId: 67, productNo: 'PRD-MYM5YFCQ', name: 'Scholar Smart Attendance & Biometric Access', sku: 'SCH-ATT-GUJ', type: 'product', price: 30000, verdict: 'NO-MATCH', reasons: ['no Sub-product of this Product reaches a score of 10'] }),
]

/** The three rows of the Recycle Bin, never paired (table 3 of the dry run). */
const BINNED = [
  { crmId: 6, productNo: 'PRD-6QLXYXCR', name: 'Enterprise License', type: 'product', price: 5000, state: 'binned', usage: usage({ quote: 1 }) },
  { crmId: 7, productNo: 'SVC-PWRONTNO', name: 'Onboarding Support', type: 'service', price: 1000, state: 'binned', usage: usage({ quote: 1 }) },
  { crmId: 8, productNo: 'PRD-V8VFRRHP', name: 'ZZ UI Widget', type: 'product', price: 250, state: 'binned', usage: usage({ quote: 1 }) },
]

/** The Sub-products no item names (table 2 of the dry run, the first of each Product). */
const UNMATCHED = [
  { masterId: 31, offerCode: 'G2G-01', name: 'Competency Framework Studio', productName: 'G2G', isService: false, readiness: 'Built – no production client' },
  { masterId: 41, offerCode: 'EB-01', name: 'Enterprise Brain Intelligence Layer', productName: 'Enterprise Brain', isService: false, readiness: 'Proven on real client data (pilot)' },
  { masterId: 49, offerCode: 'SCH-04', name: 'Career Intelligence & Counselling', productName: 'ScholarClone', isService: false, readiness: 'In development' },
]

/** The whole `data` of the answer: every item (nine), the verdict counts the dry run printed, and the thresholds. */
export function realMatchesData(over: { items?: MatchRow[]; decisions?: MatchDecisionRow[] } = {}): MatchesData & { thresholds: Record<string, number>; serviceRule: string } {
  const items = over.items ?? REAL_ITEMS
  const byVerdict: Record<string, number> = { 'MATCH-HIGH': 0, EDITION: 0, AMBIGUOUS: 0, SERVICE: 0, 'NO-MATCH': 0, STRAY: 0, 'JUNK?': 0 }
  for (const row of items) byVerdict[row.verdict] = (byVerdict[row.verdict] ?? 0) + 1
  return {
    matches: items,
    unmatchedSubProducts: UNMATCHED,
    binnedItems: BINNED,
    decisions: over.decisions ?? [],
    counts: { items: items.length, byVerdict },
    notes: [],
    thresholds: { floor: 10, high: 55, margin: 15, editionMin: 35 },
    serviceRule: '0 of 25 Sub-product offer(s) say they are a service (a whole word: service, training, implementation, consulting, consultancy, onboarding, in the name, what it does or the deployment model)',
  }
}
