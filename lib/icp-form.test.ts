/**
 * The ICP editor's form <-> server settings conversion: nothing is invented, blanks stay blank, and a round trip changes nothing.
 */
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { fromConfig, toConfig } from './icp-form'
import type { IcpConfig } from '../services/signals/product-icp'

const stored: IcpConfig = {
  label: 'Enterprise Brain for manufacturers',
  industry_label: 'mid-size manufacturers',
  pitch: 'One memory across plants.',
  buyer_types: ['manufacturer'],
  regions: ['Gujarat', 'Maharashtra'],
  parts: { knowledge_layer: 'one searchable memory' },
  triggers: {
    new_plant: { source: 'news', part: 'knowledge_layer', decay: 90, pain: 'a new plant needs shared knowledge', phrases: ['new plant', 'second site'] },
    tender: { source: 'tender', decay: null, phrases: ['knowledge management system'] },
  },
  queries: [{ id: 'eb-news', source: 'news', topic: 'news', days: 45, q: 'manufacturer announces new plant', domains: ['linkedin.com'] }],
  disqualifiers: [{ label: 'trader', phrases: ['trading company'] }],
  must_have: [
    { attribute: 'employees', op: '>=', value: 100, label: 'under 100 employees' },
    { field: 'state', op: 'in_regions', label: 'outside the target regions' },
    { attribute: 'turnover', op: 'between', value: [10, 500], label: 'turnover outside 10 to 500' },
    { attribute: 'type', op: 'in', value: ['private', 'trust'], label: 'not private' },
  ],
  per_run: { catalogue: 1, accounts: 0 },
}

describe('ICP form conversion', () => {
  it('round-trips a stored ICP without changing it', () => {
    const out = toConfig(fromConfig(stored, 'Name'))
    assert.equal(out.label, stored.label)
    assert.deepEqual(out.triggers, stored.triggers)
    assert.deepEqual(out.queries, stored.queries)
    assert.deepEqual(out.must_have, stored.must_have)
    assert.deepEqual(out.parts, stored.parts)
    assert.deepEqual(out.regions, stored.regions)
    assert.deepEqual(out.per_run, stored.per_run)
  })

  it('starts empty for a product with no ICP and invents nothing', () => {
    const out = toConfig(fromConfig({}, ''))
    assert.equal(out.label, '')
    assert.equal(out.industry_label, '')
    assert.deepEqual(out.parts, {})
    assert.deepEqual(out.triggers, {})
    assert.deepEqual(out.queries, [])
    assert.deepEqual(out.must_have, [])
    assert.deepEqual(out.per_run, {})
    assert.deepEqual(out.buyer_types, [])
  })

  it('reads one-per-line and comma lists, trimming and dropping blanks', () => {
    const f = fromConfig({}, '')
    f.regions = ' Gujarat \n\nMaharashtra, Goa ,'
    assert.deepEqual(toConfig(f).regions, ['Gujarat', 'Maharashtra', 'Goa'])
  })

  it('treats a blank freshness as "until the closing date" and keeps a typed one as a number', () => {
    const f = fromConfig(stored, '')
    assert.equal(f.triggers[1].decay, '')
    assert.equal((toConfig(f).triggers ?? {}).tender.decay, null)
    f.triggers[0].decay = '30'
    assert.equal((toConfig(f).triggers ?? {}).new_plant.decay, 30)
  })

  it('parses a rule value by its operator and sends none for "inside the target regions"', () => {
    const f = fromConfig(stored, '')
    const by = (op: string) => f.must_have.find((r) => r.op === op)!
    by('between').value = '5, 50'
    by('in').value = 'a, b, c'
    by('>=').value = '250'
    const rules = toConfig(f).must_have ?? []
    assert.deepEqual(rules.find((r) => r.op === 'between')?.value, [5, 50])
    assert.deepEqual(rules.find((r) => r.op === 'in')?.value, ['a', 'b', 'c'])
    assert.equal(rules.find((r) => r.op === '>=')?.value, 250)
    const region = rules.find((r) => r.op === 'in_regions')!
    assert.equal('value' in region, false)
    assert.equal(region.field, 'state')
  })

  it('keeps an attribute rule and a field rule apart', () => {
    const rules = toConfig(fromConfig(stored, '')).must_have ?? []
    assert.equal(rules[0].attribute, 'employees')
    assert.equal('field' in rules[0], false)
    assert.equal(rules[1].field, 'state')
    assert.equal('attribute' in rules[1], false)
  })

  it('sends a non-numeric number field as typed so the server can refuse it instead of the form guessing', () => {
    const f = fromConfig(stored, '')
    f.queries[0].days = 'soon'
    assert.equal(toConfig(f).queries?.[0].days, 'soon')
  })
})
