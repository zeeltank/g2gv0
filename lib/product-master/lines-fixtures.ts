import type {
  PmCan, PmListData, PmMeta, PmOption, PmProductRow, PmRecord, PmSubProductRow, PmUsage,
} from '../../services/product-master/types'

/** Data for the product-line screens' tests: the shape the Product Master API answers, with the real kinds of row (a shared line, an own line, sold and unsold sub-products). */

export function sub(over: Partial<PmSubProductRow> = {}): PmSubProductRow {
  return {
    id: 11, key: 'scholarclone/sch-11', name: 'Fee Collection', status: 'active', origin: 'portfolio', offerId: 'SCH-11', readiness: 'Live – with client',
    soldInCrm: false, crmProductId: null, crmItemType: null, signalsFound: 4, icp: 'active', ...over,
  }
}

export function line(over: Partial<PmProductRow> = {}): PmProductRow {
  const subProducts = over.subProducts ?? [
    sub(),
    sub({ id: 12, key: 'scholarclone/sch-12', name: 'Admissions', offerId: 'SCH-12', readiness: 'Prototype', soldInCrm: true, crmProductId: 301, crmItemType: 'product', signalsFound: 0, icp: 'draft' }),
    sub({ id: 13, key: 'scholarclone/sch-13', name: 'Timetable', offerId: 'SCH-13', readiness: 'In development', soldInCrm: true, crmProductId: 302, crmItemType: 'service', signalsFound: 2, icp: 'none' }),
  ]
  return {
    id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', status: 'active', origin: 'builtin', shared: true, signalKey: 'scholar', portfolioName: 'Scholar K-12',
    subProductCount: subProducts.length, soldInCrmCount: subProducts.filter((s) => s.soldInCrm).length, signalsFound: 31, icp: 'template', ...over, subProducts,
  }
}

export function list(over: Partial<PmListData> = {}): PmListData {
  const products = over.products ?? [
    line(),
    line({ id: 2, key: 'enterprise_brain', name: 'Enterprise Brain', signalsFound: 6, icp: 'none', subProducts: [] }),
    line({ id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', shared: false, origin: 'custom', signalsFound: 0, icp: 'draft', subProducts: [sub({ id: 21, key: 'payroll_cloud/pc-1', name: 'Payslips', offerId: 'PC-1', signalsFound: 1, icp: 'none', readiness: 'Prototype' })] }),
  ]
  return {
    available: true, products, items: [],
    totals: { products: products.length, subProducts: products.reduce((n, p) => n + p.subProducts.length, 0), items: 0 }, ...over,
  }
}

export function can(over: Partial<PmCan> = {}): PmCan {
  return {
    createProduct: true, createSubProduct: true, createItem: { product: true, service: true }, sellInCrm: { product: true, service: true },
    editSubProduct: true, editItem: { product: true, service: true }, archive: true, archiveProduct: true, restore: true, restoreProduct: true, ...over,
  }
}

export function meta(over: Partial<PmMeta> = {}, canOver: Partial<PmCan> = {}): PmMeta {
  return {
    readinessStatuses: ['Live – with client', 'Prototype', 'In development'], itemTypes: ['product', 'service'],
    taxRates: [{ id: 3, name: 'GST', percentage: 18 }], can: can(canOver), ...over,
  }
}

export function options(): PmOption[] {
  return [
    { id: 1, key: 'scholarclone', name: 'ScholarClone', kind: 'product', parentId: null, label: 'ScholarClone' },
    { id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', kind: 'product', parentId: null, label: 'Payroll Cloud' },
    { id: 11, key: 'scholarclone/sch-11', name: 'Fee Collection', kind: 'sub_product', parentId: 1, label: 'ScholarClone › Fee Collection' },
  ]
}

const about = {
  whatItDoes: 'Collects school fees online.', modulesComponents: 'Invoices, receipts', deploymentModel: 'Cloud', proofPoints: 'Used by 12 schools', notes: null,
  needsSolved: ['Late fee collection', 'Manual receipts'], primarySegments: ['K-12 schools'], triggerSignals: ['New academic year'],
}

/** A sub-product that is not sold in the CRM (the page a sub-product opens when it has no catalogue page). */
export function subProductRecord(over: Partial<PmRecord> = {}): PmRecord {
  return {
    id: 11, key: 'scholarclone/sch-11', name: 'Fee Collection', kind: 'sub_product', status: 'active', origin: 'portfolio', shared: false, signalKey: null, portfolioName: null,
    parent: { id: 1, key: 'scholarclone', name: 'ScholarClone' }, subProducts: [],
    offer: { id: 501, offerId: 'SCH-11', name: 'Fee Collection', product: 'Scholar K-12', readiness: 'Live – with client', readinessConfirmed: true, about },
    crmProduct: null, createdAt: null, updatedAt: null, ...over,
  }
}

/** The same sub-product when it is sold in the CRM. */
export function soldSubProductRecord(over: Partial<PmRecord> = {}): PmRecord {
  return subProductRecord({
    crmProduct: { id: 301, productNo: 'PRD-AAAA1111', name: 'Fee Collection', sku: 'SKU-1', type: 'product', glAccount: '4000', unitPrice: 1500, currency: 'INR', taxRateId: 3, active: true },
    ...over,
  })
}

export function lineRecord(over: Partial<PmRecord> = {}): PmRecord {
  return {
    id: 9, key: 'payroll_cloud', name: 'Payroll Cloud', kind: 'product', status: 'active', origin: 'custom', shared: false, signalKey: 'payroll_cloud', portfolioName: 'Payroll Cloud',
    parent: null, subProducts: [{ id: 21, key: 'payroll_cloud/pc-1', name: 'Payslips', status: 'active' }], offer: null, crmProduct: null, createdAt: null, updatedAt: null, ...over,
  }
}

export function usage(over: Partial<PmUsage> = {}): PmUsage {
  return { signals: 4, icp: 'active', priceBooks: [], quotes: 0, basePrice: null, currency: null, ...over }
}

export const priceBook = (over: Record<string, unknown> = {}) => ({ priceBookId: 7, priceBookNo: 'PB-0007', name: 'Standard 2026', currency: 'INR', active: true, listPrice: 1200, ...over })
