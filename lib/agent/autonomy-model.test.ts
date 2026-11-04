import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { AgentApiError } from '../../services/agent/errors'
import {
  aloneWarning, ALONE_CONFIRM_TEXT, changeFailureText, counterLines, defaultText, isNotAdministrator, killSavedNotice, killView, lastChangedText, levelEffect, levelLabel, levelOptions,
  levelSavedNotice, MAX_AUTONOMY_REASON, needsSecondClick, NOT_ADMINISTRATOR_TEXT, saveText, shouldReadAgainAfter,
} from './autonomy-model'
import { NETWORK_TEXT } from './model'

describe('the levels in words', () => {
  it('gives every level the server knows a name a person can read, and a sentence saying what it does', () => {
    assert.deepEqual(['off', 'suggest', 'draft', 'approval', 'alone'].map(levelLabel), ['Off', 'Suggest', 'Draft', 'Needs approval', 'On its own'])
    for (const level of ['off', 'suggest', 'draft', 'approval', 'alone']) assert.ok(levelEffect(level).length > 20, level)
  })

  it('says the three levels that wait wait for a person, that Off refuses, and that On its own marks the record Agent', () => {
    for (const level of ['suggest', 'draft', 'approval']) assert.match(levelEffect(level), /waits for a person to accept or dismiss/, level)
    assert.match(levelEffect('off'), /does not do this at all/)
    assert.match(levelEffect('off'), /nothing is stored/)
    assert.match(levelEffect('alone'), /without asking/)
    assert.match(levelEffect('alone'), /marked Agent/)
  })

  it('shows a level it does not know by its own key made readable, and says it has no words for it', () => {
    assert.equal(levelLabel('draft_for_review'), 'Draft for review')
    assert.equal(levelLabel(''), 'Unknown level')
    assert.match(levelEffect('mystery'), /no words for/)
  })
})

describe('which level needs a second, deliberate click', () => {
  it('is "On its own" and nothing else: only it lets the agent act with nobody seeing the thing first', () => {
    assert.equal(needsSecondClick('alone'), true)
    for (const level of ['off', 'suggest', 'draft', 'approval']) assert.equal(needsSecondClick(level), false, level)
  })

  it('does not treat a level it does not know as safe or as dangerous: only the exact word counts', () => {
    assert.equal(needsSecondClick('ALONE'), false)
    assert.equal(needsSecondClick('alone '), false)
    assert.equal(needsSecondClick(''), false)
  })

  it('warns, in plain English, what "On its own" means for THIS action, and that it can be lowered again', () => {
    const warning = aloneWarning('Add a note')
    assert.match(warning, /“Add a note”/)
    assert.match(warning, /without asking/)
    assert.match(warning, /nobody accepts it first/)
    assert.match(warning, /marked Agent/)
    assert.match(warning, /lower level again at any time/)
  })

  it('names what the button does: the level that needs the second click says so, the others say what they save', () => {
    assert.equal(saveText('alone'), ALONE_CONFIRM_TEXT)
    assert.equal(ALONE_CONFIRM_TEXT, 'Let the agent do this on its own')
    assert.equal(saveText('off'), 'Save: Off')
    assert.equal(saveText('approval'), 'Save: Needs approval')
  })
})

describe('the choices in the select', () => {
  it('offers the levels the server lists, in its order, with their words', () => {
    assert.deepEqual(levelOptions({ levels: ['off', 'approval', 'alone'], level: 'approval' }), [
      { value: 'off', label: 'Off' }, { value: 'approval', label: 'Needs approval' }, { value: 'alone', label: 'On its own' },
    ])
  })

  it('always offers the level the action is at now, even when the server did not list it', () => {
    assert.deepEqual(levelOptions({ levels: ['off', 'alone'], level: 'approval' }).map((o) => o.value), ['off', 'alone', 'approval'])
  })

  it('says what the default is and whether the organisation changed it', () => {
    assert.equal(defaultText({ default: 'alone', overridden: false }), 'Default: On its own. Your organisation has not changed it.')
    assert.equal(defaultText({ default: 'approval', overridden: true }), 'Default: Needs approval. Your organisation has changed it.')
  })
})

