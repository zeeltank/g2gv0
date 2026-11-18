import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import type { AgentEnvelope, AutonomyState, ProposalsPage } from '../../services/agent/types'
import { axeViolations } from './a11y'
import { absent, says } from './assertions'
import { autonomyResponse, autonomyState, proposalsPage, queuedProposal } from './fixtures'
import { agentScreen, deferred } from './screen-kit'

const notAdmin = () => autonomyResponse({ can: { change: false } })

describe('Agent Run History: the tabs', () => {
  afterEach(disposeAll)

  it('opens on Runs with the plain address, and lists Runs, Waiting for you with its number, and Autonomy for an administrator', async () => {
    const s = await agentScreen()
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2', 'Autonomy'])
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true')
    assert.equal(s.k.one('h1')!.textContent, 'Agent run history')
    assert.ok(s.k.one('[data-runs-panel]'), 'the Runs tab is the list of runs')
    assert.equal(s.router.written.length, 0, 'the address was not touched')
    assert.equal(s.tab('Waiting for you')!.getAttribute('aria-label'), 'Waiting for you 2', 'a name a screen reader can say, with the count')
  })

  it('has no sidebar entry of its own: it is one screen, and the tabs are the only new thing on it', async () => {
    const s = await agentScreen()
    assert.equal(s.k.all('h1').length, 1)
    assert.equal(s.k.all('[role="tablist"]').length, 1)
    assert.equal(s.k.all('[role="tabpanel"]').length, 3)
  })

  it('reads the number waiting with one row, because only the total is wanted', async () => {
    const s = await agentScreen({ overrides: { proposals: async () => proposalsPage([queuedProposal()], { total: 14 }) } })
    assert.deepEqual(s.calls.proposals[0], { status: 'pending', page: 1, per_page: 1 })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you14', 'Autonomy'])
  })

  it('says a count of zero as zero', async () => {
    const s = await agentScreen({ overrides: { proposals: async () => proposalsPage([], { total: 0 }) } })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you0', 'Autonomy'])
  })

  it('writes the tab into the address and reads it back: Waiting, Autonomy, and the plain address for Runs', async () => {
    const s = await agentScreen()
    await s.openTab('Waiting for you')
    assert.equal(s.router.lastSearch(), 'tab=waiting')
    assert.equal(s.tab('Waiting for you')!.getAttribute('aria-selected'), 'true')
    await s.openTab('Autonomy')
    assert.equal(s.router.lastSearch(), 'tab=autonomy')
    await s.openTab('Runs')
    assert.equal(s.router.lastSearch(), '', 'Runs keeps the plain address')
    assert.ok(s.k.one('[data-runs-panel]'))
  })

  it('opens the tab a pasted address names, and builds only that tab', async () => {
    const s = await agentScreen({ search: 'tab=waiting' })
    assert.equal(s.tab('Waiting for you')!.getAttribute('aria-selected'), 'true')
    assert.ok(s.k.one('section[data-queue-state="ready"]'), 'the waiting list is open')
    absent(s.k.one('[data-runs-panel]'), 'it is not there')
    assert.deepEqual(s.calls.runs, [], 'the list of runs was not asked for: its tab is not open')
  })

  it('opens Runs for an address that names no tab, or one that does not exist', async () => {
    for (const search of ['tab=nonsense', 'tab=', 'x=1']) {
      const s = await agentScreen({ search })
      assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true', search)
      await disposeAll()
    }
  })

  it('moves between the tabs with the arrow keys, Home and End, and the address follows', async () => {
    const s = await agentScreen()
    s.tab('Runs')!.focus()
    await s.k.press('ArrowRight')
    await s.k.tick(20)
    assert.equal(s.tab('Waiting for you')!.getAttribute('aria-selected'), 'true')
    assert.equal(s.router.lastSearch(), 'tab=waiting')
    await s.k.press('End')
    await s.k.tick(20)
    assert.equal(s.tab('Autonomy')!.getAttribute('aria-selected'), 'true')
    await s.k.press('Home')
    await s.k.tick(20)
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true')
  })

  it('does not look anything up without a session', async () => {
    const s = await agentScreen({ session: false })
    assert.deepEqual(s.calls.proposals, [])
    assert.equal(s.calls.autonomy, 0)
    assert.deepEqual(s.calls.runs, [])
  })

  it('has only one tablist, each tab controlling a panel that is on the page, and no violations in any tab', async () => {
    const s = await agentScreen()
    for (const name of ['Runs', 'Waiting for you', 'Autonomy']) {
      await s.openTab(name)
      const root = s.k.one('h1')?.closest('div.mx-auto') as HTMLElement | null
      assert.ok(root, name)
      assert.deepEqual(await axeViolations(root), [], name)
    }
  })
})

