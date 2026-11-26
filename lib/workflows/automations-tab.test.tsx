import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { health, recipe, workflow } from './fixtures'
import { mountTab } from './screen-kit'

const MEETING = workflow({
  id: 1,
  status: 'active',
  sentence: 'When a lead replies and the reply is positive, book a meeting; needs your approval',
  needs_approval: true,
  last_run: { status: 'succeeded', at: '2026-11-26 08:00:00', done_7d: 4, failed_7d: 0, waiting: 2 },
})
const DRAFT = workflow({
  id: 2,
  name: 'Welcome new leads',
  status: 'draft',
  trigger_event: 'crm.lead.created',
  conditions: [],
  actions: [{ type: 'add_lead_note', params: { text: 'Hello' } }],
  needs_approval: false,
  last_run: null,
})
const PAUSED = workflow({ id: 3, name: 'Paused one', status: 'paused', needs_approval: true, last_run: null })

/** Opens the menu of a row the way a keyboard does (Radix opens a menu on Enter), and returns the names of its items. */
async function openMenu(k: Awaited<ReturnType<typeof mountTab>>['k'], label: string) {
  const trigger = k.all('button').find((b) => b.getAttribute('aria-label') === label)!
  assert.ok(trigger, `there is a menu for ${label}`)
  await k.act(async () => { trigger.dispatchEvent(new k.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  await k.tick(30)
  return k.all('[role="menuitem"]')
}

describe('Automations tab: empty (the recipe gallery)', () => {
  afterEach(disposeAll)
  const recipes = [
    recipe(),
    recipe({ key: 'quote-follow-up', title: 'Follow up an accepted quote', sentence: 'When a quote is accepted, create a sales order.', consequential: true, installed_workflow_id: 7 }),
  ]

  it('invites a first step, and shows each recipe as a card with its sentence, an approval badge and a button', async () => {
    const { k, button } = await mountTab('automations', { recipes })
    assert.ok(k.bodyText().includes('Start with a ready-made automation'))
    assert.ok(k.bodyText().includes('Plan the first contact with a new lead'))
    assert.ok(k.bodyText().includes('When a lead is created, add a note to the lead, then create a follow-up task.'))
    const cards = k.all('ul[aria-label="Ready-made automations"] > li')
    assert.equal(cards.length, 2)
    assert.ok(!cards[0].textContent!.includes('Needs approval'))
    assert.ok(cards[1].textContent!.includes('Needs approval'), 'a consequential recipe says so')
    assert.ok(button('Add as draft'))
    assert.ok(button('Start from scratch'))
  })

  it('says "Already added" and disables the button for a recipe that is installed', async () => {
    const { k } = await mountTab('automations', { recipes })
    const cards = k.all('ul[aria-label="Ready-made automations"] > li')
    const added = cards[1].querySelector('button') as HTMLButtonElement
    assert.equal(added.textContent, 'Already added')
    assert.equal(added.disabled, true)
    assert.equal((cards[0].querySelector('button') as HTMLButtonElement).disabled, false)
  })

  it('adds a recipe as a draft, tells the person, and reads the list again', async () => {
    const { k, calls, press, state } = await mountTab('automations', { recipes })
    state.items.push(DRAFT)
    await press('Add as draft')
    assert.deepEqual(calls.install, ['lead-first-contact'])
    assert.ok(k.bodyText().includes('Added “Plan the first contact with a new lead” as a draft. Try it, then turn it on when you are ready.'))
    assert.equal(calls.list, 2, 'the list is read again')
    assert.equal(k.all('li[data-automation]').length, 1)
  })

  it('says a recipe that was already there was already added, and does not claim a new draft', async () => {
    const { k, press } = await mountTab('automations', { recipes, installResult: { created: false, id: 5 } })
    await press('Add as draft')
    assert.ok(k.bodyText().includes('was already added.'))
    assert.ok(!k.bodyText().includes('as a draft. Try it'))
  })

  it('still lets the person start from scratch when the gallery cannot be loaded, and offers a retry', async () => {
    const { k, button } = await mountTab('automations', { recipes: 'fail' })
    assert.ok(k.bodyText().includes('Ready-made automations could not be loaded'))
    assert.ok(button('Retry'))
    assert.ok(button('Start from scratch'))
  })

  it('shows a person who may only read no way to add, and says who can', async () => {
    const { k, button } = await mountTab('automations', { recipes, role: 'executive' })
    assert.ok(k.bodyText().includes('No automations yet'))
    assert.ok(k.bodyText().includes('An administrator can add the first one.'))
    assert.equal(button('Start from scratch'), undefined)
    assert.equal((k.all('ul[aria-label="Ready-made automations"] button')[0] as HTMLButtonElement).disabled, true)
  })

  it('opens the builder from "Start from scratch", in a drawer', async () => {
    const { k, press, dialog } = await mountTab('automations', { recipes })
    await press('Start from scratch')
    assert.ok(dialog())
    assert.ok(k.bodyText().includes('New automation'))
    assert.ok(k.bodyText().includes('When something happens, choose what should happen.'), 'the live sentence is at the top')
    assert.ok(k.bodyText().includes('Save as draft'))
  })
})

describe('Automations tab: populated', () => {
  afterEach(disposeAll)
  const items = [MEETING, DRAFT, PAUSED]

  it('shows the status strip and the organisation-wide note, and never claims instant', async () => {
    const { k } = await mountTab('automations', { items })
    assert.ok(k.bodyText().includes('Checked about every 10 minutes.'))
    assert.ok(k.bodyText().includes('Automations apply to your whole organisation, not only to this module.'))
    assert.ok(!/instant/i.test(k.bodyText()))
  })

  it('says the scheduler is off, or not known, when it is', async () => {
    const stale = await mountTab('automations', { items, health: health({ state: 'stale', message: 'The scheduler has not run for 2 days, so automations wait.' }) })
    // the server's reason already says "so automations wait": it is shown once, not after a second copy of the same sentence
    assert.ok(stale.k.bodyText().includes('The scheduler has not run for 2 days, so automations wait.'))
    assert.ok(!stale.k.bodyText().includes('The scheduler is off, so automations wait. The scheduler has not run'))
    await disposeAll()
    const missing = await mountTab('automations', { items, health: 'fail' })
    assert.ok(missing.k.bodyText().includes('Not known:'))
  })

  it('shows each automation as one sentence, its status in a word, an approval badge and how it went', async () => {
    const { rows } = await mountTab('automations', { items })
    assert.equal(rows().length, 3)
    const first = rows()[0].textContent!
    assert.ok(first.includes('When a lead replies and the reply is positive, book a meeting.'), 'the server sentence, with the approval left to the badge')
    assert.ok(!first.includes('; needs your approval'))
    assert.ok(first.includes('On'))
    assert.ok(first.includes('Needs approval'))
    assert.ok(/Last run .* ago: done/.test(first) || /Last run .*: done/.test(first))
    assert.ok(first.includes('2 waiting for you'))
    const draft = rows()[1].textContent!
    assert.ok(draft.includes('When a lead is created, add a note to the lead.'), 'built from the definition when the server sent none')
    assert.ok(draft.includes('Draft'))
    assert.ok(draft.includes('Never run'))
    assert.ok(!draft.includes('Needs approval'))
    assert.ok(rows()[2].textContent!.includes('Paused'))
  })

  it('never shows a developer word, a machine name or "Coming soon"', async () => {
    const { k } = await mountTab('automations', { items })
    for (const word of ['flow_key', 'trigger_event', 'payload', 'enforced', 'governed', 'chain', 'Coming soon']) assert.ok(!k.bodyText().includes(word), word)
    assert.ok(!/\b[a-z]+_[a-z]+\b/.test(k.bodyText()), 'no snake_case name')
  })

  it('has one On/Off switch per row, named by the automation, on for the one that is on', async () => {
    const { k } = await mountTab('automations', { items })
    const switches = k.all('input[role="switch"]') as HTMLInputElement[]
    assert.deepEqual(switches.map((s) => [s.getAttribute('aria-label'), s.checked]), [
      ['Book a meeting when the reply is positive', true], ['Welcome new leads', false], ['Paused one', false],
    ])
  })

  it('turns a draft that needs no approval on straight away, with no question', async () => {
    const { k, calls } = await mountTab('automations', { items })
    await k.click(k.all('input[role="switch"]')[1]); await k.tick(30)
    assert.deepEqual(calls.setStatus, [{ id: 2, status: 'active', confirm: false }])
    assert.equal(k.one('[role="alertdialog"]'), null)
    assert.ok(k.bodyText().includes('Turned on “Welcome new leads”.'))
  })

  it('asks before turning on an automation whose runs wait for approval, says what approving does, and turns it on only on yes', async () => {
    const { k, calls } = await mountTab('automations', { items })
    await k.click(k.all('input[role="switch"]')[2]); await k.tick(30)
    assert.deepEqual(calls.setStatus, [], 'nothing is sent until the person answers')
    const text = k.one('[role="alertdialog"]')!.textContent!
    assert.ok(text.includes('Turn on “Paused one”?'))
    assert.ok(text.includes('waits in Runs for an administrator to approve it'))
    assert.ok(text.includes('hold the first proposed time on the owner’s calendar'))
    await k.click(k.withText('Cancel')!); await k.tick(30)
    assert.deepEqual(calls.setStatus, [], 'cancelling sends nothing')
    await k.click(k.all('input[role="switch"]')[2]); await k.tick(30)
    await k.click(k.withText('Turn on')!); await k.tick(30)
    assert.deepEqual(calls.setStatus, [{ id: 3, status: 'active', confirm: false }])
  })

  it('turns an automation off without asking anything', async () => {
    const { k, calls } = await mountTab('automations', { items })
    await k.click(k.all('input[role="switch"]')[0]); await k.tick(30)
    assert.equal(k.one('[role="alertdialog"]'), null)
    assert.deepEqual(calls.setStatus, [{ id: 1, status: 'paused', confirm: false }])
    assert.ok(k.bodyText().includes('Turned off “Book a meeting when the reply is positive”.'))
  })

  it('says what went wrong, in words, when the server refuses to turn one on', async () => {
    const { k } = await mountTab('automations', { items, statusRefusal: new ApiError('This workflow cannot be activated: Action 1 (convert_lead) needs a lead', 422) })
    await k.click(k.all('input[role="switch"]')[1]); await k.tick(30)
    assert.ok(k.bodyText().includes('This automation cannot be turned on: Step 1 needs a lead'))
  })

  it('offers Edit only when it is off (an automation that is on says to turn it off first), plus Try it, Duplicate and Archive', async () => {
    const { k } = await mountTab('automations', { items })
    const on = await openMenu(k, 'More actions for Book a meeting when the reply is positive')
    assert.deepEqual(on.map((m) => (m.textContent ?? '').trim()), ['Edit (turn it off first)', 'Try it', 'Duplicate', 'Archive'])
    assert.equal(on[0].getAttribute('data-disabled') !== null, true)
  })

  it('archives only after asking, and says how many waiting runs were cancelled', async () => {
    const { k, calls } = await mountTab('automations', { items })
    const menu = await openMenu(k, 'More actions for Welcome new leads')
    assert.deepEqual(menu.map((m) => (m.textContent ?? '').trim()), ['Edit', 'Try it', 'Duplicate', 'Archive'])
    await k.click(menu.find((m) => m.textContent === 'Archive')!); await k.tick(30)
    assert.deepEqual(calls.setStatus, [])
    assert.ok(k.one('[role="alertdialog"]')!.textContent!.includes('Archive “Welcome new leads”?'))
    await k.click(k.withText('Archive')!); await k.tick(30)
    assert.deepEqual(calls.setStatus, [{ id: 2, status: 'archived', confirm: true }])
    assert.ok(k.bodyText().includes('Archived “Welcome new leads”. 2 runs were cancelled.'))
  })

  it('duplicates as a draft copy', async () => {
    const { k, calls } = await mountTab('automations', { items })
    const menu = await openMenu(k, 'More actions for Welcome new leads')
    await k.click(menu.find((m) => m.textContent === 'Duplicate')!); await k.tick(30)
    assert.equal(calls.create.length, 1)
    assert.equal(calls.create[0].name, 'Welcome new leads (copy)')
    assert.equal(calls.create[0].trigger_event, 'crm.lead.created')
    assert.ok(k.bodyText().includes('Duplicated as a draft'))
  })

  it('tries an automation on a real lead the person picks, and shows plain steps with "Nothing was changed"', async () => {
    const { k, calls } = await mountTab('automations', {
      items: [MEETING],
      dryRun: { dry_run: true, would_run: true, conditions: [], needs_approval: true, actions: [{ type: 'book_lead_meeting', label: 'Book a meeting', consequential: true, params: {} }], facts: {} },
    })
    const menu = await openMenu(k, 'More actions for Book a meeting when the reply is positive')
    await k.click(menu.find((m) => m.textContent === 'Try it')!); await k.tick(30)
    assert.ok(k.bodyText().includes('See what this automation would do for one real lead. Nothing was changed.'))
    assert.ok(k.bodyText().includes('Choose a lead first.'))
    assert.equal((k.withText('Try it') as HTMLButtonElement).disabled, true, 'no record, no dry run')
    assert.ok(k.bodyText().includes('Asha Rao'), 'a real lead is offered by name')
    await k.click(k.one('input[type="radio"]')!); await k.tick(30)
    await k.click(k.withText('Try it')!); await k.tick(30)
    assert.deepEqual(calls.test, [{ id: 1, entityId: 12 }])
    assert.ok(k.bodyText().includes('Would run: book a meeting (needs your approval)'))
    assert.ok(k.bodyText().includes('It would run for this record, after you approve it.'))
    assert.equal(k.all('span').filter((s) => s.textContent === 'Nothing was changed.').length, 1, 'the reassurance is on the result')
  })

  it('says why a record was skipped, and what went wrong when the dry run is refused', async () => {
    const skipped = await mountTab('automations', {
      items: [MEETING],
      dryRun: { dry_run: true, would_run: false, conditions: [{ field: 'event.confidence', op: 'gt', expected: 50000, actual: 30000, pass: false }], needs_approval: false, actions: [], facts: {} },
    })
    const menu = await openMenu(skipped.k, 'More actions for Book a meeting when the reply is positive')
    await skipped.k.click(menu.find((m) => m.textContent === 'Try it')!); await skipped.k.tick(30)
    await skipped.k.click(skipped.k.one('input[type="radio"]')!); await skipped.k.tick(30)
    await skipped.k.click(skipped.k.withText('Try it')!); await skipped.k.tick(30)
    assert.ok(/Skipped: the confidence 30,?000 is not more than 50,?000/.test(skipped.k.bodyText()))
    assert.ok(skipped.k.bodyText().includes('It would not run for this record.'))
    await disposeAll()

    const refused = await mountTab('automations', { items: [MEETING], dryRunFails: new ApiError('That record does not exist in your organisation.', 404) })
    const menu2 = await openMenu(refused.k, 'More actions for Book a meeting when the reply is positive')
    await refused.k.click(menu2.find((m) => m.textContent === 'Try it')!); await refused.k.tick(30)
    await refused.k.click(refused.k.one('input[type="radio"]')!); await refused.k.tick(30)
    await refused.k.click(refused.k.withText('Try it')!); await refused.k.tick(30)
    assert.ok(refused.k.bodyText().includes('That record does not exist in your organisation.'))
  })

  it('filters by status through the address', async () => {
    const { k, rows, choose, router } = await mountTab('automations', { items })
    await choose(k.one('select[name="show"]') as HTMLSelectElement, 'draft')
    assert.equal(router.lastSearch(), 'show=draft')
    assert.deepEqual(rows().map((r) => r.getAttribute('data-automation')), ['2'])
  })

  it('opens at the filter the address names, and says when nothing matches', async () => {
    const { k, rows, press } = await mountTab('automations', { items: [MEETING], search: 'show=draft' })
    assert.equal(rows().length, 0)
    assert.ok(k.bodyText().includes('No automation matches'))
    await press('Clear the search')
    assert.equal(rows().length, 1)
  })

  it('shows a person who may only read switches they cannot use, and no way to add or change', async () => {
    const { k, button } = await mountTab('automations', { items, role: 'executive' })
    assert.equal(button('New automation'), undefined)
    assert.ok((k.all('input[role="switch"]') as HTMLInputElement[]).every((s) => s.disabled))
    assert.equal(k.all('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('More actions')).length, 0)
  })

  it('opens the builder on an automation that is paused, with its sentence at the top and the event fixed', async () => {
    const { k, dialog } = await mountTab('automations', { items })
    const menu = await openMenu(k, 'More actions for Welcome new leads')
    await k.click(menu.find((m) => m.textContent === 'Edit')!); await k.tick(30)
    assert.ok(dialog())
    assert.ok(k.bodyText().includes('Edit automation'))
    assert.ok(k.bodyText().includes('When a lead is created, add a note to the lead.'))
    assert.ok(k.bodyText().includes('The event cannot be changed after the automation is created.'))
    assert.ok(k.bodyText().includes('Save changes'))
  })
})

describe('Automations tab: failing', () => {
  afterEach(disposeAll)

  it('shows an error with a retry, and the list once the retry works', async () => {
    const { k, rows, press, calls } = await mountTab('automations', { items: [DRAFT], listFailsTimes: 1 })
    assert.ok(k.bodyText().includes('The automations could not be loaded'))
    assert.equal(rows().length, 0)
    await press('Retry')
    assert.equal(rows().length, 1)
    assert.equal(calls.list, 2)
  })
})
