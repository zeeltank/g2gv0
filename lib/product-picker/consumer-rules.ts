import type { PickerScope } from '../../services/product-master/picker-service'

/**
 * THE one list of how each form that chooses a Sub-product treats one that is not sold in CRM (S15 follow-up, contract D-7). Every Sub-product is LISTED
 * (`scope: 'all'`); whether a person may CHOOSE one that is not sold depends on what the form stores:
 *
 *  - a form that stores the id of the entry in CRM (`crm_products.id`) cannot store a Sub-product that has no entry: it lists it, tagged "Not sold in CRM", and does
 *    not let it be chosen (`notSoldSelectable: false`);
 *  - a form that stores the Sub-product's own id (the master id) can take any row (`notSoldSelectable: true`).
 *
 * Every consumer below stores the catalogue id: the server checks the value against `crm_products` of the organisation (read in hp_erp on 24 Nov 2026:
 * CrmTicketController, CrmAssetController and CrmFaqController validate \`productId\` as a \`crm_products\` reference; CrmOpportunityController::addProduct
 * and the quote, order and invoice controllers store it as \`product_id\` of their line rows; a bundle part is
 * \`componentProductId\`, also a \`crm_products\` id). To FLIP ONE CONSUMER, change its one line here; the screen reads this list and nothing else.
 * A form that is flipped to \`notSoldSelectable: true\` must also decide what it saves for a row that has no entry in CRM (\`picked.masterId\`): the picker hands
 * such a row back with an empty \`productId\` and a null \`crmProductId\`.
 */
export interface ConsumerRule {
  /** Which Sub-products the form's picker lists. */
  scope: PickerScope
  /** A listed Sub-product that is not sold can be chosen. */
  notSoldSelectable: boolean
  /** What the form saves (for the report, and so a reader of this file knows what flipping the line means). */
  stores: string
}

export type PickerConsumerKey =
  | 'quote' | 'salesOrder' | 'invoice' | 'opportunityProduct' | 'ticket' | 'asset' | 'faq' | 'bundle'

const CATALOGUE_ID = 'the id of the entry in CRM (crm_products.id)'

export const PICKER_RULES: Readonly<Record<PickerConsumerKey, ConsumerRule>> = {
  quote: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as the product_id of a quote's rows` },
  salesOrder: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as the product_id of an order's rows` },
  invoice: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as the product_id of an invoice's rows (the invoice page reuses the quote table)` },
  opportunityProduct: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as the productId of an opportunity's Sub-products` },
  ticket: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as a ticket's productId` },
  asset: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as an asset's productId` },
  faq: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as an FAQ's productId` },
  bundle: { scope: 'all', notSoldSelectable: false, stores: `${CATALOGUE_ID}, as a bundle part's componentProductId` },
}

/** The consumers in the order they are listed in a report. */
export const PICKER_CONSUMER_KEYS = Object.keys(PICKER_RULES) as PickerConsumerKey[]