describe('the last 30 days, as the evidence for a level', () => {
  const find = (lines: ReturnType<typeof counterLines>, key: string) => lines.find((line) => line.key === key)

  it('lists proposed, applied, dismissed and failed with the server\'s numbers', () => {
    const lines = counterLines({ proposed: 11, applied: 6, accepted: 2, dismissed: 2, failed: 1 })
    assert.deepEqual(lines.map((line) => [line.label, line.value]), [['Proposed', 11], ['Applied', 6], ['Dismissed', 2], ['Failed', 1], ['Still waiting', 0 + (11 - 6 - 2 - 1)]])
  })

  it('says "accepted" INSIDE "applied" and never as a line of its own, so nobody adds them', () => {
    const lines = counterLines({ proposed: 11, applied: 6, accepted: 2, dismissed: 2, failed: 1 })
    assert.equal(find(lines, 'accepted'), undefined)
    assert.equal(find(lines, 'applied')!.note, 'including 2 accepted by a person')
    assert.equal(find(lines, 'applied')!.value, 6, 'the applied number is the server\'s, not applied plus accepted')
  })

  it('says none of the applied ones were accepted by a person when none were, and says nothing about accepted when nothing was applied', () => {
    assert.equal(find(counterLines({ proposed: 3, applied: 3, accepted: 0, dismissed: 0, failed: 0 }), 'applied')!.note, 'including 0 accepted by a person')
    assert.equal(find(counterLines({ proposed: 1, applied: 0, accepted: 0, dismissed: 1, failed: 0 }), 'applied')!.note, null)
  })

  it('counts what is still waiting as what was proposed and has neither been applied, dismissed nor failed, and leaves the line out when nothing waits', () => {
    assert.equal(find(counterLines({ proposed: 5, applied: 1, accepted: 1, dismissed: 1, failed: 0 }), 'waiting')!.value, 3)
    assert.equal(find(counterLines({ proposed: 4, applied: 2, accepted: 0, dismissed: 1, failed: 1 }), 'waiting'), undefined)
    assert.equal(find(counterLines({ proposed: 0, applied: 0, accepted: 0, dismissed: 0, failed: 0 }), 'waiting'), undefined)
  })

  it('never invents a waiting count from numbers that cannot be right (more decided than proposed)', () => {
    assert.equal(find(counterLines({ proposed: 2, applied: 3, accepted: 0, dismissed: 0, failed: 0 }), 'waiting'), undefined)
  })

  it('keeps a zero as a zero, a number and never an empty cell', () => {
    for (const line of counterLines({ proposed: 0, applied: 0, accepted: 0, dismissed: 0, failed: 0 })) assert.equal(line.value, 0, line.label)
  })
})

describe('who changed it and when', () => {
  it('says who and when, in the person\'s own date format', () => {
    assert.equal(lastChangedText({ at: '2026-11-03T15:22:57+00:00', by_name: 'Anil Shah' }, 'UTC'), 'Last changed by Anil Shah on 3 Nov 2026, 15:22.')
  })

  it('says so when no change is on record, and says what is not known when part of it is not', () => {
    assert.equal(lastChangedText(null), 'No change is on record.')
    assert.equal(lastChangedText({ at: '2026-11-03T15:22:57+00:00', by_name: null }, 'UTC'), 'Last changed on 3 Nov 2026, 15:22. Who changed it is not on record.')
    assert.equal(lastChangedText({ at: '2026-11-03T15:22:57+00:00', by_name: '   ' }, 'UTC'), 'Last changed on 3 Nov 2026, 15:22. Who changed it is not on record.')
    assert.equal(lastChangedText({ at: null, by_name: 'Anil Shah' }), 'Last changed by Anil Shah. When is not on record.')
    assert.equal(lastChangedText({ at: null, by_name: null }), 'A change is on record, but not who made it or when.')
    assert.equal(lastChangedText({ at: 'not a date', by_name: 'Anil Shah' }), 'Last changed by Anil Shah. When is not on record.')
  })
})

