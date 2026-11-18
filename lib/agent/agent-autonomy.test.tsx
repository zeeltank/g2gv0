import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import type { AgentEnvelope, AutonomyAction, AutonomyState, KillSwitch } from '../../services/agent/types'
import { axeViolations } from './a11y'
import { absent, same, says } from './assertions'
import { autonomyAction, autonomyResponse, autonomyState, proposalsPage, queuedProposal } from './fixtures'
import { agentScreen, deferred, type ScreenOptions } from './screen-kit'
import { NETWORK_TEXT } from './model'

/** The Autonomy tab, opened by its address, over a fake server. */
async function autonomy(options: ScreenOptions = {}) {
  const s = await agentScreen({ search: 'tab=autonomy', ...options })
  const row = (key: string) => s.k.one(`li[data-action-row="${key}"]`) as HTMLElement
  const select = (key: string) => row(key).querySelector('select') as HTMLSelectElement
  const within = (root: Element | null) => (label: string) => s.button(label, root ?? s.k.w.document)
  const form = (key: string) => row(key).querySelector('[data-change-form]') as HTMLElement | null
  const kill = () => s.k.one('[data-kill-switch]') as HTMLElement
  return { ...s, row, select, within, form, kill }
}
type Autonomy = Awaited<ReturnType<typeof autonomy>>

/** Chooses a level in a row's select and presses Save (or the confirming button). */
async function change(s: Autonomy, key: string, level: string, reason?: string) {
  await s.choose(s.select(key), level)
  if (reason !== undefined) await s.type(s.form(key)!.querySelector('textarea') as HTMLElement, reason)
  const form = s.form(key)!
  const save = Array.from(form.querySelectorAll('button')).find((b) => /^(Save|Let the agent)/.test(b.textContent!.trim())) as HTMLButtonElement
  // A click focuses the button in a browser; the fake one does not, and a focus that was never anywhere else proves nothing about where it goes afterwards.
  save.focus()
  await s.press(save)
}

