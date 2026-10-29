import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import {
  formatFriendlyProblem,
  formatFriendlyProblems,
  friendlyErrorSummary,
  friendlyFieldErrors,
  humanizeField,
  humanizeMessage,
} from './friendly-errors'

describe('humanizeField', () => {
  it('maps technical ICP fields to user-facing labels', () => {
    assert.equal(humanizeField('industry_label'), 'Industry / Organisation Profile')
    assert.equal(humanizeField('guidance'), 'ICP Qualification Guidance')
    assert.equal(humanizeField('buyer_types'), 'Ideal Buyer Types')
    assert.equal(humanizeField('must_have'), 'Required Customer Qualification Criteria')
    assert.equal(humanizeField('regions'), 'Target Geographies / Regions')
    assert.equal(humanizeField('pitch'), 'Customer Pains and Desired Outcomes')
    assert.equal(humanizeField('label'), 'ICP Name')
  })

  it('maps technical product fields to user-facing labels', () => {
    assert.equal(humanizeField('offer_id'), 'Product ID')
    assert.equal(humanizeField('parent_product'), 'Category')
    assert.equal(humanizeField('readiness_status'), 'Readiness Status')
    assert.equal(humanizeField('what_it_does'), 'Product Description')
    assert.equal(humanizeField('problems'), 'Customer Problems Solved')
  })

  it('translates indexed array paths to 1-based human titles', () => {
    assert.equal(humanizeField('must_have[0]'), 'Required Customer Qualification Criteria #1')
    assert.equal(humanizeField('must_have[0].value'), 'Required Customer Qualification Criteria #1 Value')
    assert.equal(humanizeField('must_have[0].label'), 'Required Customer Qualification Criteria #1 Label')
    assert.equal(humanizeField('must_have[1].subject'), 'Required Customer Qualification Criteria #2 Fact / Field')
    assert.equal(humanizeField('must_have[2].op'), 'Required Customer Qualification Criteria #3 Rule')
    assert.equal(humanizeField('disqualifiers[0]'), 'Exclusion Criteria #1')
    assert.equal(humanizeField('queries[0]'), 'Search Query #1')
  })

  it('falls back gracefully on unknown custom fields', () => {
    assert.equal(humanizeField('custom_field_name'), 'Custom Field Name')
    assert.equal(humanizeField('custom_list[2]'), 'Custom List #3')
  })
})

describe('humanizeMessage and formatFriendlyProblem', () => {
  it('maps "characters on one line" into multi-line friendly instructions', () => {
    const raw = 'industry_label: text of 1 to 5000 characters on one line'
    const formatted = formatFriendlyProblem(raw)
    assert.equal(formatted, 'Industry / Organisation Profile: Please enter between 1 and 5000 characters.')
    assert.doesNotMatch(formatted, /on one line/)
  })

  it('maps guidance length correctly', () => {
    const raw = 'guidance: text of 0 to 1500 characters on one line'
    const formatted = formatFriendlyProblem(raw)
    assert.equal(formatted, 'ICP Qualification Guidance: Please enter up to 1500 characters.')
  })

  it('maps buyer_types item limit', () => {
    const raw = 'buyer_types: each item up to 80 characters'
    const formatted = formatFriendlyProblem(raw)
    assert.equal(formatted, 'Ideal Buyer Types: Each item must be 200 characters or less.')
  })

  it('maps "give exactly one of attribute or field"', () => {
    const raw = 'must_have[0]: give exactly one of "attribute" or "field" (letters, digits, _)'
    const formatted = formatFriendlyProblem(raw)
    assert.equal(formatted, 'Required Customer Qualification Criteria #1: Please enter a valid criteria name or fact (letters, digits, and underscores).')
    assert.doesNotMatch(formatted, /attribute" or "field/)
  })

  it('maps numeric and required value errors for criteria', () => {
    assert.equal(
      formatFriendlyProblem('must_have[0].value: a number'),
      'Required Customer Qualification Criteria #1 Value: Please enter a valid number.',
    )
    assert.equal(
      formatFriendlyProblem('must_have[0].label: required'),
      'Required Customer Qualification Criteria #1 Label: Please enter a label or description.',
    )
    assert.equal(
      formatFriendlyProblem('must_have[0].value: required'),
      'Required Customer Qualification Criteria #1 Value: Please enter a value for this criterion.',
    )
  })

  it('deduplicates and formats arrays of problems cleanly', () => {
    const problems = [
      'must_have[0].value: a number',
      'must_have[0].value: a number',
      'buyer_types: each item up to 80 characters',
    ]
    const list = formatFriendlyProblems(problems)
    assert.equal(list.length, 2)
    assert.equal(list[0], 'Required Customer Qualification Criteria #1 Value: Please enter a valid number.')
    assert.equal(list[1], 'Ideal Buyer Types: Each item must be 200 characters or less.')
  })
})

describe('friendlyFieldErrors & friendlyErrorSummary', () => {
  it('extracts field-level error mapping from problem strings', () => {
    const problems = [
      'industry_label: text of 1 to 5000 characters on one line',
      'must_have[0].value: a number',
    ]
    const map = friendlyFieldErrors(problems)
    assert.equal(map.industry_label, 'Please enter between 1 and 5000 characters.')
    assert.equal(map.must_have, 'Please enter a valid number.')
  })

  it('summarizes multiple errors nicely', () => {
    const problems = [
      'industry_label: text of 1 to 5000 characters on one line',
      'buyer_types: each item up to 80 characters',
    ]
    const summary = friendlyErrorSummary(problems)
    assert.ok(summary.includes('Industry / Organisation Profile'))
    assert.ok(summary.includes('Ideal Buyer Types'))
  })
})