describe('the kill switch in words', () => {
  it('offers Stop while the agent runs, and nothing to resume', () => {
    const view = killView({ on: false, scope: null })
    assert.equal(view.state, 'running')
    assert.deepEqual([view.canStop, view.canResume], [true, false])
    assert.match(view.title, /running/)
  })

  it('offers Resume, and not Stop, when the organisation\'s own switch is on, and says what stopped means', () => {
    const view = killView({ on: true, scope: 'organisation' })
    assert.equal(view.state, 'stopped')
    assert.deepEqual([view.canStop, view.canResume], [false, true])
    assert.match(view.title, /switched off for your organisation/)
    assert.match(view.text, /starts no new run/)
    assert.match(view.text, /including what people accept/)
  })

  it('shows the platform\'s switch and offers no control for it: it cannot be changed from a screen', () => {
    const view = killView({ on: true, scope: 'platform' })
    assert.equal(view.state, 'platform')
    assert.deepEqual([view.canStop, view.canResume], [false, false])
    assert.match(view.title, /every organisation/)
    assert.match(view.text, /cannot be changed from this screen/)
  })

  it('offers nothing when it cannot tell whose switch is on, and says so', () => {
    const view = killView({ on: true, scope: null })
    assert.equal(view.state, 'unknown')
    assert.deepEqual([view.canStop, view.canResume], [false, false])
    assert.match(view.text, /cannot tell who switched it off/)
  })

  it('says what a save did to the switch, including when the platform\'s switch still holds the agent', () => {
    assert.match(killSavedNotice({ on: true, scope: 'organisation' }, true), /switched off for your organisation/)
    assert.match(killSavedNotice({ on: false, scope: null }, false), /running again/)
    assert.match(killSavedNotice({ on: true, scope: 'platform' }, false), /platform’s switch still keeps the agent stopped/)
    assert.match(killSavedNotice({ on: true, scope: 'platform' }, true), /platform has also switched the agent off/)
  })
})

describe('what a saved level says', () => {
  it('says the action is now set to the level, and what that level means', () => {
    const text = levelSavedNotice({ label: 'Add a note', level: 'alone', overridden: true })
    assert.equal(text, 'Saved. “Add a note” is now set to On its own. The agent does it without asking, and the record is marked Agent.')
  })

  it('says so when the level went back to the default, which the server answers as not overridden', () => {
    assert.match(levelSavedNotice({ label: 'Add a task', level: 'alone', overridden: false }), /back at the default, On its own/)
  })
})

describe('why a change did not work', () => {
  it('says a 403 is only-an-administrator, whatever else the server said', () => {
    assert.equal(changeFailureText(new AgentApiError('Only an administrator can change how much the agent may do on its own.', 403, undefined, undefined, 'administrators_only', null), 'x'), NOT_ADMINISTRATOR_TEXT)
    assert.equal(changeFailureText(new ApiError('Your role does not have access.', 403), 'x'), NOT_ADMINISTRATOR_TEXT)
    assert.match(NOT_ADMINISTRATOR_TEXT, /Nothing was changed/)
  })

  it('tells an action that is gone (a code) from a server that does not have the settings (no code)', () => {
    assert.match(changeFailureText(new AgentApiError('There is no such action.', 404, undefined, undefined, 'unknown_action', null), 'x'), /no longer has this kind of action/)
    assert.match(changeFailureText(new AgentApiError('The route could not be found.', 404, undefined, undefined, null, null), 'x'), /does not have the autonomy settings yet/)
  })

  it('uses the server\'s own sentence for a refusal of the request (a reason that is too long, a level that is not one)', () => {
    assert.equal(changeFailureText(new AgentApiError('A reason can have at most 300 characters.', 422, undefined, undefined, null, null), 'x'), 'A reason can have at most 300 characters.')
    assert.equal(changeFailureText(new ApiError('', 500), 'x'), 'The server answered 500.')
  })

  it('says a lost connection in plain words, and falls back to the sentence it was given', () => {
    assert.equal(changeFailureText(new TypeError('Failed to fetch'), 'x'), NETWORK_TEXT)
    assert.equal(changeFailureText(new Error(''), 'The level could not be saved.'), 'The level could not be saved.')
  })

  it('reads the list again after a refusal the server gave, and not after a refusal of the right (nothing is changed) or a lost connection (a read would fail too)', () => {
    assert.equal(shouldReadAgainAfter(new AgentApiError('x', 404, undefined, undefined, 'unknown_action', null)), true)
    assert.equal(shouldReadAgainAfter(new AgentApiError('x', 422, undefined, undefined, null, null)), true)
    assert.equal(shouldReadAgainAfter(new ApiError('x', 500)), true)
    assert.equal(shouldReadAgainAfter(new ApiError('x', 403)), false)
    assert.equal(shouldReadAgainAfter(new TypeError('Failed to fetch')), false)
    assert.equal(isNotAdministrator(new ApiError('x', 403)), true)
    assert.equal(isNotAdministrator(new ApiError('x', 409)), false)
  })

  it('allows a reason as long as the server does, and no longer', () => {
    assert.equal(MAX_AUTONOMY_REASON, 300)
  })
})
