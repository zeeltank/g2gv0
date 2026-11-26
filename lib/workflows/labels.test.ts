import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  actionGroup, capitalize, entitySingular, groupRank, humanize, lowerFirst, operatorLabel, OPERATOR_LABELS, OPERATOR_NEGATED, recordName, runStatusInline,
  plainWorkflowName, runStatusWord, sentenceCase, stripParenthetical, triggerGroup, WORKFLOW_STATUS_WORD,
} from './labels'
import { absoluteDate, dayHeading, formatNumber, parseServerTime, relativeTime } from './time'

const NOW = new Date('2026-11-26T10:00:00Z')

describe('the name a person sees for a recipe-made automation', () => {
  it('drops the console command\'s step number and the "(needs approval)" note the badge already shows', () => {
    assert.equal(plainWorkflowName('Lead Automation 6c Quote accepted - create the sales order (needs approval)'), 'Quote accepted - create the sales order')
    assert.equal(plainWorkflowName('Lead Automation 7 Closed Won - support onboarding'), 'Closed Won - support onboarding')
  })

  it('leaves a name a person typed exactly as it was, and never returns an empty name', () => {
    assert.equal(plainWorkflowName('Chase overdue invoices'), 'Chase overdue invoices')
    // when cleaning would leave nothing, the stored name is shown whole rather than an empty line
    assert.equal(plainWorkflowName('Lead Automation 1a (needs approval)'), 'Lead Automation 1a (needs approval)')
    assert.equal(plainWorkflowName('  '), '')
  })
})

describe('the operators', () => {
  it('has a plain label for each of the eleven, in the words the brief named', () => {
    assert.deepEqual(
      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains', 'empty', 'not_empty'].map(operatorLabel),
      ['is', 'is not', 'is more than', 'is at least', 'is less than', 'is at most', 'is one of', 'is not one of', 'contains', 'is empty', 'is not empty'],
    )
    assert.equal(Object.keys(OPERATOR_LABELS).length, 11)
    assert.deepEqual(Object.keys(OPERATOR_NEGATED).sort(), Object.keys(OPERATOR_LABELS).sort(), 'every operator has a "did not hold" wording')
  })

  it('makes an unknown operator readable instead of showing the code', () => {
    assert.equal(operatorLabel('starts_with'), 'starts with')
  })
})

describe('turning a machine name into words', () => {
  it('humanizes names and dotted facts', () => {
    assert.equal(humanize('due_in_days'), 'due in days')
    assert.equal(humanize('lead.missing_count'), 'lead missing count')
    assert.equal(sentenceCase('due_in_days'), 'Due in days')
    assert.equal(capitalize('e.g. Asia/Kolkata'), 'E.g. Asia/Kolkata', 'only the first letter changes')
  })

  it('lower-cases a label for the middle of a sentence but keeps an acronym', () => {
    assert.equal(lowerFirst('Add a note'), 'add a note')
    assert.equal(lowerFirst('CRM lead created'), 'CRM lead created')
    assert.equal(lowerFirst('A'), 'a')
  })

  it('drops the bracketed detail of a label', () => {
    assert.equal(stripParenthetical('Convert the lead (Organization + Contact + Opportunity)'), 'Convert the lead')
    assert.equal(stripParenthetical('Deal created'), 'Deal created')
  })
})

describe('records', () => {
  it('names the record a table holds, and falls back to "record"', () => {
    assert.equal(entitySingular('crm_leads'), 'lead')
    assert.equal(entitySingular('gtm_outreach_messages'), 'outreach message')
    assert.equal(entitySingular('something_else'), 'record')
    assert.equal(entitySingular(null), 'record')
    assert.equal(recordName('crm_sales_orders', 4), 'Sales order 4')
    assert.equal(recordName(null, null), 'Record')
  })

  it('groups events by the record they are about and actions by the record they work on, the sales steps first', () => {
    assert.equal(triggerGroup('crm_leads'), 'Leads')
    assert.equal(triggerGroup('crm_unknown'), 'Other')
    assert.equal(actionGroup(['lead']), 'Leads')
    assert.equal(actionGroup([]), 'General')
    assert.equal(actionGroup(['sales_order']), 'Sales orders')
    assert.ok(groupRank('Leads') < groupRank('Opportunities'))
    assert.ok(groupRank('Renewals') < groupRank('General'))
    assert.ok(groupRank('Never heard of it') > groupRank('Other') - 1)
  })
})

