'use client'

import { useCallback, useState } from 'react'
import { useListQuery } from '@/components/shared/scaffolds'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { CrmProductLines } from '@/types/crm'
import { ProductCatalogListView } from './product-catalog-list-view'
import { ProductLinesView } from './product-lines-view'
import {
  catalogueItemHref, lineRecordHref, PRODUCT_LIST_QUERY, readScope, showScopeSwitch, type ProductScope,
} from './product-lines-model'
import { ProductScopeSwitch } from './product-scope-switch'

/**
 * The Products screen (Sales & Marketing > Products). It opens on the catalogue, exactly as it always has; where the product lines exist on the server a
 * "Catalogue | Product lines" switch sits under the title, and the product lines (the groups Signals and the Portfolio know, with the sub-products inside
 * them, sold or not) open in the same screen. The scope lives in the address (?scope=lines), so a refresh, the Back button and a pasted link keep it.
 */
export function ProductListView() {
  const { resolveAccessLink } = useSidebarNavigation()
  const { query, setQuery } = useListQuery(PRODUCT_LIST_QUERY)
  const scope = readScope(query.filters.scope)
  // What the catalogue list last said about the product lines; unknown until it has loaded once.
  const [lines, setLines] = useState<CrmProductLines | null>(null)

  // Each scope starts clean: the other one's search and status filter mean nothing here.
  const setScope = useCallback((next: ProductScope) => setQuery({ q: '', filters: { scope: next, status: 'active' } }), [setQuery])

  const switcher = showScopeSwitch('product', lines, scope)
    ? <ProductScopeSwitch scope={scope} onChange={setScope} lines={lines} />
    : null

  if (scope === 'lines') {
    const hrefs = { products: resolveAccessLink('/module/crm/sales/products'), services: resolveAccessLink('/module/crm/sales/services') }
    return (
      <ProductLinesView
        scopeSwitch={switcher}
        recordHref={(masterId) => lineRecordHref(hrefs.products, masterId)}
        catalogueHref={(crmProductId, type) => catalogueItemHref(hrefs, crmProductId, type)}
      />
    )
  }

  return <ProductCatalogListView itemType="product" routeSegment="products" scopeSwitch={switcher} onLines={setLines} />
}
