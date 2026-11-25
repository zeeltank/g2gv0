import type { PortfolioItemType } from '@/services/product-master/portfolio-list-types'

/**
 * The CSV import of the Product Portfolio list is the old Products screen's own (`POST /api/crm/products/import`, max 500 rows, `assignedTo` required): the same
 * header aliases and the same blank template, so a file made for the old screen imports unchanged. S16 adds the Tax Rate column (a rate's name, as the
 * organisation spells it); the Currency column takes a code of the catalogue (INR, USD, EUR...), and the server reports a row with a code or a rate it does not know
 * instead of saving it. The import still has no column for the type, the Product or the GL account (the audit's D-6: the import and export asymmetry is pre-existing
 * and stays on the backlog); imported rows have no Product yet, so they land under "No product yet".
 */
export const IMPORT_HEADER_MAP: Record<string, string> = {
  name: 'name', sku: 'sku', category: 'category', 'unit price': 'unitPrice', 'cost price': 'costPrice',
  currency: 'currency', 'tax rate': 'taxRate', vendor: 'vendor', 'qty in stock': 'qtyInStock', 'reorder level': 'reorderLevel',
  description: 'description', 'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

export const TEMPLATE_HEADERS = [
  'Name', 'SKU', 'Category', 'Unit Price', 'Cost Price', 'Currency', 'Tax Rate', 'Vendor',
  'Qty In Stock', 'Reorder Level', 'Description', 'Assigned To (user id)',
] as const

/** The noun the dialogs use for what they import, merge or export. */
export function importNoun(itemType: PortfolioItemType): string {
  return itemType === 'service' ? 'service' : 'sub-product'
}
