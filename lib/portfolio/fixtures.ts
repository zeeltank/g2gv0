import type { PmListData, PmMeta, PmCan } from '../../services/product-master/types'
import type { PmFullRecord, PmHistoryRow, PmListRow, PmRemovalBlock, PmRemovalPreview, PmSell, PmUsageFull } from '../../services/product-master/record-types'
import type { TaxonomyData } from '../../services/portfolio/types'
import { CURRENCIES } from '../money/currencies'

/** Data for the unified Product Portfolio form and pages: the shapes hp_erp's ProductMasterController answers (read from the code on 14 Nov 2026). */

export function sellRow(over: Partial<PmSell> = {}): PmSell {
  return {
    state: 'sold', crmProductId: 301, productNo: 'PRD-AAAA1111', type: 'product', sku: 'SCH-FEE', category: 'Software', glAccount: '4000', descriptionOnQuotes: 'Fee collection licence',
    unitPrice: 1500, costPrice: 900, commissionRate: 5, currency: 'INR', taxRateId: 3, taxPercent: 18, isActive: true, vendor: 'Acme', qtyInStock: 12, qtyInDemand: 2, reorderLevel: 4, weight: 1.5,
    usageUnit: 'licence', assignedTo: 2, imageUrl: null, taxRateName: 'GST', productMasterId: 1, createdBy: 2, createdAt: '2026-11-01 10:00:00', updatedAt: '2026-11-02 10:00:00', ...over,
  }
}

export function fullRecord(over: Partial<PmFullRecord> = {}): PmFullRecord {
  const about = {
    whatItDoes: 'Collects school fees online.', modulesComponents: 'Invoices, receipts', deploymentModel: 'cloud', proofPoints: 'Used by 12 schools', notes: null,
    needsSolved: ['Late fee collection', 'Manual receipts', 'N07'], primarySegments: ['k12'], triggerSignals: ['funding'], pricingModel: 'Per student', typicalDealBand: '1-5 lakh',
    implementationEffort: '4 weeks', deliveryOwner: 'Delivery team', oftenSoldTogether: ['SCH-12'],
  }
  return {
    id: 11, key: 'scholarclone/sch-11', name: 'Fee Collection', kind: 'sub_product', status: 'active', origin: 'portfolio', shared: false, signalKey: null, portfolioName: null,
    parent: { id: 1, key: 'scholarclone', name: 'ScholarClone' }, subProducts: [],
    offer: { id: 501, offerId: 'SCH-11', name: 'Fee Collection', product: 'Scholar K-12', readiness: 'Live – with client', readinessConfirmed: false, about },
    crmProduct: { id: 301, productNo: 'PRD-AAAA1111', name: 'Fee Collection', sku: 'SCH-FEE', type: 'product', glAccount: '4000', unitPrice: 1500, currency: 'INR', taxRateId: 3, active: true },
    sell: sellRow(), about, icp: 'active', createdAt: '2026-11-01 10:00:00', updatedAt: '2026-11-02 10:00:00', ...over,
  }
}

/** The same record as a caller who may not view prices receives it (HR): no Sell section at all. */
export function hrRecord(over: Partial<PmFullRecord> = {}): PmFullRecord {
  return fullRecord({ crmProduct: null, sell: null, ...over })
}

export function productRecord(over: Partial<PmFullRecord> = {}): PmFullRecord {
  return fullRecord({
    id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', shared: false, signalKey: 'scholar', portfolioName: 'Scholar K-12', parent: null, offer: null, crmProduct: null, sell: null,
    about: null, icp: null, subProducts: [{ id: 11, key: 'scholarclone/sch-11', name: 'Fee Collection', status: 'active' }, { id: 12, key: 'scholarclone/sch-12', name: 'Admissions', status: 'active' }], ...over,
  })
}

export function can(over: Partial<PmCan> = {}): PmCan {
  return {
    createProduct: true, createSubProduct: true, createItem: { product: true, service: true }, sellInCrm: { product: true, service: true },
    editSubProduct: true, editItem: { product: true, service: true }, archive: true, archiveProduct: true, restore: true, restoreProduct: true, ...over,
  }
}

export function meta(over: Partial<PmMeta> = {}, canOver: Partial<PmCan> = {}): PmMeta {
  return {
    readinessStatuses: ['Proposal / concept', 'Prototype', 'Live – with client'], itemTypes: ['product', 'service'], taxRates: [{ id: 3, name: 'GST', percentage: 18, currency: 'INR' }],
    currencies: [...CURRENCIES], defaultCurrency: 'INR', can: can(canOver), ...over,
  }
}

/** A caller with the Portfolio's right and no row on Products or Services (HR): she may add and edit an About and sell nothing. */
export const hrCan: Partial<PmCan> = { createProduct: false, createItem: { product: false, service: false }, sellInCrm: { product: false, service: false }, editItem: { product: false, service: false }, archive: false, archiveProduct: false, restore: false, restoreProduct: false }