describe('Autonomy: what it shows', () => {
  afterEach(disposeAll)

  it('says what it is for, once, and why there are three levels that wait', async () => {
    const s = await autonomy()
    assert.equal(s.k.one('h2')!.textContent, 'Autonomy')
    says(s.panel()!.textContent!, 'if people accept nearly everything, it may be safe to let the agent do it on its own')
    says(s.panel()!.textContent!, 'Suggest, Draft and Needs approval all work the same way today')
  })

  it('has one row for each action the server lists, in its order, with its plain-English label and description, and no way to add another', async () => {
    const s = await autonomy()
    assert.deepEqual(s.k.all('li[data-action-row]').map((li) => li.getAttribute('data-action-row')), ['add_note', 'add_task', 'confirm_link'])
    assert.equal(s.row('add_note').querySelector('h3')!.textContent, 'Add a note')
    says(s.row('add_note').textContent!, 'The agent writes a short note on the organisation, marked "Agent", that cites the records it rests on.')
    assert.equal(s.row('confirm_link').querySelector('h3')!.textContent, 'Confirm two records are the same organisation')
    assert.equal(s.k.all('input[type="text"], button').filter((el) => /add (an )?action/i.test(el.textContent ?? '')).length, 0)
  })

  it('shows the current level as a select, offering the levels the server lists with their words, and the default beside it', async () => {
    const s = await autonomy()
    assert.equal(s.select('add_note').value, 'alone')
    assert.equal(s.select('add_task').value, 'approval')
    assert.deepEqual(Array.from(s.select('add_note').options).map((o) => [o.value, o.textContent]), [['off', 'Off'], ['suggest', 'Suggest'], ['draft', 'Draft'], ['approval', 'Needs approval'], ['alone', 'On its own']])
    says(s.row('add_note').querySelector('[data-default]')!.textContent!, 'Default: On its own. Your organisation has not changed it.')
    says(s.row('add_task').querySelector('[data-default]')!.textContent!, 'Default: On its own. Your organisation has changed it.')
  })

  it('says what the current level means, in a sentence, beside the select', async () => {
    const s = await autonomy()
    says(s.row('add_note').querySelector('[data-effect]')!.textContent!, 'On its own: The agent does it without asking, and the record is marked Agent.')
    says(s.row('confirm_link').querySelector('[data-effect]')!.textContent!, 'Needs approval: The agent proposes it and waits for a person to accept or dismiss it.')
  })

  it('names each select by its action, so a screen reader hears which one it is on', async () => {
    const s = await autonomy()
    const names = ['add_note', 'add_task', 'confirm_link'].map((key) => {
      const select = s.select(key)
      return select.getAttribute('aria-labelledby')!.split(' ').map((id) => s.k.w.document.getElementById(id)!.textContent).join(' ')
    })
    assert.deepEqual(names, ['Add a note Level', 'Add a follow-up task Level', 'Confirm two records are the same organisation Level'])
  })

  it('shows who last changed each level and when, or that nothing is on record', async () => {
    const s = await autonomy()
    assert.ok(s.row('add_task').querySelector('[data-last-changed]')!.textContent!.startsWith('Last changed by Anil Shah on 3 Nov 2026'))
    assert.equal(s.row('add_note').querySelector('[data-last-changed]')!.textContent, 'No change is on record.')
  })

  it('shows the last 30 days of each action with the server\'s own numbers, and says accepted is INSIDE applied, never as a count of its own', async () => {
    const s = await autonomy()
    const counts = s.row('add_note').querySelector('[data-counts]')!
    assert.equal(s.row('add_note').querySelector('h4')!.textContent, 'Last 30 days')
    assert.deepEqual(Array.from(counts.querySelectorAll('[data-count]')).map((el) => el.getAttribute('data-count')), ['proposed', 'applied', 'dismissed', 'failed', 'waiting'])
    const value = (key: string) => counts.querySelector(`[data-count="${key}"] dd`)!.textContent
    assert.deepEqual(['proposed', 'applied', 'dismissed', 'failed', 'waiting'].map(value), ['11', '6', '2', '1', '2'])
    says(counts.querySelector('[data-count="applied"]')!.textContent!, 'including 2 accepted by a person')
    absent(counts.querySelector('[data-count="accepted"]'), 'accepted has no number of its own to be added to applied')
  })

  it('says so, in words, when the agent made no proposal of that kind', async () => {
    const s = await autonomy()
    says(s.row('confirm_link').querySelector('[data-counts-empty]')!.textContent!, 'The agent made no proposal of this kind in the last 30 days.')
    absent(s.row('confirm_link').querySelector('[data-counts]'), 'it is not there')
  })

  it('shows a text a model or a person wrote as text, never as markup', async () => {
    const evil = '<img src=x onerror="window.__pwned = 1"><script>window.__pwned = 2</script>'
    const state = autonomyState({ actions: [autonomyAction('add_note', { label: `Note ${evil}`, description: `Desc ${evil}`, last_changed: { at: '2026-11-03T15:22:57+00:00', by_name: `Eve ${evil}` } })] })
    const s = await autonomy({ overrides: { autonomy: async () => ({ status: 1, data: state }) } })
    assert.equal(s.panel()!.querySelectorAll('img, script').length, 0)
    says(s.panel()!.textContent!, evil)
  })

  it('shows an action the screen has no words for by the server\'s own label, and a level it has no words for by its key made readable', async () => {
    const state = autonomyState({ actions: [autonomyAction('add_meeting', { label: 'Book a meeting', default: 'approval', level: 'draft_for_review', levels: ['off', 'approval'] })] })
    const s = await autonomy({ overrides: { autonomy: async () => ({ status: 1, data: state }) } })
    assert.equal(s.row('add_meeting').querySelector('h3')!.textContent, 'Book a meeting')
    assert.equal(s.select('add_meeting').value, 'draft_for_review')
    says(s.row('add_meeting').querySelector('[data-effect]')!.textContent!, 'Draft for review: A level this screen has no words for.')
  })
})

