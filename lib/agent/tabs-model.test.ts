import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readTab, writeTab } from '../../components/shared/scaffolds/url-tab'
import { AGENT_TAB_IDS, AGENT_TAB_PARAM, agentTabs, autonomyAccess, effectiveTab, toAgentTab, type AutonomyPhase } from './tabs-model'

describe('the address of an Agent Run History tab', () => {
  const FALLBACK = AGENT_TAB_IDS[0]

  it('has Runs first, so the plain address is the list of runs as it always was', () => {
    assert.deepEqual([...AGENT_TAB_IDS], ['runs', 'waiting', 'autonomy'])
    assert.equal(AGENT_TAB_PARAM, 'tab')
  })

  it('reads back every tab the way it was written, and keeps the plain address for Runs', () => {
    for (const id of AGENT_TAB_IDS) {
      const written = writeTab(new URLSearchParams(), id, FALLBACK, AGENT_TAB_PARAM)
      assert.equal(readTab(written, AGENT_TAB_IDS, FALLBACK, AGENT_TAB_PARAM), id, id)
    }
    assert.equal(writeTab(new URLSearchParams(), 'runs', FALLBACK, AGENT_TAB_PARAM).toString(), '')
    assert.equal(writeTab(new URLSearchParams(), 'waiting', FALLBACK, AGENT_TAB_PARAM).toString(), 'tab=waiting')
    assert.equal(writeTab(new URLSearchParams(), 'autonomy', FALLBACK, AGENT_TAB_PARAM).toString(), 'tab=autonomy')
  })

  it('opens Runs for a tab that does not exist, and keeps every other address parameter', () => {
    assert.equal(readTab(new URLSearchParams('tab=nonsense'), AGENT_TAB_IDS, FALLBACK, AGENT_TAB_PARAM), 'runs')
    assert.equal(readTab(new URLSearchParams(''), AGENT_TAB_IDS, FALLBACK, AGENT_TAB_PARAM), 'runs')
    assert.equal(writeTab(new URLSearchParams('x=1'), 'waiting', FALLBACK, AGENT_TAB_PARAM).toString(), 'x=1&tab=waiting')
  })
})

describe('the tab an address names', () => {
  it('is one of ours, and Runs for anything else', () => {
    for (const id of AGENT_TAB_IDS) assert.equal(toAgentTab(id), id)
    for (const bad of ['', 'RUNS', 'settings', 'waiting ', '__proto__']) assert.equal(toAgentTab(bad), 'runs', bad)
  })
})

describe('who is offered the Autonomy tab', () => {
  const phases: AutonomyPhase[] = ['loading', 'ready', 'error', 'unavailable', 'forbidden']

  it('offers it to an administrator, and to nobody else whose answer is in', () => {
    assert.equal(autonomyAccess('ready', true), 'shown')
    assert.equal(autonomyAccess('ready', false), 'hidden', 'administrators only: a person who may not change the levels has no tab and no controls')
    assert.equal(autonomyAccess('ready', null), 'hidden', 'an answer that does not say is not a yes')
    assert.equal(autonomyAccess('forbidden', null), 'hidden', 'a person who may not even read them')
  })

  it('does not guess while the answer is on its way, and says what went wrong when it could not be read', () => {
    assert.equal(autonomyAccess('loading', null), 'pending')
    assert.equal(autonomyAccess('loading', true), 'pending')
    assert.equal(autonomyAccess('error', null), 'shown', 'the tab is where a failure to read is said, with Retry')
    assert.equal(autonomyAccess('unavailable', null), 'shown', 'the tab is where "this server does not have it yet" is said')
  })

  it('lands a person who may not have the tab, and pasted its address, on Runs; everybody else gets the tab they asked for', () => {
    assert.equal(effectiveTab('autonomy', 'hidden'), 'runs')
    for (const access of ['shown', 'pending'] as const) assert.equal(effectiveTab('autonomy', access), 'autonomy', access)
    for (const tab of ['runs', 'waiting'] as const) for (const access of ['shown', 'pending', 'hidden'] as const) assert.equal(effectiveTab(tab, access), tab, `${tab} ${access}`)
  })

  it('lists Runs and Waiting for you always, and Autonomy only where it is offered (or asked for while the answer is on its way)', () => {
    const ids = (access: 'pending' | 'shown' | 'hidden', url: 'runs' | 'waiting' | 'autonomy') => agentTabs(access, url, null).map((tab) => tab.id)
    assert.deepEqual(ids('shown', 'runs'), ['runs', 'waiting', 'autonomy'])
    assert.deepEqual(ids('hidden', 'runs'), ['runs', 'waiting'])
    assert.deepEqual(ids('hidden', 'autonomy'), ['runs', 'waiting'], 'a hidden tab is not listed even when the address asks for it')
    assert.deepEqual(ids('pending', 'runs'), ['runs', 'waiting'], 'no tab flickers in for everyone while the answer is on its way')
    assert.deepEqual(ids('pending', 'autonomy'), ['runs', 'waiting', 'autonomy'], 'but the one the address asked for is there, so there is something to show')
    for (const phase of phases) assert.ok(agentTabs(autonomyAccess(phase, phase === 'ready' ? false : null), 'runs', null).length >= 2)
  })

  it('puts the count on Waiting for you only once it is known, and a count of zero is a count', () => {
    const waiting = (count: number | null) => agentTabs('hidden', 'runs', count).find((tab) => tab.id === 'waiting')!.count
    assert.equal(waiting(null), null)
    assert.equal(waiting(0), 0)
    assert.equal(waiting(7), 7)
    assert.equal(agentTabs('shown', 'runs', 7).find((tab) => tab.id === 'runs')!.count, undefined, 'Runs carries no count')
    assert.deepEqual(agentTabs('shown', 'runs', 7).map((tab) => tab.label), ['Runs', 'Waiting for you', 'Autonomy'])
  })
})
