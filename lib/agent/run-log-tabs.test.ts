import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RUN_LOG_PATH, RUN_LOG_SECTION_IDS, effectiveSection, runLogSections, salesMarketingRunsHref, toRunLogSection } from './run-log-tabs'

/**
 * The Run Log after Agent Run History was merged into it (26 Nov 2026): two sections, the second offered only to a person the agent API lets in, in `?section=` so that it does not
 * overwrite the `?tab=` the Sales & Marketing screen keeps for its own sub-tabs.
 */
describe('which Run Log sections a person is offered', () => {
  it('always offers the Agentic AI runs, first', () => {
    for (const access of ['loading', 'allowed', 'denied', 'failed'] as const) {
      assert.equal(runLogSections(access, 'agentic', null)[0].id, 'agentic', access)
    }
  })

  it('offers Sales & Marketing agents to a person the agent API let in, with the number waiting on it', () => {
    const tabs = runLogSections('allowed', 'agentic', 3)
    assert.deepEqual(tabs.map((tab) => tab.label), ['Agentic AI runs', 'Sales & Marketing agents'])
    assert.equal(tabs[1].count, 3)
    assert.equal(runLogSections('allowed', 'agentic', null)[1].count, null, 'no number is guessed before it has been read')
  })

  it('never offers it to a person who was told they may not read it, even when the address asks for it', () => {
    assert.deepEqual(runLogSections('denied', 'agentic', null).map((tab) => tab.id), ['agentic'])
    assert.deepEqual(runLogSections('denied', 'sales-marketing', null).map((tab) => tab.id), ['agentic'])
  })

  it('offers it before the answer is here, or when the answer failed for another reason, only when the address asks for it', () => {
    for (const access of ['loading', 'failed'] as const) {
      assert.deepEqual(runLogSections(access, 'agentic', null).map((tab) => tab.id), ['agentic'], `${access} and not asked`)
      assert.deepEqual(runLogSections(access, 'sales-marketing', null).map((tab) => tab.id), ['agentic', 'sales-marketing'], `${access} and asked`)
      assert.equal(runLogSections(access, 'sales-marketing', 5)[1].count, null, 'a number from nowhere is never shown')
    }
  })
})

describe('which section is shown', () => {
  it('is the one the address names, unless it is Sales & Marketing and the person has been told they may not read it', () => {
    assert.equal(effectiveSection('sales-marketing', 'allowed'), 'sales-marketing')
    assert.equal(effectiveSection('sales-marketing', 'loading'), 'sales-marketing')
    assert.equal(effectiveSection('sales-marketing', 'failed'), 'sales-marketing', 'the screen inside says what went wrong')
    assert.equal(effectiveSection('sales-marketing', 'denied'), 'agentic')
    assert.equal(effectiveSection('agentic', 'denied'), 'agentic')
  })

  it('reads an unknown word in the address as the first section', () => {
    assert.equal(toRunLogSection('nonsense'), 'agentic')
    assert.equal(toRunLogSection(''), 'agentic')
    assert.equal(toRunLogSection('sales-marketing'), 'sales-marketing')
    assert.deepEqual([...RUN_LOG_SECTION_IDS], ['agentic', 'sales-marketing'])
  })
})

describe('where the retired Agent Run History address leads', () => {
  it('goes to the Sales & Marketing section of the Run Log, and keeps the sub-tab the old link named', () => {
    assert.equal(salesMarketingRunsHref(), `${RUN_LOG_PATH}?section=sales-marketing`)
    assert.equal(salesMarketingRunsHref('runs'), `${RUN_LOG_PATH}?section=sales-marketing`, 'runs is the plain address of that screen')
    assert.equal(salesMarketingRunsHref('waiting'), `${RUN_LOG_PATH}?section=sales-marketing&tab=waiting`)
    assert.equal(salesMarketingRunsHref('autonomy'), `${RUN_LOG_PATH}?section=sales-marketing&tab=autonomy`)
    assert.equal(salesMarketingRunsHref(null), `${RUN_LOG_PATH}?section=sales-marketing`)
  })

  it('writes the sub-tab with encodeURIComponent, so nothing in it can add a parameter or send a person elsewhere', () => {
    const href = salesMarketingRunsHref('waiting&section=agentic')
    assert.equal(href, `${RUN_LOG_PATH}?section=sales-marketing&tab=waiting%26section%3Dagentic`)
    assert.ok(href.startsWith('/module/agentic-ai/run-log?'), 'the path is fixed')
  })
})
