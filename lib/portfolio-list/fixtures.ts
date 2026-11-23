import type {
  MatchDecisionRow, MatchRow, MatchesData, PortfolioCan, PortfolioListEnvelope, PortfolioRow,
} from '../../services/product-master/portfolio-list-types'

/** Rows and answers in the shape of the real API (hp_erp `GET /api/product-master/list` and `/matches`), as the dev data of organisation 6 looks. */

export const ADMIN_CAN: PortfolioCan = { createProduct: true, createSubProduct: true, editSubProduct: true, viewSell: true, confirmMatches: true }
/** A person who may open the Portfolio and nothing priced (HR): no Sell columns, no Sold in CRM, no bulk bar, no review. */
export const HR_CAN: PortfolioCan = { createProduct: false, createSubProduct: true, editSubProduct: true, viewSell: false, confirmMatches: false }
/** A sales profile: Sell only, no administrator rights. */
export const SALES_CAN: PortfolioCan = { createProduct: false, createSubProduct: true, editSubProduct: true, viewSell: true, confirmMatches: false }

const base = (over: Partial<PortfolioRow>): PortfolioRow => ({
  id: 0, kind: 'sub_product', name: '', key: '', status: 'active', productId: null, productName: null, type: null, state: 'not_sold', readiness: null,
  signalsFound: null, icp: null, hasAbout: true, hasSell: false, needsProduct: false, shared: false, subProductCount: null, ...over,
})

export const product = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 1, kind: 'product', name: 'ScholarClone', key: 'scholarclone', state: null, hasAbout: false, subProductCount: 3, signalsFound: 31, icp: 'active', ...over,
})

/** A Sub-product with an About and no Sell (HR sees it exactly like this). */
export const aboutOnly = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 10, name: 'Scholar School ERP', key: 'scholarclone/sch-01', productId: 1, productName: 'ScholarClone', readiness: 'Prototype', signalsFound: 4, icp: 'active', ...over,
})

/** A Sub-product that is sold in CRM, with the Sell keys the API sends a caller who may view them. */
export const sold = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 11, name: 'Fees Intelligence', key: 'scholarclone/sch-02', productId: 1, productName: 'ScholarClone', type: 'product', state: 'sold', hasSell: true,
  readiness: 'Live – with client', signalsFound: 2, icp: 'draft', sku: 'SCH-02', category: 'School ERP', qtyInStock: 12.5, unitPrice: 120000, currency: 'INR', ...over,
})

/** A catalogue-only entry (a Sub-product with no About). */
export const entry = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 14, kind: 'item', name: 'Scholar One ERP - Gujarat Edition', key: 'crm/prd-w1', productId: 1, productName: 'ScholarClone', type: 'product', state: 'sold', hasAbout: false, hasSell: true,
  sku: 'SCH-01-GUJ', category: 'School ERP', qtyInStock: null, unitPrice: 95000, currency: 'INR', ...over,
})

export const service = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 15, kind: 'item', name: 'ScholarClone Implementation', key: 'crm/svc-1', productId: 1, productName: 'ScholarClone', type: 'service', state: 'paused', hasAbout: false, hasSell: true,
  sku: 'SVC-1', category: 'Consulting', qtyInStock: null, unitPrice: 40000, currency: 'INR', ...over,
})

/** A Sub-product under no Product yet. */
export const stray = (over: Partial<PortfolioRow> = {}): PortfolioRow => base({
  id: 20, kind: 'item', name: 'Imported widget', key: 'crm/prd-9', needsProduct: true, type: 'product', state: 'sold', hasAbout: false, hasSell: true,
  sku: 'W-1', category: null, qtyInStock: 3, unitPrice: 10, currency: 'INR', ...over,
}) as PortfolioRow

export const shared = (over: Partial<PortfolioRow> = {}): PortfolioRow => product({ id: 2, name: 'Enterprise Brain', key: 'enterprise_brain', shared: true, subProductCount: 5, ...over })

export function envelope(rows: PortfolioRow[], can: PortfolioCan = ADMIN_CAN, over: Partial<PortfolioListEnvelope['meta']> = {}): PortfolioListEnvelope {
  return { status: 1, data: rows, meta: { available: true, total: rows.length, page: 1, perPage: 20, lastPage: 1, can, ...over } }
}

/** The page of the dev data an administrator opens: a Product, three Sub-products (About only, sold, a service), then the Shared Product and a stray. */
export function adminRows(): PortfolioRow[] {
  return [product(), aboutOnly(), sold(), service(), shared(), stray()]
}

/** The same page for HR: the Sell keys are absent, the state is still sent. */
export function hrRows(): PortfolioRow[] {
  const strip = (r: PortfolioRow): PortfolioRow => {
    const copy = { ...r }
    for (const key of ['sku', 'category', 'qtyInStock', 'unitPrice', 'currency'] as const) delete copy[key]
    return copy
  }
  return adminRows().map(strip)
}

// ---------------------------------------------------------------------------------------------------------------------------- the pair review

export const match = (over: Partial<MatchRow> = {}): MatchRow => ({
  itemMasterId: 31, crmId: 63, productNo: 'PRD-0063', name: 'Scholar One ERP - Gujarat Edition', sku: 'SCH-01-GUJ', category: 'School ERP', type: 'product', price: 95000, currency: 'INR',
  productId: 1, productName: 'ScholarClone', usage: { quotes: 3, total: 3 }, verdict: 'AMBIGUOUS',
  candidate: { masterId: 10, offerRowId: 5, offerCode: 'SCH-01', name: 'Scholar School ERP', readiness: 'Prototype' },
  score: 52, margin: 8, reasons: ['category “School ERP” is inside the Sub-product name', '“erp” is in both'], sharedWith: [],
  alternatives: [{ masterId: 10, offerCode: 'SCH-01', name: 'Scholar School ERP', score: 52 }], ...over,
})

export const decision = (over: Partial<MatchDecisionRow> = {}): MatchDecisionRow => ({
  id: 1, itemMasterId: 40, itemName: 'Old CCB Fees', survivorMasterId: 11, survivorName: 'Fees Intelligence', decision: 'different', score: 12, signals: 'weak', nameKept: null, decidedBy: 2, decidedAt: '2026-11-13 10:00:00', ...over,
})

export function matchesData(matches: MatchRow[], decisions: MatchDecisionRow[] = []): MatchesData {
  const byVerdict: Record<string, number> = {}
  for (const m of matches) byVerdict[m.verdict] = (byVerdict[m.verdict] ?? 0) + 1
  return { matches, unmatchedSubProducts: [], binnedItems: [], decisions, counts: { items: matches.length, byVerdict }, notes: [] }
}

/** An entry with nothing to decide (no Sub-product it looks like). */
export const noMatch = (over: Partial<MatchRow> = {}): MatchRow => match({ itemMasterId: 33, crmId: 65, name: 'Smart Attendance', verdict: 'NO-MATCH', candidate: null, score: 0, reasons: [], alternatives: [], ...over })