describe('Autonomy: changing a level', () => {
  afterEach(disposeAll)

  it('stages a choice and saves nothing until Save is pressed: the select shows the choice, the reason is asked for, and the level on file is still said', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'approval')
    assert.equal(s.calls.setAutonomy.length, 0, 'choosing is not saving')
    assert.equal(s.select('add_note').value, 'approval')
    const form = s.form('add_note')!
    says(form.textContent!, 'Change to “Needs approval”?')
    says(form.textContent!, 'The agent proposes it and waits for a person to accept or dismiss it.')
    says(form.textContent!, 'Why are you changing it? (optional, kept in the audit trail)')
    says(form.textContent!, '0 of 300 characters.')
    assert.equal((form.querySelector('textarea') as HTMLTextAreaElement).maxLength, 300, 'a reason is as long as the server accepts, and no longer')
    assert.ok(s.row('add_note').querySelector('[data-effect]')!.textContent!.startsWith('On its own:'), 'the saved level is still the one on file')
    absent(form.querySelector('[data-warning]'), 'no warning for a level that waits for a person')
    assert.ok(s.within(form)('Save: Needs approval'))
  })

  it('saves the level, with the reason, through the settings route, and says the result in words', async () => {
    const s = await autonomy()
    await change(s, 'add_note', 'approval', '  People dismiss most of them  ')
    assert.deepEqual(s.calls.setAutonomy, [{ key: 'add_note', level: 'approval', reason: '  People dismiss most of them  ' }], 'the service trims it')
    assert.equal(s.select('add_note').value, 'approval')
    assert.ok(s.row('add_note').querySelector('[data-effect]')!.textContent!.startsWith('Needs approval:'))
    absent(s.form('add_note'), 'the form closed')
    says(s.row('add_note').querySelector('[data-message="status"]')!.textContent!, 'Saved. “Add a note” is now set to Needs approval. The agent proposes it and waits for a person to accept or dismiss it.')
    assert.ok(s.row('add_note').querySelector('[data-last-changed]')!.textContent!.includes('Last changed by Anil Shah on 4 Nov 2026'), 'the row shows what the server answered')
  })

  it('saves without a reason when none was typed', async () => {
    const s = await autonomy()
    await change(s, 'add_note', 'off')
    assert.deepEqual(s.calls.setAutonomy, [{ key: 'add_note', level: 'off', reason: undefined }])
  })

  it('changes only that row: the other rows keep what they showed', async () => {
    const s = await autonomy()
    await change(s, 'add_note', 'off')
    assert.equal(s.select('add_task').value, 'approval')
    assert.equal(s.select('confirm_link').value, 'approval')
    assert.ok(s.row('add_task').querySelector('[data-counts]'), 'and the counters of the others are untouched')
  })

  it('keeps the focus on the row\'s select after a save, because the button that was pressed has left the page', async () => {
    const s = await autonomy()
    await change(s, 'add_note', 'approval')
    await s.k.tick(20)
    same(s.focused(), s.select('add_note'), 'the focus is on the select of the row that was changed')
  })

  it('says so when the level went back to the default, which the server answers as not overridden', async () => {
    const s = await autonomy()
    await change(s, 'add_task', 'alone')
    says(s.row('add_task').querySelector('[data-message="status"]')!.textContent!, 'is now back at the default, On its own.')
    says(s.row('add_task').querySelector('[data-default]')!.textContent!, 'Your organisation has not changed it.')
  })

  it('goes back to how the row was when the level on file is chosen again, and does not offer to save it', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'off')
    assert.ok(s.form('add_note'))
    await s.choose(s.select('add_note'), 'alone')
    absent(s.form('add_note'), 'it is not there')
    assert.equal(s.calls.setAutonomy.length, 0)
  })

  it('closes the staged change on Escape, puts the level on file back, sends nothing and gives the focus back to the select', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'off')
    s.within(s.form('add_note'))('Save')!.focus()
    await s.k.press('Escape')
    await s.k.tick(20)
    absent(s.form('add_note'), 'it is not there')
    assert.equal(s.select('add_note').value, 'alone')
    assert.equal(s.calls.setAutonomy.length, 0)
    same(s.focused(), s.select('add_note'), 'the focus is back on the select')
  })

  it('closes the staged change with Cancel, forgetting what was typed', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'off')
    await s.type(s.form('add_note')!.querySelector('textarea') as HTMLElement, 'typed and abandoned')
    await s.press(s.within(s.form('add_note'))('Cancel'))
    absent(s.form('add_note'), 'it is not there')
    await s.choose(s.select('add_note'), 'off')
    assert.equal((s.form('add_note')!.querySelector('textarea') as HTMLTextAreaElement).value, '', 'the next change starts with an empty reason')
  })

  it('lets two rows each hold a staged change, and saves them one at a time', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'off')
    await s.choose(s.select('confirm_link'), 'suggest')
    assert.ok(s.form('add_note') && s.form('confirm_link'))
    await s.press(s.within(s.form('add_note'))('Save: Off'))
    assert.ok(s.form('confirm_link'), 'the other row\'s choice is still waiting for its Save')
    assert.deepEqual(s.calls.setAutonomy.map((c) => c.key), ['add_note'])
  })
})

