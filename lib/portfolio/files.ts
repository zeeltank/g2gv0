/**
 * The source files of the Sub-product form and the Sub-product and Product pages (slice 15, track P3-B), listed once for the scans that read them: the
 * vocabulary (Product and Sub-product, never Catalogue, Offer, Item or Product line), the 390 px structure and the contrast. A new file of this feature is
 * added HERE, so it cannot be left out of a scan. Paths are from the repository root, where the tests run.
 */
export const PORTFOLIO_COMPONENTS = [
  'product-form-drawer', 'product-form-about', 'product-form-sell', 'product-form-icp', 'product-form-lists', 'portfolio-chips',
  'sub-product-page', 'sub-product-overview', 'sub-product-tabs', 'sub-product-bundle', 'product-sub-products', 'product-detail-view',
  'remove-record-dialog', 'move-sub-products-dialog', 'currency-badge', 'currency-select', 'price-card',
].map((name) => `components/domain/portfolio/${name}.tsx`)

/** The routes and the pure files that carry words a person reads. */
export const PORTFOLIO_OTHER = [
  'app/portfolio/products/[id]/page.tsx',
  'lib/portfolio/page-model.ts',
  'lib/portfolio/form-model.ts',
  'lib/portfolio/icp-state.ts',
  'lib/portfolio/removal-model.ts',
  'lib/money/currencies.ts',
  'lib/money/format.ts',
  'lib/money/tax.ts',
  'components/domain/portfolio/product-setup-steps.tsx',
  'components/domain/portfolio/product-icp-section.tsx',
]

export const PORTFOLIO_FILES = [...PORTFOLIO_COMPONENTS, ...PORTFOLIO_OTHER]
