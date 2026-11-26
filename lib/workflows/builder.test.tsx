import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { ApiError } from '../../services/core'
import { workflow } from './fixtures'
import { mountTab, type Kit } from './screen-kit'

/** The builder in a fake browser: the real drawer, pickers and fields, with the service replaced by a fake that records what it is asked. */

const nativeValue = (k: Kit, proto: string) => Object.getOwnPropertyDescriptor((k.w as unknown as Record<string, { prototype: object }>)[proto].prototype, 'value')!.set!

const labelled = (k: Kit, text: string): HTMLElement => {
  const label = k.all('label').find((l) => (l.textContent ?? '').replace(/\*$/, '').trim() === text)
  assert.ok(label, `there is a field labelled "${text}"`)
  const el = k.w.document.getElementById(label!.getAttribute('for')!)
  assert.ok(el, `"${text}" has a control`)
  return el!
}

async function fill(k: Kit, el: HTMLElement, value: string) {
  const proto = el.tagName === 'SELECT' ? 'HTMLSelectElement' : el.tagName === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'
  await k.act(async () => {
    nativeValue(k, proto).call(el, value)
    el.dispatchEvent(new k.w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
  await k.tick(10)
}

const byLabel = (k: Kit, aria: string) => k.all('[aria-label]').find((e) => e.getAttribute('aria-label') === aria) as HTMLElement

/** Opens a grouped picker, types to search, and chooses the option whose label starts with `option`. */
async function pick(k: Kit, field: string, option: string, search?: string) {
  await k.click(labelled(k, field)); await k.tick(10)
  if (search) await fill(k, k.one('input[role="combobox"]')!, search)
  const choice = k.all('[role="option"]').find((o) => (o.textContent ?? '').trim().startsWith(option))
  assert.ok(choice, `there is an option "${option}"`)
  await k.click(choice!); await k.tick(10)
}

async function openNew() {
  const mounted = await mountTab('automations', { items: [], recipes: [] })
  await mounted.press('Start from scratch')
  return mounted
}

describe('the builder: a new automation', () => {
  afterEach(disposeAll)

  it('says in words what is missing, and sends nothing, when saved empty', async () => {
    const { k, press, calls } = await openNew()
    await press('Save as draft')
    assert.deepEqual(calls.create, [])
    for (const message of ['Give the automation a name.', 'Choose what starts the automation.', 'Add at least one step.']) assert.ok(k.bodyText().includes(message), message)
    assert.ok(k.one('[role="alert"]')!.textContent!.includes('This could not be saved yet'))
    assert.equal(labelled(k, 'Name').getAttribute('aria-invalid'), 'true', 'the field is marked, so a screen reader reads its error')
  })

  it('builds an automation: event, condition, step, and reads it back as one sentence as it goes', async () => {
    const { k, press, calls } = await openNew()
    await fill(k, labelled(k, 'Name'), 'Welcome new leads')
    await pick(k, 'What starts it', 'CRM lead created', 'lead')
    assert.ok(k.bodyText().includes('When a lead is created, choose what should happen.'))

    await press('Add a condition')
    await fill(k, byLabel(k, 'Condition 1: what to look at'), 'lead.missing_count')
    await fill(k, byLabel(k, 'Condition 1: how to compare'), 'gt')
    await fill(k, byLabel(k, 'Condition 1: value'), '2')
    assert.ok(k.bodyText().includes('When a lead is created and the details missing is more than 2, choose what should happen.'))

    await press('Add a step')
    await pick(k, 'What it does', 'Add a note to the lead')
    await fill(k, labelled(k, 'Note'), 'Hello')
    assert.ok(/When a lead is created and the details missing is more than 2, add a note to the lead\./.test(k.bodyText()))

    await press('Save as draft')
    assert.equal(calls.create.length, 1)
    assert.deepEqual(calls.create[0], {
      name: 'Welcome new leads',
      description: null,
      trigger_event: 'crm.lead.created',
      conditions: [{ field: 'lead.missing_count', op: 'gt', value: 2 }],
      actions: [{ type: 'add_lead_note', params: { text: 'Hello' } }],
      requires_approval: false,
      max_runs_per_day: 100,
    })
    assert.ok(k.bodyText().includes('Saved as a draft. Try it, then turn it on when you are ready.'))
    assert.equal(k.one('[role="dialog"]'), null, 'the drawer closes after a save')
  })

  it('lists the steps that cannot follow the chosen event as unavailable, with the reason', async () => {
    const { k, press } = await openNew()
    await pick(k, 'What starts it', 'Opportunity sales stage changed')
    await press('Add a step')
    await k.click(labelled(k, 'What it does')); await k.tick(10)
    const note = k.all('[role="option"]').find((o) => (o.textContent ?? '').includes('Add a note to the lead'))!
    assert.equal(note.getAttribute('aria-disabled'), 'true')
    assert.ok(note.textContent!.includes('Needs an event about a lead'))
  })

  it('draws a step\'s details from the typed list: required marked, a choice, a yes/no, and an option to insert a detail of the record', async () => {
    const { k, press } = await openNew()
    await pick(k, 'What starts it', 'CRM lead created')
    await press('Add a step')
    await pick(k, 'What it does', 'Create a follow-up task for the lead')
    assert.ok(labelled(k, 'Task title'))
    assert.equal(labelled(k, 'Attach it to').tagName, 'SELECT')
    assert.equal(labelled(k, 'Only when nothing is set').tagName, 'SELECT')
    assert.equal((labelled(k, 'Due in days') as HTMLInputElement).type, 'number')
    const insert = byLabel(k, 'Insert a detail from the record into Task title') as HTMLSelectElement
    await fill(k, labelled(k, 'Task title'), 'Call ')
    await fill(k, insert, 'lead.company')
    assert.equal((labelled(k, 'Task title') as HTMLInputElement).value, 'Call {{lead.company}}')
  })

  it('says a step that needs approval needs it, and forces the approval switch on', async () => {
    const { k, press } = await openNew()
    await pick(k, 'What starts it', 'CRM lead created')
    await press('Add a step')
    await pick(k, 'What it does', 'Convert the lead')
    assert.ok(k.bodyText().includes('Each run waits for an administrator to approve it before this step happens.'))
    const box = k.one('input[name="requires-approval"]') as HTMLInputElement
    assert.equal(box.checked, true)
    assert.equal(box.disabled, true)
    assert.ok(k.bodyText().includes('Always on: one of the steps needs approval.'))
    assert.ok(/; needs your approval\./.test(k.bodyText()))
  })

  it('asks before closing with changes, and closes on "Discard changes"', async () => {
    const { k, press } = await openNew()
    await fill(k, labelled(k, 'Name'), 'Half done')
    await press('Cancel')
    const ask = k.one('[role="alertdialog"]')!
    assert.ok(ask.textContent!.includes('Discard your changes?'))
    await k.click(k.withText('Cancel', '[role="alertdialog"] button')!); await k.tick(30)
    assert.ok(k.one('[role="dialog"]'), 'it stays open when the person keeps editing')
    await press('Cancel')
    await k.click(k.withText('Discard changes')!); await k.tick(30)
    assert.equal(k.one('[role="dialog"]'), null)
  })

  it('closes with no question when nothing was changed', async () => {
    const { k, press } = await openNew()
    await press('Cancel')
    assert.equal(k.one('[role="alertdialog"]'), null)
    assert.equal(k.one('[role="dialog"]'), null)
  })

  it('puts the server’s refusal beside the step it is about, in the screen’s words, and keeps what was typed', async () => {
    const { k, press, workflowsService } = await mountTab('automations', { items: [], recipes: [] })
    let sent = 0
    Object.assign(workflowsService, {
      create: async () => {
        sent += 1
        throw new ApiError('Invalid workflow: Action 1 (create_lead_task): title of 1-150 characters is required.', 422, { definition: ['Action 1 (create_lead_task): a title of 1-150 characters is required.'] })
      },
    })
    await press('Start from scratch')
    await fill(k, labelled(k, 'Name'), 'Chase invoices')
    await pick(k, 'What starts it', 'CRM lead created')
    await press('Add a step')
    await pick(k, 'What it does', 'Create a follow-up task for the lead')
    await fill(k, labelled(k, 'Task title'), 'Call')
    await press('Save as draft')
    assert.equal(sent, 1)
    const card = k.one('ol > li')!
    assert.ok(card.textContent!.includes('A title of 1-150 characters is required.'), 'beside the step it is about')
    assert.ok(!card.textContent!.includes('create_lead_task') && !card.textContent!.includes('Action 1'))
    assert.equal((labelled(k, 'Name') as HTMLInputElement).value, 'Chase invoices', 'what was typed is kept')
    assert.ok(k.one('[role="dialog"]'), 'the drawer stays open')
  })

  it('asks for a required detail of a step before sending anything', async () => {
    const { k, press, calls } = await openNew()
    await fill(k, labelled(k, 'Name'), 'Onboard')
    await pick(k, 'What starts it', 'CRM lead created')
    await press('Add a step')
    await pick(k, 'What it does', 'Open a support onboarding ticket')
    await fill(k, labelled(k, 'Ticket title'), 'Onboarding')
    await press('Save as draft')
    assert.deepEqual(calls.create, [])
    assert.ok(k.bodyText().includes('Step 1: fill in “Assign to”.'))
  })
})

describe('the builder: an existing automation', () => {
  afterEach(disposeAll)
  const draft = workflow({
    id: 2, name: 'Welcome new leads', status: 'draft', trigger_event: 'crm.lead.created', conditions: [],
    actions: [{ type: 'add_lead_note', params: { text: 'Hello' } }], needs_approval: false,
  })

  async function openEdit() {
    const mounted = await mountTab('automations', { items: [draft] })
    const trigger = mounted.k.all('button').find((b) => b.getAttribute('aria-label') === 'More actions for Welcome new leads')!
    await mounted.k.act(async () => { trigger.dispatchEvent(new mounted.k.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    await mounted.k.tick(30)
    await mounted.k.click(mounted.k.all('[role="menuitem"]').find((m) => m.textContent === 'Edit')!)
    await mounted.k.tick(30)
    return mounted
  }

  it('opens with the saved values, the event fixed, and saves only what the server accepts on an update (no event)', async () => {
    const { k, press, calls } = await openEdit()
    assert.equal((labelled(k, 'Name') as HTMLInputElement).value, 'Welcome new leads')
    assert.equal((labelled(k, 'What starts it') as HTMLButtonElement).disabled, true)
    await fill(k, labelled(k, 'Note'), 'Hello again')
    await press('Save changes')
    assert.equal(calls.update.length, 1)
    assert.equal(calls.update[0].id, 2)
    assert.equal('trigger_event' in calls.update[0].body, false)
    assert.deepEqual(calls.update[0].body.actions, [{ type: 'add_lead_note', params: { text: 'Hello again' } }])
    assert.ok(k.bodyText().includes('Saved.'))
  })

  it('turns on as a separate step, and only once the changes are saved', async () => {
    const { k, press, calls, button } = await openEdit()
    assert.ok(button('Turn on'), 'a saved draft can be turned on')
    await fill(k, labelled(k, 'Name'), 'Welcome everyone')
    assert.equal(button('Turn on'), undefined, 'not while there are unsaved changes')
    await fill(k, labelled(k, 'Name'), 'Welcome new leads')
    await press('Turn on')
    assert.deepEqual(calls.setStatus, [{ id: 2, status: 'active', confirm: false }])
    assert.ok(k.bodyText().includes('Turned on.'))
  })

  it('has a Try it button in the drawer, which opens the panel that says nothing is changed', async () => {
    const { k, press } = await openEdit()
    await press('Try it')
    assert.ok(k.bodyText().includes('Nothing was changed.'))
    assert.ok(k.bodyText().includes('Choose a lead to try it on'))
  })
})