describe('the words for a status', () => {
  it('names a workflow status in one word that carries the meaning', () => {
    assert.deepEqual(Object.values(WORKFLOW_STATUS_WORD), ['Draft', 'On', 'Paused', 'Archived'])
  })

  it('names a run status the way a salesperson reads it', () => {
    assert.equal(runStatusWord('succeeded'), 'Done')
    assert.equal(runStatusWord('pending_approval'), 'Waiting for you')
    assert.equal(runStatusWord('retry_wait'), 'Will try again')
    assert.equal(runStatusWord('something_new'), 'Something new', 'an unknown status is made readable')
    assert.equal(runStatusInline('succeeded'), 'done')
    assert.equal(runStatusInline('pending_approval'), 'waiting for approval')
    assert.equal(runStatusInline('failed'), 'failed')
  })

  it('never shows a snake_case name for any run status', () => {
    for (const s of ['queued', 'running', 'succeeded', 'failed', 'skipped', 'pending_approval', 'retry_wait', 'rejected', 'cancelled']) assert.ok(!/_/.test(runStatusWord(s)), s)
  })
})

describe('times', () => {
  it('reads a server time with no zone as UTC and an ISO time as it is', () => {
    assert.equal(parseServerTime('2026-11-26 09:30:00')!.toISOString(), '2026-11-26T09:30:00.000Z')
    assert.equal(parseServerTime('2026-11-26T09:30:00Z')!.toISOString(), '2026-11-26T09:30:00.000Z')
    assert.equal(parseServerTime('2026-11-26T15:00:00+05:30')!.toISOString(), '2026-11-26T09:30:00.000Z')
    assert.equal(parseServerTime(null), null)
    assert.equal(parseServerTime('not a date'), null)
  })

  it('says how long ago in words', () => {
    assert.equal(relativeTime('2026-11-26 09:59:40', NOW), 'just now')
    assert.equal(relativeTime('2026-11-26 09:57:00', NOW), '3 minutes ago')
    assert.equal(relativeTime('2026-11-26 08:00:00', NOW), '2 hours ago')
    assert.equal(relativeTime('2026-11-25 10:00:00', NOW), 'yesterday')
    assert.equal(relativeTime('2026-11-20 10:00:00', NOW), '6 days ago')
    assert.equal(relativeTime('2026-11-26 10:05:00', NOW), 'in 5 minutes')
    assert.equal(relativeTime(null, NOW), 'at an unknown time')
  })

  it('shows an old time as a date and a day heading as Today, Yesterday or the date', () => {
    assert.match(relativeTime('2026-01-05 10:00:00', NOW), /5 Jan 2026/)
    assert.match(absoluteDate('2026-11-26 09:30:00', false), /26 Nov 2026/)
    assert.equal(dayHeading('2026-11-26 09:30:00', NOW), 'Today')
    assert.equal(dayHeading('2026-11-25 09:30:00', NOW), 'Yesterday')
    assert.match(dayHeading('2026-11-20 09:30:00', NOW), /20 Nov/)
    assert.equal(dayHeading(null, NOW), 'Unknown date')
  })

  it('groups the digits of a number with Intl', () => {
    assert.equal(formatNumber(30000, 'en-US'), '30,000')
    assert.equal(formatNumber(300000, 'en-IN'), '3,00,000')
  })
})