export function taxonomy(): TaxonomyData {
  return {
    needs: { N07: 'Fees are collected late' }, segments: { k12: 'K-12 schools', he: 'Higher education' }, signals: { funding_old: 'Funding (older code)' },
    signal_families: { funding: { label: 'Funding or budget', examples: 'A grant, a tender', relevance: 'A buyer with money' }, leadership: { label: 'Leadership change', examples: 'A new head', relevance: 'New people buy' } },
    parent_products: { 'Scholar K-12': 'Scholar K-12' }, readiness_statuses: { 'Proposal / concept': 'Proposal / concept', Prototype: 'Prototype', 'Live – with client': 'Live – with client' }, partner_sellable_readiness: ['Live – with client'],
    deployment_models: { cloud: 'Cloud', onprem: 'On premise' }, deal_bands: {}, geographies: {},
  } as TaxonomyData
}

/** `GET /product-master` (the S1 list, every status): the Products with their Sub-products, which the form reads for its choices. */
export function everything(): { status: number; data: PmListData } {
  const sub = (id: number, name: string, offerId: string) => ({ id, key: `scholarclone/${offerId.toLowerCase()}`, name, status: 'active' as const, origin: 'portfolio', offerId, readiness: 'Live – with client', soldInCrm: false, crmProductId: null, crmItemType: null, signalsFound: 0, icp: 'none' as const })
  return {
    status: 1,
    data: {
      available: true,
      products: [
        { id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', status: 'active', origin: 'builtin', shared: true, signalKey: 'scholar', portfolioName: 'Scholar K-12', subProductCount: 3, soldInCrmCount: 0, signalsFound: 0, icp: 'template', subProducts: [sub(11, 'Fee Collection', 'SCH-11'), sub(12, 'Admissions', 'SCH-12'), sub(13, 'Timetable', 'SCH-13')] },
        { id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', kind: 'product', status: 'active', origin: 'custom', shared: false, signalKey: 'payroll_cloud', portfolioName: null, subProductCount: 0, soldInCrmCount: 0, signalsFound: 0, icp: 'none', subProducts: [] },
      ],
      items: [], totals: { products: 2, subProducts: 3, items: 0 },
    },
  }
}

export function usageFull(over: Partial<PmUsageFull> = {}): PmUsageFull {
  return {
    signals: 4, icp: 'active', quotes: 2, basePrice: 1500, currency: 'INR',
    counts: { quotes: 2, salesOrders: 1, invoices: 1, opportunities: 3, bundleParts: 0, usedInBundles: 0, tickets: 0, assets: 0, faqs: 0, campaigns: 0 },
    pointers: null,
    latest: {
      quotes: [{ id: 91, number: 'Q-0091', date: '2026-11-03', status: 'Sent' }, { id: 90, number: 'Q-0090', date: '2026-11-01', status: 'Draft' }],
      salesOrders: [{ id: 41, number: 'SO-0041', date: '2026-11-04', status: 'Open' }], invoices: [{ id: 17, number: 'INV-0017', date: '2026-11-05', status: 'Paid' }],
    },
    ...over,
  }
}

export function historyRow(over: Partial<PmHistoryRow> = {}): PmHistoryRow {
  return { at: '2026-11-02 10:00:00', by: 'Asha Rao', byId: 2, store: 'sell', event: 'updated', type: 'crm.product.updated', changes: [{ field: 'unit_price', old: 1400, new: 1500 }], ...over }
}

export function listRow(over: Partial<PmListRow> = {}): PmListRow {
  return {
    id: 11, kind: 'sub_product', name: 'Fee Collection', key: 'scholarclone/sch-11', status: 'active', productId: 1, productName: 'ScholarClone', type: 'product', state: 'sold', readiness: 'Live – with client',
    signalsFound: 4, icp: 'active', hasAbout: true, hasSell: true, needsProduct: false, shared: false, subProductCount: null, ...over,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- delete and move (contract 4.1)

export const SOLD_BLOCK: PmRemovalBlock = { code: 'sold_on_documents', count: 3, message: '3 quotes or orders hold it.' }
export const POINTER_BLOCK: PmRemovalBlock = { code: 'records_point_at_it', count: 12, message: '12 leads and 2 tickets point at it.' }
export const SUBS_BLOCK: PmRemovalBlock = { code: 'has_sub_products_blocked', count: 1, message: '1 of its sub-products is held.' }

/** `GET /product-master/{id}/removal` for a Sub-product that nothing holds, with two Products it may move to. */
export function removalPreview(over: Partial<PmRemovalPreview> = {}): PmRemovalPreview {
  return { id: 11, kind: 'sub_product', name: 'Fee Collection', canDelete: true, blockedBy: [], subProducts: [], targets: [{ id: 1, name: 'ScholarClone' }, { id: 7, name: 'Enterprise Brain' }], ...over }
}

/** The same read for the Product ScholarClone, with its two Sub-products (the second one held when `held` is set). */
export function productRemovalPreview(held = false, over: Partial<PmRemovalPreview> = {}): PmRemovalPreview {
  return removalPreview({
    id: 1, kind: 'product', name: 'ScholarClone',
    canDelete: !held,
    blockedBy: held ? [SUBS_BLOCK] : [],
    subProducts: [
      { id: 11, name: 'Fee Collection', kind: 'sub_product', canDelete: true, blockedBy: [] },
      { id: 12, name: 'Admissions', kind: 'sub_product', canDelete: !held, blockedBy: held ? [SOLD_BLOCK] : [] },
    ],
    targets: [{ id: 9, name: 'Payroll Cloud' }, { id: 7, name: 'Enterprise Brain' }],
    ...over,
  })
}