describe('Autonomy: letting the agent act on its own', () => {
  afterEach(disposeAll)

  it('warns, in plain English, what "On its own" means for that action, before anything is saved, and names the button for what it does', async () => {
    const s = await autonomy()
    await s.choose(s.select('confirm_link'), 'alone')
    const form = s.form('confirm_link')!
    assert.equal(s.calls.setAutonomy.length, 0)
    const warning = form.querySelector('[data-warning]')!.textContent!
    assert.ok(warning.startsWith('Warning:'), 'the warning is a word, not only a colour')
    says(warning, 'without asking')
    says(warning, '“Confirm two records are the same organisation”')
    says(warning, 'nobody accepts it first')
    says(warning, 'marked Agent')
    says(warning, 'lower level again at any time')
    assert.ok(s.within(form)('Let the agent do this on its own'))
    absent(s.within(form)('Save'), 'there is no easier button beside it')
  })

  it('needs the second, deliberate click: choosing On its own saves nothing, and the button after the warning saves it', async () => {
    const s = await autonomy()
    await s.choose(s.select('confirm_link'), 'alone')
    assert.equal(s.calls.setAutonomy.length, 0)
    await s.press(s.within(s.form('confirm_link'))('Let the agent do this on its own'))
    assert.deepEqual(s.calls.setAutonomy, [{ key: 'confirm_link', level: 'alone', reason: undefined }])
    assert.equal(s.select('confirm_link').value, 'alone')
    says(s.row('confirm_link').querySelector('[data-message="status"]')!.textContent!, 'now set to On its own')
  })

  it('never saves On its own from a keyboard walking through the select: every level on the way is only staged', async () => {
    const s = await autonomy()
    for (const level of ['draft', 'approval', 'alone']) await s.choose(s.select('add_task'), level === 'alone' ? 'off' : level)
    assert.equal(s.calls.setAutonomy.length, 0, 'arrowing through the levels saved nothing')
  })

  it('does not warn for a level that waits for a person or for Off', async () => {
    const s = await autonomy()
    for (const level of ['off', 'suggest', 'draft']) {
      await s.choose(s.select('add_note'), level)
      absent(s.form('add_note')!.querySelector('[data-warning]'), `${level} needs no warning`)
    }
  })

  it('lets a person back out of On its own with Cancel or Escape, and nothing was saved', async () => {
    const s = await autonomy()
    await s.choose(s.select('confirm_link'), 'alone')
    await s.press(s.within(s.form('confirm_link'))('Cancel'))
    assert.equal(s.select('confirm_link').value, 'approval')
    await s.choose(s.select('confirm_link'), 'alone')
    await s.k.press('Escape', s.select('confirm_link'))
    await s.k.tick(20)
    absent(s.form('confirm_link'), 'it is not there')
    assert.equal(s.calls.setAutonomy.length, 0)
  })
})

