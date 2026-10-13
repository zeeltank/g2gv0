'use client'

import { ProductCatalogListView } from './product-catalog-list-view'

export function ServiceListView() {
  return <ProductCatalogListView itemType="service" routeSegment="services" />
}
