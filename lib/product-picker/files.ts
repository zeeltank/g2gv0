/**
 * The files of the ONE shared product picker and every screen that uses it (slice 15, track P3-C; finished by WPC). A single list for the static guard
 * (lib/product-picker/guard.test.ts), the vocabulary scan and the contrast scan, so a new consumer is added in one place and a retargeted one cannot quietly
 * go back to the old endpoint. Paths are relative to the repository root (the tests run from there). No React and no network in this file.
 */

/** The picker itself: its request, its rules, its look, its two boxes (Sub-product search box and Product select) and the link to a Sub-product page. */
export const PICKER_FILES: readonly string[] = [
  'services/product-master/picker-service.ts',
  'lib/product-picker/model.ts',
  'lib/product-picker/resolver.ts',
  'lib/product-picker/tones.ts',
  'lib/product-picker/use-product-choices.ts',
  'lib/product-picker/consumer-rules.ts',
  'components/domain/portfolio/product-picker.tsx',
  'components/domain/portfolio/product-picker-list.tsx',
  'components/domain/portfolio/product-picker-level-one.tsx',
  'components/domain/portfolio/product-page-link.tsx',
]

/** The four components that draw the picker (the contrast scan reads their class strings). */
export const PICKER_COMPONENTS: readonly string[] = PICKER_FILES.filter((file) => file.startsWith('components/'))

export interface PickerConsumer {
  /** The file that lets a person choose a product (or links to one). */
  file: string
  /** What the person chooses there, for a failure message. */
  picks: string
  /** What the file must still contain: the picker component it was retargeted to, and what it imports it from. A consumer put back on an old endpoint loses these. */
  uses: readonly string[]
  /** The test that pins its behaviour. */
  pinnedBy: string
}

const SUB = ["<SubProductPicker", "from '@/components/domain/portfolio/product-picker'"] as const
const ONE = ["<ProductPicker", "from '@/components/domain/portfolio/product-picker'"] as const
const CHOICES = ["useProductChoices", "from '@/lib/product-picker/use-product-choices'"] as const
const LINK = ['<ProductPageLink', "from '@/components/domain/portfolio/product-page-link'"] as const

/** Every screen of the CRM that chooses a Sub-product or a Product (or links to a Sub-product page), with the component it uses now. */
export const CONSUMERS: readonly PickerConsumer[] = [
  { file: 'components/domain/crm/quote-line-item-table.tsx', picks: 'a quote line (and an invoice line: the invoice page reuses this table)', uses: SUB, pinnedBy: 'consumer-documents.test.tsx' },
  { file: 'components/domain/crm/sales-order-line-item-table.tsx', picks: 'a sales order line', uses: SUB, pinnedBy: 'consumer-documents.test.tsx' },
  { file: 'components/domain/crm/opportunity-detail-page.tsx', picks: 'the Sub-product of interest of an opportunity', uses: SUB, pinnedBy: 'consumer-forms.test.tsx' },
  { file: 'components/domain/crm/create-ticket-modal.tsx', picks: 'the Sub-product of a ticket', uses: SUB, pinnedBy: 'consumer-forms.test.tsx' },
  { file: 'components/domain/crm/create-asset-modal.tsx', picks: 'the Sub-product of an asset', uses: SUB, pinnedBy: 'consumer-forms.test.tsx' },
  { file: 'components/domain/crm/create-faq-modal.tsx', picks: 'the Sub-product of an FAQ', uses: SUB, pinnedBy: 'consumer-forms.test.tsx' },
  { file: 'components/domain/crm/create-lead-modal.tsx', picks: 'the Product of a lead', uses: [...ONE, ...CHOICES], pinnedBy: 'lib/leads/create-lead-modal.test.tsx' },
  { file: 'components/domain/crm/campaign-parts.tsx', picks: 'the Product of a campaign', uses: ONE, pinnedBy: 'lib/campaigns/campaign-form.test.tsx' },
  { file: 'components/domain/crm/create-campaign-modal.tsx', picks: 'the Product of a campaign (the choices)', uses: CHOICES, pinnedBy: 'lib/campaigns/campaign-form.test.tsx' },
  { file: 'components/domain/crm/opportunity-parts.tsx', picks: 'the Product of an opportunity', uses: ONE, pinnedBy: 'lib/opportunities/opportunity-form.test.tsx' },
  { file: 'components/domain/crm/opportunity-form-options.ts', picks: 'the Product of an opportunity (the choices)', uses: CHOICES, pinnedBy: 'lib/opportunities/opportunity-form.test.tsx' },
  { file: 'components/domain/crm/lead-list-view.tsx', picks: 'the Product filter of the leads list', uses: CHOICES, pinnedBy: 'lib/leads/leads-list.test.tsx' },
  { file: 'components/domain/crm/ticket-detail-page.tsx', picks: 'the link from a ticket to its Sub-product page', uses: LINK, pinnedBy: 'product-page-link.test.tsx' },
  { file: 'components/domain/crm/asset-detail-page.tsx', picks: 'the link from an asset to its Sub-product page', uses: LINK, pinnedBy: 'product-page-link.test.tsx' },
]

/** Every file of the picker and its consumers, once (the vocabulary scan reads all of them). */
export const ALL_PICKER_AND_CONSUMER_FILES: readonly string[] = [...new Set([...PICKER_FILES, ...CONSUMERS.map((consumer) => consumer.file)])]


export interface OtherConsumer {
  /** The file that reads a list of products without being a picker (audit 3, finding G-E7). */
  file: string
  /** What it must still contain, so a move to another endpoint fails a named test. */
  mustContain: string
  reads: string
}

/** The three consumers of a product list that are NOT pickers, and stay as they are. */
export const OTHER_CONSUMERS: readonly OtherConsumer[] = [
  { file: 'components/domain/signals/product-selector.tsx', mustContain: 'portfolioService.getProducts(context)', reads: 'GET /portfolio/products (the Signals Main product selector)' },
  { file: 'services/signal-review/runs-service.ts', mustContain: 'productMasterService.options()', reads: 'GET /product-master/options (names a research run\'s product)' },
  { file: 'services/signal-review/signal-review-service.ts', mustContain: 'productMasterService.options()', reads: 'GET /product-master/options (names a signal\'s product)' },
  { file: 'components/domain/crm/asset-list-view.tsx', mustContain: "'product id': 'productId'", reads: 'the CSV column "product id" is the typed catalogue id' },
]

/** The directories whose source files the static guard reads (everything a screen or a service can be made of), tests excluded. */
export const SOURCE_ROOTS: readonly string[] = ['app', 'components', 'hooks', 'lib', 'services']