describe('Agent Run History: who gets the Autonomy tab', () => {
  afterEach(disposeAll)

  it('gives a person who may not change the levels no Autonomy tab, and no panel for it', async () => {
    const s = await agentScreen({ overrides: { autonomy: async () => notAdmin() } })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2'])
    assert.equal(s.k.all('[role="tabpanel"]').length, 2, 'no panel that points at a tab that is not there')
    assert.equal(s.k.bodyText().includes('Autonomy'), false)
  })

  it('lands a non-administrator who pastes the Autonomy address on Runs, and cleans the address', async () => {
    const s = await agentScreen({ search: 'tab=autonomy', overrides: { autonomy: async () => notAdmin() } })
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true')
    assert.ok(s.k.one('[data-runs-panel]'), 'the runs are shown')
    assert.deepEqual(s.router.written, ['/module/crm/marketing/agent-runs'], 'the address says what they are looking at')
    assert.equal(s.k.all('select').length > 0 && s.k.one('[data-action-row]') !== null, false, 'no settings were drawn at all')
    assert.equal(s.calls.setAutonomy.length + s.calls.setKillSwitch.length, 0)
  })

  it('shows Runs at once to a person who pasted the Autonomy address and may not have it, before the router has applied the cleaned address', async () => {
    const s = await agentScreen({ search: 'tab=autonomy', frozenAddress: true, overrides: { autonomy: async () => notAdmin() } })
    assert.deepEqual(s.router.written, ['/module/crm/marketing/agent-runs'], 'the cleaned address was asked for, and (in this router) never applied')
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true', 'the tab strip already says Runs')
    assert.ok(s.k.one('[data-runs-panel]'), 'and the runs are on the page, not an empty tab')
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2'])
  })

  it('lands a person who may not even read the settings (a 403) on Runs as well', async () => {
    const s = await agentScreen({ search: 'tab=autonomy', overrides: { autonomy: async () => { throw new ApiError('no', 403) } } })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2'])
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true')
    assert.deepEqual(s.router.written, ['/module/crm/marketing/agent-runs'], 'the address was rewritten to the plain one (an empty last search would also be true of an address nobody touched)')
  })

  it('does not list the tab for everybody while the answer is on its way, but shows it for the person whose address asked for it', async () => {
    const pending = deferred<AgentEnvelope<AutonomyState>>()
    const s = await agentScreen({ overrides: { autonomy: () => pending.promise } })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2'], 'no tab flickers in for a person who will not get it')
    await s.k.unmount()

    const asked = deferred<AgentEnvelope<AutonomyState>>()
    const t = await agentScreen({ search: 'tab=autonomy', overrides: { autonomy: () => asked.promise } })
    assert.deepEqual(t.tabNames(), ['Runs', 'Waiting for you2', 'Autonomy'])
    says(t.k.bodyText(), 'Opening the autonomy settings…')
    asked.resolve(autonomyResponse())
    await t.k.tick(20)
    assert.ok(t.k.one('[data-autonomy-state="ready"]'), 'an administrator stays on the tab they asked for')
    assert.equal(t.router.written.length, 0)
  })

  it('takes a person who was shown the tab while it was loading off it, onto Runs, when the answer says they may not change the levels', async () => {
    const asked = deferred<AgentEnvelope<AutonomyState>>()
    const s = await agentScreen({ search: 'tab=autonomy', overrides: { autonomy: () => asked.promise } })
    says(s.k.bodyText(), 'Opening the autonomy settings…')
    asked.resolve(notAdmin())
    await s.k.tick(20)
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2'])
    assert.equal(s.tab('Runs')!.getAttribute('aria-selected'), 'true')
    assert.deepEqual(s.router.written, ['/module/crm/marketing/agent-runs'], 'the address was rewritten to the plain one (an empty last search would also be true of an address nobody touched)')
  })

  it('shows the tab, with the failure and a way to try again, when the settings could not be read', async () => {
    let attempts = 0
    const s = await agentScreen({ search: 'tab=autonomy', overrides: { autonomy: async () => { attempts += 1; if (attempts === 1) throw new ApiError('The server is busy.', 503); return autonomyResponse() } } })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2', 'Autonomy'])
    says(s.k.bodyText(), 'The autonomy settings could not be opened.')
    says(s.k.bodyText(), 'The server is busy.')
    await s.press(s.button('Retry'))
    assert.equal(attempts, 2)
    assert.ok(s.k.one('[data-autonomy-state="ready"]'))
  })
})

