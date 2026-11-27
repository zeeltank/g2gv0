/**
 * An automation as ONE plain sentence: "When a lead replies and the reply is positive, book a meeting; needs your approval."
 *
 * The list takes the server's own sentence when it sends one (the server builds it from the same catalog labels). The builder builds this one while the
 * person is still choosing, so it has to cope with half-finished input: no event yet, no action yet, a condition with no value yet.
 *
 * Pure: no React, no network. Tested in lib/workflows/sentence.test.ts.
 */
import type { GtmWorkflow, WorkflowAction, WorkflowCatalog, WorkflowCondition } from '@/services/gtm/workflows'
import { actionPhrase, fieldLabel, triggerLabel } from './catalog'
import { humanize, lowerFirst, NO_VALUE_OPERATORS, operatorLabel } from './labels'
import { formatNumber } from './time'

/**
 * How each event reads after the word "When", for a server that does not send `phrase` with each event yet. The catalog's labels are names ("Lead became
 * Qualified"), which do not read after "When". An event with no phrase anywhere reads as: When "its label" happens.
 */
const TRIGGER_PHRASES: Readonly<Record<string, string>> = {
  'gtm.account.updated': 'an account is updated',
  'gtm.contact.unsubscribed': 'a contact unsubscribes',
  'gtm.contact.replied': 'a contact replies',
  'gtm.contact.bounced': 'a contact’s email bounces',
  'gtm.deal.created': 'a deal is created',
  'gtm.deal.stage_changed': 'a deal moves to another stage',
  'gtm.deal.scored': 'a deal is scored',
  'gtm.deal.health_flagged': 'a deal is newly flagged as at risk',
  'gtm.outreach.approved': 'an outreach message is approved',
  'gtm.outreach.sent': 'an outreach email is sent',
  'gtm.renewal.created': 'a renewal is recorded',
  'gtm.renewal.status_changed': 'a renewal changes status',
  'gtm.renewal.due_soon': 'a renewal is due soon without progress',
  'gtm.customer.at_risk': 'a customer is newly at risk',
  'crm.lead.created': 'a lead is created',
  'crm.lead.qualified': 'a lead becomes qualified',
  'crm.lead.converted': 'a lead is converted',
  'crm.lead.ready': 'a lead has all its details',
  'crm.lead.replied': 'a customer replies to a lead email',
  'crm.lead.reply_classified': 'a lead’s reply has been read',
  'crm.lead.meeting_proposed': 'meeting times are proposed for a lead',
  'crm.opportunity.created': 'an opportunity is created',
  'crm.opportunity.stage_changed': 'an opportunity changes stage',
  'crm.opportunity.inactive': 'an open opportunity has had no activity',
  'crm.opportunity.overdue': 'an open opportunity is past its closing date',
  'crm.quote.created': 'a quote is created',
  'crm.quote.stage_changed': 'a quote changes stage',
  'crm.sales_order.created': 'a sales order is created',
  'crm.sales_order.stage_changed': 'a sales order changes stage',
  'crm.invoice.created': 'an invoice is created',
  'crm.invoice.stage_changed': 'an invoice changes stage',
  'crm.invoice.paid': 'an invoice is fully paid',
  'crm.invoice.overdue': 'an invoice is past its due date',
}

/** The words after "When" for an event, or a placeholder while none is chosen. The server's own phrase comes first, so the sentence is the same everywhere. */
export function triggerPhrase(catalog: WorkflowCatalog, trigger: string): string {
  if (trigger === '') return 'something happens'
  const own = catalog.triggers[trigger]?.phrase?.trim()
  return own || TRIGGER_PHRASES[trigger] || `“${triggerLabel(catalog, trigger)}” happens`
}

/** "a, b or c". */
export function joinWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`
}

/** "a, b and c". */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** A value in a condition, the way a person writes it: 50,000 for a number, yes and no for a flag, a list as "a, b or c". */
export function formatValue(value: unknown, locale?: string): string {
  if (value === null || value === undefined || value === '') return '…'
  if (Array.isArray(value)) return value.length === 0 ? '…' : joinWithOr(value.map((v) => formatValue(v, locale)))
  if (typeof value === 'number') return formatNumber(value, locale)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  const text = String(value)
  return /^[a-z]+(_[a-z]+)+$/.test(text) ? humanize(text) : text
}

/** One condition as words: "the deal amount is more than 50,000". */
export function conditionPhrase(catalog: WorkflowCatalog, trigger: string, c: WorkflowCondition, locale?: string): string {
  const subject = `the ${lowerFirst(fieldLabel(catalog, trigger, c.field))}`
  const op = operatorLabel(c.op)
  return NO_VALUE_OPERATORS.includes(c.op) ? `${subject} ${op}` : `${subject} ${op} ${formatValue(c.value, locale)}`
}

export interface SentenceInput {
  trigger: string
  conditions: readonly WorkflowCondition[]
  actions: readonly Pick<WorkflowAction, 'type'>[]
  needsApproval?: boolean
}

/** "When a lead is created and the lead company is not empty, add a note to the lead, then create a follow-up task; needs your approval." */
export function describeAutomation(input: SentenceInput, catalog: WorkflowCatalog, locale?: string): string {
  const when = [triggerPhrase(catalog, input.trigger), ...input.conditions.map((c) => conditionPhrase(catalog, input.trigger, c, locale))]
  const then = input.actions.length === 0
    ? 'choose what should happen'
    : input.actions.map((a, i) => (i === 0 ? '' : 'then ') + actionPhrase(catalog, a.type)).join(', ')
  return `When ${when.join(' and ')}, ${then}${input.needsApproval ? '; needs your approval' : ''}.`
}

/** The sentence of a row: the server's own when it sent one, else built here from the definition. */
export function rowSentence(workflow: GtmWorkflow, catalog: WorkflowCatalog, needsApprovalFlag: boolean, locale?: string): string {
  const own = workflow.sentence?.trim()
  const sentence = own && own.length > 0
    ? own
    : describeAutomation({ trigger: workflow.trigger_event, conditions: workflow.conditions, actions: workflow.actions, needsApproval: needsApprovalFlag }, catalog, locale)
  return stripApprovalTail(sentence)
}

/** The row shows a "Needs approval" badge, so the sentence does not say it twice. */
export function stripApprovalTail(sentence: string): string {
  return sentence.replace(/[;,]?\s*(and\s+)?needs your approval\.?\s*$/i, '.').replace(/\.{2,}$/, '.')
}
