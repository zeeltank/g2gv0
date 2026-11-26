/**
 * The plain words of the Automations and Runs tabs, in one place: the eleven condition operators, the words for a run's status, the names of the
 * records an automation is about, and the helpers that turn a machine name ("due_in_days", "crm_leads") into something a salesperson reads.
 *
 * Pure: no React, no network. Tested in lib/workflows/labels.test.ts.
 */

/** The eleven things a condition can say, in the words a person uses. */
export const OPERATOR_LABELS: Readonly<Record<string, string>> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'contains',
  empty: 'is empty',
  not_empty: 'is not empty',
}

/** What a condition that did NOT hold said instead ("the amount 30,000 is not more than 50,000"). */
export const OPERATOR_NEGATED: Readonly<Record<string, string>> = {
  eq: 'is not',
  neq: 'is',
  gt: 'is not more than',
  gte: 'is not at least',
  lt: 'is not less than',
  lte: 'is not at most',
  in: 'is not one of',
  not_in: 'is one of',
  contains: 'does not contain',
  empty: 'is not empty',
  not_empty: 'is empty',
}

/** The operators that need no value to compare with. */
export const NO_VALUE_OPERATORS: readonly string[] = ['empty', 'not_empty']
/** The operators whose value is a list. */
export const LIST_OPERATORS: readonly string[] = ['in', 'not_in']
/** The operators that only make sense for a number. */
export const NUMBER_OPERATORS: readonly string[] = ['gt', 'gte', 'lt', 'lte']

export function operatorLabel(op: string): string {
  return OPERATOR_LABELS[op] ?? humanize(op)
}

/** "due_in_days" becomes "due in days"; "Closed Won" is left as it is. */
export function humanize(key: string): string {
  return key.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "due_in_days" becomes "Due in days". */
export function sentenceCase(key: string): string {
  const words = humanize(key)
  return words === '' ? words : words.charAt(0).toUpperCase() + words.slice(1)
}

/** Upper-cases the first letter and touches nothing else (a hint such as "e.g. Asia/Kolkata" keeps its dots and slashes). */
export function capitalize(text: string): string {
  const t = text.trim()
  return t === '' ? t : t.charAt(0).toUpperCase() + t.slice(1)
}

/** Lower-cases the first letter, unless the word is an acronym or a name ("CRM lead", "SLA"): a second capital keeps it. */
export function lowerFirst(text: string): string {
  if (text.length < 2) return text.toLowerCase()
  if (/^[A-Z]{2}/.test(text)) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** "Convert the lead (Organization + Contact + Opportunity)" becomes "Convert the lead". */
export function stripParenthetical(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim()
}

/**
 * What a person calls a recipe-made automation: the console command stores "Lead Automation 6c Quote accepted - create the sales order (needs approval)",
 * which carries its step number and a note the "Needs approval" badge already shows. The stored name is untouched; only the screen drops the clutter.
 */
export function plainWorkflowName(name: string): string {
  const plain = name.replace(/^Lead Automation\s+\d+[a-z]?\s+/i, '').replace(/\s*\(needs approval\)\s*$/i, '').trim()

  return plain === '' ? name.trim() : plain
}

export interface EntityName {
  singular: string
  plural: string
}

/** The records an automation can be about, by the table the server names. */
export const ENTITY_NAMES: Readonly<Record<string, EntityName>> = {
  crm_leads: { singular: 'lead', plural: 'leads' },
  crm_opportunities: { singular: 'opportunity', plural: 'opportunities' },
  crm_quotes: { singular: 'quote', plural: 'quotes' },
  crm_sales_orders: { singular: 'sales order', plural: 'sales orders' },
  crm_invoices: { singular: 'invoice', plural: 'invoices' },
  crm_tickets: { singular: 'ticket', plural: 'tickets' },
  gtm_accounts: { singular: 'account', plural: 'accounts' },
  gtm_contacts: { singular: 'contact', plural: 'contacts' },
  gtm_deals: { singular: 'deal', plural: 'deals' },
  gtm_outreach_messages: { singular: 'outreach message', plural: 'outreach messages' },
  gtm_renewals: { singular: 'renewal', plural: 'renewals' },
}

/** "lead", "opportunity" ... or "record" when the table is not one of those. */
export function entitySingular(table: string | null | undefined): string {
  return (table && ENTITY_NAMES[table]?.singular) || 'record'
}

/** "Lead 12", "Sales order 4": a record the way a person names it. */
export function recordName(table: string | null | undefined, id: number | string | null | undefined): string {
  const noun = entitySingular(table)
  const label = noun.charAt(0).toUpperCase() + noun.slice(1)
  return id === null || id === undefined || id === '' ? label : `${label} ${id}`
}

/** The order the groups of a picker come in: the sales steps first, in the order a sale goes. */
export const GROUP_ORDER: readonly string[] = [
  'Leads', 'Opportunities', 'Quotes', 'Sales orders', 'Invoices', 'Accounts', 'Contacts', 'Deals', 'Outreach', 'Renewals', 'General', 'Other',
]

const TRIGGER_GROUPS: Readonly<Record<string, string>> = {
  crm_leads: 'Leads',
  crm_opportunities: 'Opportunities',
  crm_quotes: 'Quotes',
  crm_sales_orders: 'Sales orders',
  crm_invoices: 'Invoices',
  gtm_accounts: 'Accounts',
  gtm_contacts: 'Contacts',
  gtm_deals: 'Deals',
  gtm_outreach_messages: 'Outreach',
  gtm_renewals: 'Renewals',
}

const ACTION_GROUPS: Readonly<Record<string, string>> = {
  lead: 'Leads',
  opportunity: 'Opportunities',
  quote: 'Quotes',
  sales_order: 'Sales orders',
  invoice: 'Invoices',
  account: 'Accounts',
  contact: 'Contacts',
  deal: 'Deals',
  message: 'Outreach',
  renewal: 'Renewals',
}

/** The group an event is listed under: the kind of record it is about. */
export function triggerGroup(entity: string | null | undefined): string {
  return (entity && TRIGGER_GROUPS[entity]) || 'Other'
}

/** The group an action is listed under: the kind of record it works on, or General when it needs none. */
export function actionGroup(needs: readonly string[]): string {
  const first = needs[0]
  return first ? ACTION_GROUPS[first] ?? 'Other' : 'General'
}

export function groupRank(group: string): number {
  const index = GROUP_ORDER.indexOf(group)
  return index === -1 ? GROUP_ORDER.length : index
}

/** The word for a workflow's status. The word carries the meaning; the colour only helps. */
export const WORKFLOW_STATUS_WORD: Readonly<Record<string, string>> = {
  draft: 'Draft',
  active: 'On',
  paused: 'Paused',
  archived: 'Archived',
}

/** The word for a run's status, as the person who started the automation reads it. */
export const RUN_STATUS_WORD: Readonly<Record<string, string>> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  pending_approval: 'Waiting for you',
  retry_wait: 'Will try again',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export function runStatusWord(status: string): string {
  return RUN_STATUS_WORD[status] ?? sentenceCase(status)
}

/** The same status in the middle of a sentence ("Last run 2 hours ago: done"). */
export function runStatusInline(status: string): string {
  switch (status) {
    case 'succeeded': return 'done'
    case 'pending_approval': return 'waiting for approval'
    case 'retry_wait': return 'will try again'
    default: return lowerFirst(runStatusWord(status))
  }
}