describe('Agent Run History: a server that does not have the new tabs yet', () => {
  afterEach(disposeAll)

  const lacking: Parameters<typeof agentScreen>[0] = {
    overrides: {
      proposals: async () => { throw new ApiError('The route api/agent/proposals could not be found.', 404) },
      autonomy: async () => { throw new ApiError('The route api/agent/autonomy could not be found.', 404) },
    },
  }

  it('keeps Runs working, shows no count, and says in words, in the tabs that need it, that this server does not have it yet', async () => {
    const s = await agentScreen(lacking)
    assert.ok(s.k.one('[data-runs-panel]'), 'Runs works')
    assert.equal(s.k.all('tbody tr[data-run]').length, 2)
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you', 'Autonomy'])
    assert.equal(s.tab('Waiting for you')!.getAttribute('aria-label'), null, 'no number is shown that was never read')

    await s.openTab('Waiting for you')
    says(s.panel()!.textContent!, 'This server does not have the waiting list yet. The other tabs keep working.')
    absent(s.button('Retry', s.panel()!), 'there is nothing to retry')

    await s.openTab('Autonomy')
    says(s.panel()!.textContent!, 'This server does not have the autonomy settings yet. The other tabs keep working.')

    await s.openTab('Runs')
    assert.equal(s.k.all('tbody tr[data-run]').length, 2, 'and Runs still works after the others were opened')
  })

  it('has no accessibility violations in those states', async () => {
    const s = await agentScreen(lacking)
    for (const name of ['Waiting for you', 'Autonomy', 'Runs']) {
      await s.openTab(name)
      assert.deepEqual(await axeViolations(s.k.one('h1')!.closest('div.mx-auto') as HTMLElement), [], name)
    }
  })
})

describe('Agent Run History: the number on the Waiting tab and what depends on a decision', () => {
  afterEach(disposeAll)

  it('shows the number the list reports each time it reads, so a decision moves it', async () => {
    let total = 2
    const s = await agentScreen({
      search: 'tab=waiting',
      overrides: { proposals: async (params) => (params.per_page === 1 ? proposalsPage([queuedProposal()], { total }) : proposalsPage(total === 2 ? [queuedProposal({ id: 1 }), queuedProposal({ id: 2 })] : [queuedProposal({ id: 2 })], { total })) },
    })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you2', 'Autonomy'])
    total = 1
    await s.press(s.button('Accept', s.k.one('[data-proposal="1"]')!))
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you1', 'Autonomy'])
  })

  it('does not let the first, slower count read put an old number over the list\'s newer one', async () => {
    const first = deferred<ReturnType<typeof proposalsPage>>()
    const s = await agentScreen({
      search: 'tab=waiting',
      overrides: { proposals: (params) => (params.per_page === 1 ? first.promise : Promise.resolve(proposalsPage([queuedProposal()], { total: 5 }))) },
    })
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you5', 'Autonomy'], 'the list reported 5')
    first.resolve(proposalsPage([queuedProposal()], { total: 99 }))
    await s.k.tick(20)
    assert.deepEqual(s.tabNames(), ['Runs', 'Waiting for you5', 'Autonomy'], 'the late count of 99 was dropped')
  })

  it('reads the autonomy settings again after a decision, so the counters under each level and the kill switch are current', async () => {
    const s = await agentScreen({ search: 'tab=waiting' })
    const before = s.calls.autonomy
    await s.press(s.button('Accept', s.k.one('[data-proposal="1"]')!))
    assert.equal(s.calls.autonomy, before + 1)
  })

  it('does not read them again just because a tab was opened or the list was read', async () => {
    const s = await agentScreen({ search: 'tab=waiting' })
    const before = s.calls.autonomy
    await s.press(s.button('Refresh', s.panel()!))
    await s.openTab('Runs')
    assert.equal(s.calls.autonomy, before)
  })

  it('hands the waiting list the kill switch the settings reported, so it can say the agent is off', async () => {
    const s = await agentScreen({ search: 'tab=waiting', overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'organisation' } }) } })
    says(s.panel()!.textContent!, 'The agent is switched off for your organisation, so a proposal cannot be accepted')
    assert.equal(autonomyState().kill_switch.on, false)
  })
})

describe('Agent Run History: Runs is as it was', () => {
  afterEach(disposeAll)

  it('shows the same summary, filters, table and paging as before the tabs, with Refresh as the first thing in the tab', async () => {
    const s = await agentScreen()
    const panel = s.k.one('[data-runs-panel]')!
    assert.deepEqual(['total', 'completed', 'waiting', 'applied'].map((name) => panel.querySelector(`[data-stat="${name}"]`)?.textContent), ['2', '1', '2', '1'])
    says(panel.textContent!, 'Started from')
    assert.equal(panel.querySelectorAll('tbody tr[data-run]').length, 2)
    assert.equal(panel.querySelector('button')?.textContent?.trim(), 'Refresh')
    await s.press(s.button('Refresh', panel))
    assert.equal(s.calls.runs.length, 2)
  })
})