describe('Autonomy: one change at a time', () => {
  afterEach(disposeAll)

  it('ignores a second press within the same tick and disables every control while one is being saved', async () => {
    const answer = deferred<AgentEnvelope<AutonomyAction>>()
    const s = await autonomy({ overrides: { setAutonomy: () => answer.promise } })
    await s.choose(s.select('add_note'), 'off')
    await s.choose(s.select('add_task'), 'off')
    const save = s.within(s.form('add_note'))('Save: Off')!
    const other = s.within(s.form('add_task'))('Save: Off')!
    await s.k.act(async () => {
      save.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      save.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      other.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.deepEqual(s.calls.setAutonomy.map((c) => c.key), ['add_note'], 'two presses and a press on another row, one request')
    for (const control of s.k.all('[data-action-row] select, [data-action-row] button, [data-kill-switch] button')) assert.equal((control as HTMLButtonElement).disabled, true, 'every control waits')
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    answer.resolve({ status: 1, data: autonomyAction('add_note', { level: 'off' }) })
    await s.k.tick(20)
    assert.deepEqual(s.calls.setAutonomy.map((c) => c.key), ['add_note'])
    assert.equal(s.select('add_note').disabled, false, 'and the controls work again')
  })

  it('ignores a choice made while a save is in flight', async () => {
    const answer = deferred<AgentEnvelope<AutonomyAction>>()
    const s = await autonomy({ overrides: { setAutonomy: () => answer.promise } })
    await change(s, 'add_note', 'off')
    await s.choose(s.select('add_task'), 'off')
    absent(s.form('add_task'), 'it is not there')
    answer.resolve({ status: 1, data: autonomyAction('add_note', { level: 'off' }) })
    await s.k.tick(20)
  })
})

describe('Autonomy: a change that is refused', () => {
  afterEach(disposeAll)

  it('takes the controls away and says only an administrator can, when the server says the person is not one, and changes nothing on screen', async () => {
    const s = await autonomy({ overrides: { setAutonomy: async () => { throw new AgentApiError('Only an administrator can change how much the agent may do on its own.', 403, undefined, undefined, 'administrators_only', null) } } })
    await change(s, 'add_note', 'off')
    says(s.k.one('[data-denied]')!.textContent!, 'Only an administrator can change these settings. Nothing was changed.')
    assert.equal(s.select('add_note').value, 'alone', 'the level on file is still shown')
    for (const control of s.k.all('[data-action-row] select, [data-action-row] button, [data-kill-switch] button')) assert.equal((control as HTMLButtonElement).disabled, true)
    assert.equal(s.calls.autonomy, 1, 'nothing was changed, so nothing is read again')
  })

  it('says an action the server no longer has is gone, and reads the list again so the screen shows what the server has', async () => {
    let gone = false
    const s = await autonomy({
      overrides: {
        autonomy: async () => ({ status: 1, data: autonomyState({ actions: gone ? [autonomyAction('add_task')] : [autonomyAction('add_note'), autonomyAction('add_task')] }) }),
        setAutonomy: async () => { gone = true; throw new AgentApiError('There is no such action.', 404, undefined, undefined, 'unknown_action', null) },
      },
    })
    await change(s, 'add_note', 'off')
    assert.equal(s.calls.autonomy, 2, 'read again')
    absent(s.k.one('li[data-action-row="add_note"]'), 'the action that is gone is gone')
    assert.ok(s.k.one('li[data-action-row="add_task"]'))
  })

  it('says a request the server refused in the server\'s own words, as an alert, keeps what was chosen and typed, and reads the list again', async () => {
    const s = await autonomy({ overrides: { setAutonomy: async () => { throw new AgentApiError('A reason can have at most 300 characters.', 422, { reason: ['A reason can have at most 300 characters.'] }, undefined, null, null) } } })
    await change(s, 'add_note', 'off', 'a reason')
    const alert = s.row('add_note').querySelector('[data-message="error"]')!
    assert.equal(alert.getAttribute('role'), 'alert')
    says(alert.textContent!, 'A reason can have at most 300 characters.')
    assert.ok(s.form('add_note'), 'the form is still open')
    assert.equal((s.form('add_note')!.querySelector('textarea') as HTMLTextAreaElement).value, 'a reason', 'what was typed is kept')
    assert.equal(s.calls.autonomy, 2)
  })

  it('says a lost connection in words, keeps what was chosen so it can be saved again, and does not read again (a read would fail too)', async () => {
    let fail = true
    const s = await autonomy({ overrides: { setAutonomy: async (key, level) => { if (fail) throw new TypeError('Failed to fetch'); return { status: 1, data: autonomyAction(key, { level }) } } } })
    await change(s, 'add_note', 'off')
    says(s.row('add_note').querySelector('[data-message="error"]')!.textContent!, NETWORK_TEXT)
    assert.equal(s.calls.autonomy, 1)
    assert.equal(s.select('add_note').value, 'off', 'still staged')
    fail = false
    await s.press(s.within(s.form('add_note'))('Save: Off'))
    assert.equal(s.calls.setAutonomy.length, 2)
    says(s.row('add_note').querySelector('[data-message="status"]')!.textContent!, 'Saved.')
    absent(s.row('add_note').querySelector('[data-message="error"]'), 'the error is gone')
  })

  it('does not let a read that was already on its way put the old level back over a change that was just saved', async () => {
    const put = deferred<AgentEnvelope<AutonomyAction>>()
    const reread = deferred<AgentEnvelope<AutonomyState>>()
    let reads = 0
    const s = await autonomy({ overrides: { setAutonomy: () => put.promise, autonomy: () => { reads += 1; return reads === 2 ? reread.promise : Promise.resolve(autonomyResponse()) } } })
    // A level is being saved (the answer is slow)...
    await change(s, 'add_note', 'off')
    // ...and while it is, a decision in the waiting list starts a quiet read of the settings, which is slow as well.
    await s.openTab('Waiting for you')
    await s.press(s.within(s.k.one('[data-proposal="1"]'))('Accept'))
    assert.equal(reads, 2)
    // The save finishes first. The read was asked for BEFORE the change, so its answer is older than the change and must not undo it.
    put.resolve({ status: 1, data: autonomyAction('add_note', { level: 'off', last_changed: { at: '2026-11-04T10:00:00+00:00', by_name: 'Anil Shah' } }) })
    await s.k.tick(20)
    reread.resolve(autonomyResponse())
    await s.k.tick(20)
    await s.openTab('Autonomy')
    assert.equal(s.select('add_note').value, 'off', 'the saved level is what is shown, not the older one the late read carried')
  })
})

describe('Autonomy: the kill switch', () => {
  afterEach(disposeAll)

  it('does not let a read that was already on its way put the old switch back over one that was just saved', async () => {
    const put = deferred<AgentEnvelope<{ kill_switch: KillSwitch }>>()
    const reread = deferred<AgentEnvelope<AutonomyState>>()
    let reads = 0
    const s = await autonomy({ overrides: { setKillSwitch: () => put.promise, autonomy: () => { reads += 1; return reads === 2 ? reread.promise : Promise.resolve(autonomyResponse()) } } })
    await s.press(s.within(s.kill())('Stop all agent actions for this organisation'))
    await s.press(s.within(s.kill())('Stop the agent'))
    // While the switch is being saved, a decision in the waiting list starts a slow read of the settings...
    await s.openTab('Waiting for you')
    await s.press(s.within(s.k.one('[data-proposal="1"]'))('Accept'))
    assert.equal(reads, 2)
    // ...the save finishes first, and the read, which was asked for BEFORE the change, brings back the agent as running.
    put.resolve({ status: 1, data: { kill_switch: { on: true, scope: 'organisation' } } })
    await s.k.tick(20)
    reread.resolve(autonomyResponse())
    await s.k.tick(20)
    await s.openTab('Autonomy')
    assert.equal(s.kill().getAttribute('data-kill-switch'), 'stopped', 'the switch that was saved is what is shown, not the older one the late read carried')
  })

  it('says the agent is running and offers to stop it, with the level controls below', async () => {
    const s = await autonomy()
    const card = s.kill()
    assert.equal(card.getAttribute('data-kill-switch'), 'running')
    says(card.textContent!, 'The agent is running')
    assert.ok(card.textContent!.includes('Running'), 'the state is a word on a pill')
    assert.ok(s.within(card)('Stop all agent actions for this organisation'))
    absent(s.within(card)('Resume'), 'it is not there')
    absent(s.k.one('[data-levels-unused]'), 'the levels apply while it runs')
  })

  it('stops the agent in two steps: the warning and the optional reason first, then the confirming button, which saves and says the result', async () => {
    const s = await autonomy()
    await s.press(s.within(s.kill())('Stop all agent actions for this organisation'))
    assert.equal(s.calls.setKillSwitch.length, 0, 'opening the form is not stopping')
    const form = s.kill().querySelector('[data-change-form]') as HTMLElement
    says(form.textContent!, 'starts no new run and applies nothing, including what people accept')
    says(form.textContent!, 'Why are you changing it? (optional, kept in the audit trail)')
    await s.type(form.querySelector('textarea') as HTMLElement, 'Wrong notes everywhere')
    await s.press(s.within(form)('Stop the agent'))
    assert.deepEqual(s.calls.setKillSwitch, [{ on: true, reason: 'Wrong notes everywhere' }])
    assert.equal(s.kill().getAttribute('data-kill-switch'), 'stopped')
    says(s.kill().textContent!, 'The agent is switched off for your organisation')
    says(s.kill().querySelector('[data-message="status"]')!.textContent!, 'Saved. The agent is switched off for your organisation')
    says(s.k.one('[data-levels-unused]')!.textContent!, 'none of these levels applies')
    assert.ok(s.within(s.kill())('Resume'))
    absent(s.within(s.kill())('Stop all agent actions'), 'it is not there')
  })

  it('resumes the agent in two steps as well, with a warning that it can act on its own again', async () => {
    const s = await autonomy({ overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'organisation' } }) } })
    assert.equal(s.kill().getAttribute('data-kill-switch'), 'stopped')
    await s.press(s.within(s.kill())('Resume'))
    assert.equal(s.calls.setKillSwitch.length, 0)
    const form = s.kill().querySelector('[data-change-form]') as HTMLElement
    says(form.textContent!, 'including the actions you have set to run on their own')
    await s.press(s.within(form)('Resume the agent'))
    assert.deepEqual(s.calls.setKillSwitch, [{ on: false, reason: undefined }])
    assert.equal(s.kill().getAttribute('data-kill-switch'), 'running')
    says(s.kill().querySelector('[data-message="status"]')!.textContent!, 'Saved. The agent is running again')
    absent(s.k.one('[data-levels-unused]'), 'the levels apply again')
  })

  it('keeps the focus on the switch\'s button after a save, and gives it back on Escape', async () => {
    const s = await autonomy()
    const toggle = s.within(s.kill())('Stop all agent actions for this organisation')!
    await s.press(toggle)
    const reason = s.kill().querySelector('textarea') as HTMLElement
    reason.focus()
    await s.k.press('Escape')
    await s.k.tick(20)
    absent(s.kill().querySelector('[data-change-form]'), 'it is not there')
    same(s.focused(), toggle, 'Escape in the reason field put the focus back on the switch button')
    assert.equal(s.calls.setKillSwitch.length, 0)

    await s.press(toggle)
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    await s.press(toggle)
    absent(s.kill().querySelector('[data-change-form]'), 'pressing the button again closes the form')
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(s.calls.setKillSwitch.length, 0)

    await s.press(toggle)
    const cancel = s.within(s.kill())('Cancel')!
    cancel.focus()
    await s.press(cancel)
    await s.k.tick(20)
    same(s.focused(), toggle, 'Cancel put the focus back on the switch button')

    await s.press(toggle)
    const confirm = s.within(s.kill())('Stop the agent')!
    confirm.focus()
    await s.press(confirm)
    await s.k.tick(20)
    same(s.focused(), toggle, 'after the save the focus is on the same button, which now says Resume')
    assert.equal(toggle.textContent!.trim(), 'Resume')
  })

  it('shows the platform\'s switch in words and offers nothing to press: it cannot be changed from a screen', async () => {
    const s = await autonomy({ overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'platform' } }) } })
    const card = s.kill()
    assert.equal(card.getAttribute('data-kill-switch'), 'platform')
    says(card.textContent!, 'The agent is switched off for every organisation')
    says(card.textContent!, 'cannot be changed from this screen')
    assert.equal(card.querySelectorAll('button').length, 0)
  })

  it('says the platform\'s switch still holds the agent when the organisation\'s own was lifted', async () => {
    const answers: KillSwitch[] = [{ on: true, scope: 'organisation' }]
    const s = await autonomy({
      overrides: {
        autonomy: async () => autonomyResponse({ kill_switch: answers[0] }),
        setKillSwitch: async () => ({ status: 1, data: { kill_switch: { on: true, scope: 'platform' } } }),
      },
    })
    await s.press(s.within(s.kill())('Resume'))
    await s.press(s.within(s.kill())('Resume the agent'))
    says(s.kill().querySelector('[data-message="status"]')!.textContent!, 'platform’s switch still keeps the agent stopped')
    assert.equal(s.kill().querySelectorAll('button').length, 0)
  })

  it('refuses in words and takes the controls away when the person is not an administrator', async () => {
    const s = await autonomy({ overrides: { setKillSwitch: async () => { throw new AgentApiError('x', 403, undefined, undefined, 'administrators_only', null) } } })
    await s.press(s.within(s.kill())('Stop all agent actions for this organisation'))
    await s.press(s.within(s.kill())('Stop the agent'))
    assert.ok(s.k.one('[data-denied]'))
    assert.match(s.kill().querySelector('[data-message="error"]')!.textContent!, /Only an administrator can change these settings\./, 'the switch says only an administrator can')
    assert.equal(s.kill().getAttribute('data-kill-switch'), 'running')
    absent(s.kill().querySelector('[data-change-form]'), 'it is not there')
  })

  it('ignores a second press of the confirming button within the same tick', async () => {
    const answer = deferred<AgentEnvelope<{ kill_switch: KillSwitch }>>()
    const s = await autonomy({ overrides: { setKillSwitch: () => answer.promise } })
    await s.press(s.within(s.kill())('Stop all agent actions for this organisation'))
    const confirm = s.within(s.kill())('Stop the agent')!
    await s.k.act(async () => {
      confirm.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
      confirm.dispatchEvent(new s.k.w.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    assert.equal(s.calls.setKillSwitch.length, 1)
    answer.resolve({ status: 1, data: { kill_switch: { on: true, scope: 'organisation' } } })
    await s.k.tick(20)
    assert.equal(s.calls.setKillSwitch.length, 1)
  })
})

describe('Autonomy: opening, refreshing and failing', () => {
  afterEach(disposeAll)

  it('refreshes on request, keeping what is shown while it reads', async () => {
    const s = await autonomy()
    await s.press(s.button('Refresh', s.panel()!))
    assert.equal(s.calls.autonomy, 2)
    assert.ok(s.k.one('li[data-action-row="add_note"]'))
  })

  it('keeps showing the rows, and waits to be pressed again, while a refresh is being read', async () => {
    const again = deferred<AgentEnvelope<AutonomyState>>()
    let reads = 0
    const s = await autonomy({ overrides: { autonomy: () => { reads += 1; return reads === 2 ? again.promise : Promise.resolve(autonomyResponse()) } } })
    await s.press(s.button('Refresh', s.panel()!))
    assert.ok(s.k.one('li[data-action-row="add_note"]'), 'the rows are on the page, not replaced by "Opening…"')
    assert.equal(s.k.bodyText().includes('Opening the autonomy settings…'), false)
    assert.equal(s.button('Refresh', s.panel()!)!.disabled, true)
    assert.equal(s.select('add_note').disabled, true, 'nothing is changed while the list may be about to change')
    assert.equal(s.k.one('section[aria-busy="true"]') !== null, true)
    again.resolve(autonomyResponse())
    await s.k.tick(20)
    assert.equal(s.select('add_note').disabled, false)
  })

  it('says, when a refresh could not read the settings, that what is shown may be out of date, and keeps showing it', async () => {
    let n = 0
    const s = await autonomy({ overrides: { autonomy: async () => { n += 1; if (n > 1) throw new ApiError('The server is busy.', 503); return autonomyResponse() } } })
    await s.press(s.button('Refresh', s.panel()!))
    says(s.k.one('[data-refresh-failed]')!.textContent!, 'may be out of date')
    assert.ok(s.k.one('li[data-action-row="add_note"]'), 'the rows are still there')
    await s.press(s.button('Refresh', s.panel()!))
    assert.equal(n, 3)
  })

  it('shows what a decision in the waiting list did to the counters, because the list reads the settings again', async () => {
    let accepted = false
    const s = await autonomy({
      overrides: {
        autonomy: async () => autonomyResponse({ actions: [autonomyAction('add_note', { counts: { proposed: 3, applied: accepted ? 2 : 1, accepted: accepted ? 1 : 0, dismissed: 0, failed: 0 } })] }),
        proposals: async () => proposalsPage([queuedProposal()]),
        accept: async () => { accepted = true; return { status: 1, data: { outcome: 'applied', proposal: queuedProposal({ status: 'applied' }) } } },
      },
    })
    says(s.row('add_note').querySelector('[data-count="applied"]')!.textContent!, 'including 0 accepted')
    await s.openTab('Waiting for you')
    await s.press(s.within(s.k.one('[data-proposal="1"]'))('Accept'))
    await s.openTab('Autonomy')
    says(s.row('add_note').querySelector('[data-count="applied"]')!.textContent!, 'including 1 accepted')
  })
})

describe('Autonomy: it can be used and understood without a mouse or without colour', () => {
  afterEach(disposeAll)

  it('uses real controls: a labelled select, real buttons, a list of actions with a name, and headings in order', async () => {
    const s = await autonomy()
    assert.equal(s.k.all('[role="button"]').length, 0)
    assert.equal(s.k.all('ul[aria-label="Actions and their levels"]').length, 1)
    assert.equal(s.k.all('li[data-action-row] select').length, 3)
    assert.ok(s.k.all('select').every((select) => (select.getAttribute('aria-labelledby') ?? '').split(' ').every((id) => s.k.w.document.getElementById(id) !== null)))
    assert.deepEqual(s.k.all('h1, h2, h3').map((h) => h.tagName).filter((tag, i, all) => tag === 'H1' || i > 0).slice(0, 4), ['H1', 'H2', 'H3', 'H3'])
  })

  it('says every state in words: the switch is Running or Switched off, a change is Saved or an error, a level has a name', async () => {
    const s = await autonomy()
    assert.ok(s.kill().querySelector('[data-tone]')!.textContent!.trim().length > 0)
    for (const status of s.k.all('[data-message]')) assert.equal(status.textContent, '', 'nothing is said before anything happened')
    const polite = s.k.all('[data-message="status"]')
    assert.equal(polite.length, 4, 'one polite region for each of the three rows and one for the switch, on the page before anything is said')
    for (const region of polite) assert.deepEqual([region.getAttribute('role'), region.getAttribute('aria-live')], ['status', 'polite'])
  })

  it('has no accessibility violations in its main states', async () => {
    const states: Array<[string, ScreenOptions]> = [
      ['the settings', {}],
      ['switched off', { overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'organisation' } }) } }],
      ['switched off by the platform', { overrides: { autonomy: async () => autonomyResponse({ kill_switch: { on: true, scope: 'platform' } }) } }],
      ['could not be opened', { overrides: { autonomy: async () => { throw new ApiError('busy', 503) } } }],
      ['the server has not got it', { overrides: { autonomy: async () => { throw new ApiError('nope', 404) } } }],
      ['loading', { overrides: { autonomy: () => new Promise<AgentEnvelope<AutonomyState>>(() => undefined) } }],
    ]
    for (const [label, options] of states) {
      const s = await autonomy(options)
      const root = s.panel()
      assert.ok(root && root.textContent!.includes('Autonomy'), `${label}: the tab is on the page`)
      assert.deepEqual(await axeViolations(root), [], label)
      await disposeAll()
    }
  })

  it('has no accessibility violations with a change staged, with the warning for On its own, with a message and with the kill switch form open', async () => {
    const s = await autonomy()
    await s.choose(s.select('add_note'), 'approval')
    assert.deepEqual(await axeViolations(s.panel()!), [], 'staged')
    await s.choose(s.select('confirm_link'), 'alone')
    assert.deepEqual(await axeViolations(s.panel()!), [], 'the warning')
    await s.press(s.within(s.form('add_note'))('Save: Needs approval'))
    assert.ok(s.row('add_note').querySelector('[data-message="status"]')!.textContent)
    assert.deepEqual(await axeViolations(s.panel()!), [], 'a message')
    await s.press(s.within(s.kill())('Stop all agent actions for this organisation'))
    assert.deepEqual(await axeViolations(s.panel()!), [], 'the kill switch form')
  })

  it('has no accessibility violations after an error', async () => {
    const s = await autonomy({ overrides: { setAutonomy: async () => { throw new TypeError('Failed to fetch') } } })
    await change(s, 'add_note', 'off')
    assert.ok(s.row('add_note').querySelector('[data-message="error"]'))
    assert.deepEqual(await axeViolations(s.panel()!), [])
  })
})
