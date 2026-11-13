import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit, w } from '../scaffolds/dom-test-kit'

const REASONS = [
  { value: 'not_a_buyer', label: 'Not a buyer for our products' },
  { value: 'stale', label: 'Too old to act on' },
  { value: 'other', label: 'Other (a note is required)' },
]

const CONFLICT = {
  id: 9, decision: 'follow_up', reason_code: null, reason_label: null, note: 'Called the office.', from_status: 'New', to_status: 'Follow-up',
  via: 'signal_review', decided_by: 4, decided_by_name: 'Anil Shah', decided_at: new Date(Date.now() - 2 * 60_000).toISOString(),
}

/**
 * Makes Radix believe every closed element has an exit animation running (an animation that never ends here), so closed content stays mounted, as it
 * does for the length of the fade in a browser. The answer is worked out when it is read, not when the style is fetched, because Radix fetches it once.
 */
function holdClosedContent() {
  const g = globalThis as unknown as { getComputedStyle: (el: Element, ...rest: unknown[]) => CSSStyleDeclaration }
  const real = g.getComputedStyle
  g.getComputedStyle = (el, ...rest) => new Proxy(real(el, ...rest), {
    get: (target, prop) => {
      if (prop === 'animationName' && el.getAttribute('data-state') === 'closed') return 'fade-out'
      const value: unknown = Reflect.get(target, prop)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  })
  return () => { g.getComputedStyle = real }
}

/** The real dialog (Radix Dialog) in a fake browser, with the calls the screen would receive recorded. */
async function setup(over: Record<string, unknown> = {}) {
  const k = await kit()
  const { SignalDecisionDialog } = await import('../../components/domain/crm/signal-decision-dialog')
  const calls = { submitted: [] as unknown[], resolved: [] as unknown[], closed: 0 }
  const props = {
    open: true, mode: 'dismissed', signalTitle: 'District office invites bids for a school management system', currentStatus: 'New',
    reasons: REASONS, saving: false, serverErrors: null, formError: null, conflict: null,
    onSubmit: (answer: unknown) => { calls.submitted.push(answer) },
    onResolveConflict: (choice: unknown) => { calls.resolved.push(choice) },
    onClose: () => { calls.closed += 1 },
    ...over,
  }
  const show = (patch: Record<string, unknown> = {}) => k.render(k.h(SignalDecisionDialog, { ...props, ...patch }))
  await show()
  await k.tick()

  const select = () => k.one('select') as HTMLSelectElement | null
  const textarea = () => k.one('textarea') as HTMLTextAreaElement | null
  const submitButton = () => k.one('button[type="submit"]') as HTMLButtonElement
  const submit = async () => { await k.click(submitButton()); await k.tick() }
  /** Sets a native control's value the way a person's input would, so React's onChange fires. */
  const type = async (el: HTMLElement, value: string) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLTextAreaElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
  }
  /** The text of the messages a control points at (its hint and its error). */
  const described = (el: HTMLElement | null) => (el?.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
    .map((id) => w.document.getElementById(id)?.textContent ?? '').join(' | ')
  const title = () => k.one('[role="dialog"] h2')?.textContent
  const active = () => w.document.activeElement

  return { k, calls, show, select, textarea, submit, submitButton, type, described, title, active }
}

describe('SignalDecisionDialog: what it asks', () => {
  afterEach(disposeAll)

  it('is titled for each way of opening it, with Follow-up called Contacted', async () => {
    const { show, title, k } = await setup()
    const titles: Record<string, string> = {}
    for (const mode of ['dismissed', 'follow_up', 'reviewed', 'reopened']) { await show({ mode }); await k.tick(); titles[mode] = title() ?? '' }
    assert.deepEqual(titles, { dismissed: 'Not relevant', follow_up: 'Contacted', reviewed: 'Reviewed', reopened: 'Reopen' })
  })

  it('names the signal and its current status', async () => {
    const { k } = await setup({ currentStatus: 'Follow-up' })
    assert.ok(k.bodyText().includes('District office invites bids for a school management system'))
    assert.ok(k.bodyText().includes('Now: Contacted'))
  })

  it('asks for a reason from the list when dismissing, and for none otherwise', async () => {
    const { select, show, k } = await setup()
    assert.deepEqual(Array.from(select()!.options).map((o) => o.textContent), ['Choose a reason…', ...REASONS.map((r) => r.label)])
    assert.equal(select()!.getAttribute('aria-required'), 'true')
    for (const mode of ['reviewed', 'follow_up', 'reopened']) { await show({ mode }); await k.tick(); assert.equal(select(), null, mode) }
  })

  it('uses a native select for the reasons, so the wheel scrolls it inside the dialog', async () => {
    const { select, k } = await setup()
    assert.equal(select()!.tagName, 'SELECT')
    assert.equal(k.all('[role="listbox"], [role="combobox"]').length, 0)
  })
})

describe('SignalDecisionDialog: client-side checks', () => {
  afterEach(disposeAll)

  it('blocks a dismissal without a reason, says why under the field and focuses it', async () => {
    const { calls, select, submit, described, active } = await setup()
    await submit()
    assert.deepEqual(calls.submitted, [], 'nothing is handed to the screen')
    assert.equal(select()!.getAttribute('aria-invalid'), 'true')
    assert.equal(described(select()), 'Pick one. This helps us find better signals. | Choose a reason to continue.')
    assert.equal(active(), select(), 'focus moved to the first invalid field')
  })

  it('hands over the reason and a trimmed note once a reason is chosen', async () => {
    const { calls, select, textarea, type, submit } = await setup()
    await type(select()!, 'stale')
    await type(textarea()!, '  Event was last year.  ')
    await submit()
    assert.deepEqual(calls.submitted, [{ decision: 'dismissed', reason_code: 'stale', note: 'Event was last year.' }])
  })

  it('sends no note at all when the note is only spaces', async () => {
    const { calls, select, textarea, type, submit } = await setup()
    await type(select()!, 'not_a_buyer')
    await type(textarea()!, '   ')
    await submit()
    assert.deepEqual(calls.submitted, [{ decision: 'dismissed', reason_code: 'not_a_buyer' }])
  })

  it('needs a note when the reason is "Other", says so under the note and focuses it', async () => {
    const { calls, select, textarea, type, submit, described, active } = await setup()
    await type(select()!, 'other')
    assert.equal(textarea()!.getAttribute('aria-required'), 'true', 'the note is marked required as soon as Other is chosen')
    await type(textarea()!, '   ')
    await submit()
    assert.deepEqual(calls.submitted, [])
    assert.equal(textarea()!.getAttribute('aria-invalid'), 'true')
    assert.ok(described(textarea()).includes('Add a note: say what “Other” means for this signal.'))
    assert.equal(active(), textarea())

    await type(textarea()!, 'A rival already won the tender.')
    await submit()
    assert.deepEqual(calls.submitted, [{ decision: 'dismissed', reason_code: 'other', note: 'A rival already won the tender.' }])
  })

  it('stops requiring a note when the reason changes away from "Other"', async () => {
    const { calls, select, textarea, type, submit } = await setup()
    await type(select()!, 'other')
    await submit()
    assert.equal(textarea()!.getAttribute('aria-invalid'), 'true')
    await type(select()!, 'stale')
    assert.equal(textarea()!.hasAttribute('aria-invalid'), false, 'the old message is gone')
    await submit()
    assert.deepEqual(calls.submitted, [{ decision: 'dismissed', reason_code: 'stale' }])
  })

  it('takes an optional note, and never a reason, for Contacted, Reviewed and Reopen', async () => {
    for (const mode of ['follow_up', 'reviewed', 'reopened']) {
      const { calls, textarea, type, submit, k } = await setup({ mode })
      assert.ok(k.bodyText().includes('Note (optional)'), mode)
      await submit()
      assert.deepEqual(calls.submitted, [{ decision: mode }], `${mode} goes through with no note`)
      await type(textarea()!, 'Spoke to the principal.')
      await submit()
      assert.deepEqual(calls.submitted[1], { decision: mode, note: 'Spoke to the principal.' })
      await disposeAll()
    }
  })

  it('counts the note and stops it at 1000 characters, the same cap as the server', async () => {
    const { textarea, type, k } = await setup()
    assert.equal(textarea()!.getAttribute('maxlength'), '1000')
    assert.ok(k.bodyText().includes('0 / 1000'))
    await type(textarea()!, 'x'.repeat(1200))
    assert.equal(textarea()!.value.length, 1000)
    assert.ok(k.bodyText().includes('1000 / 1000'))
  })
})

describe('SignalDecisionDialog: what the server answered', () => {
  afterEach(disposeAll)

  it('shows each server message under its own field and moves focus to the first invalid one', async () => {
    const { show, select, textarea, described, active, k } = await setup()
    await show({ saving: true })
    await show({ saving: false, serverErrors: { reason_code: 'That reason is not on the list.', note: 'The note is too long.' } })
    await k.tick()
    assert.ok(described(select()).endsWith('That reason is not on the list.'))
    assert.ok(described(textarea()).endsWith('The note is too long.'))
    assert.equal(active(), select())
  })

  it('focuses the note when it is the only invalid field', async () => {
    const { show, textarea, active, k } = await setup()
    await show({ serverErrors: { note: 'The note is too long.' } })
    await k.tick()
    assert.equal(active(), textarea())
  })

  it('waits to move focus until the controls are enabled again', async () => {
    const { show, textarea, active, k } = await setup({ mode: 'reviewed' })
    const cancel = k.withText('Cancel')!
    await k.act(async () => { cancel.focus() })
    await show({ saving: true, serverErrors: { note: 'The note is too long.' } })
    await k.tick()
    assert.equal(active(), cancel, 'a disabled control cannot take focus, so focus is left where it was')
    await show({ saving: false, serverErrors: { note: 'The note is too long.' } })
    await k.tick()
    assert.equal(active(), textarea())
  })

  it('stops showing a server message once its field is edited', async () => {
    const { show, textarea, type, described, k } = await setup({ mode: 'reviewed' })
    const errors = { note: 'The note is too long.' }
    await show({ serverErrors: errors })
    await k.tick()
    assert.ok(described(textarea()).includes('The note is too long.'))
    await type(textarea()!, 'shorter')
    assert.equal(textarea()!.hasAttribute('aria-invalid'), false)
    await show({ serverErrors: { note: 'The note is too long.' } })
    assert.ok(described(textarea()).includes('The note is too long.'), 'a new answer shows its own message again')
  })

  it('shows a message that belongs to no field in an alert, with the screen\'s own message', async () => {
    const { k } = await setup({ formError: 'The server did not answer.', serverErrors: { decision: 'Choose a decision.' } })
    const alert = k.one('[role="alert"]')!
    assert.ok(alert.textContent!.includes('The server did not answer.'))
    assert.ok(alert.textContent!.includes('Choose a decision.'))
  })

  it('shows nothing in the alert region when there is no formError', async () => {
    const { k } = await setup()
    assert.equal(k.one('[role="alert"]'), null)
  })
})

describe('SignalDecisionDialog: saving', () => {
  afterEach(disposeAll)

  it('disables every control, says Saving… and ignores another press and Escape', async () => {
    const { calls, select, submitButton, type, show, k } = await setup()
    await type(select()!, 'stale')
    await show({ saving: true })
    const controls = k.all('form select, form textarea, form button') as HTMLButtonElement[]
    assert.ok(controls.length >= 4)
    assert.ok(controls.every((el) => el.disabled), 'select, note, Cancel and the submit button')
    assert.equal(submitButton().textContent, 'Saving…')

    await k.click(submitButton())
    await k.press('Escape')
    await k.tick()
    assert.deepEqual(calls.submitted, [])
    assert.equal(calls.closed, 0, 'cannot be closed mid-save')
  })
})

describe('SignalDecisionDialog: someone decided first', () => {
  afterEach(disposeAll)

  it('shows who decided, when and what, in place of the form', async () => {
    const { k, textarea } = await setup({ mode: 'reviewed', conflict: { ...CONFLICT, reason_code: 'stale', reason_label: 'Too old to act on' } })
    const text = k.bodyText()
    assert.ok(text.includes('Someone decided first'))
    assert.ok(text.includes('Anil Shah already decided on this signal 2 minutes ago.'))
    assert.ok(text.includes('Contacted'))
    assert.ok(text.includes('Too old to act on'))
    assert.ok(text.includes('Called the office.'))
    assert.equal(textarea(), null, 'the form is replaced')
    assert.equal(k.one('button[type="submit"]'), null)
  })

  it('does not name a decider it does not know', async () => {
    const { k } = await setup({ conflict: { ...CONFLICT, decided_by_name: null } })
    assert.ok(k.bodyText().includes('Someone already decided on this signal'))
  })

  it('reports Continue anyway and Cancel as the choices they are', async () => {
    const { k, calls } = await setup({ conflict: CONFLICT })
    await k.click(k.withText('Continue anyway')!)
    assert.deepEqual(calls.resolved, ['continue'])
    await k.click(k.withText('Cancel')!)
    assert.deepEqual(calls.resolved, ['continue', 'cancel'])
    assert.deepEqual(calls.submitted, [], 'resolving a conflict is the screen\'s call, not a submit')
  })

  it('keeps what the person typed while the conflict is shown', async () => {
    const { show, textarea, type, k } = await setup({ mode: 'reviewed' })
    await type(textarea()!, 'My note')
    await show({ conflict: CONFLICT })
    await show({ conflict: null })
    await k.tick()
    assert.equal(textarea()!.value, 'My note')
  })
})

describe('SignalDecisionDialog: closing and opening', () => {
  afterEach(disposeAll)

  it('closes on Escape, on the close button and on Cancel', async () => {
    const { k, calls } = await setup()
    await k.press('Escape'); await k.tick()
    assert.equal(calls.closed, 1)
    await k.click(k.withText('Close')!); await k.tick()
    assert.equal(calls.closed, 2)
    await k.click(k.withText('Cancel')!); await k.tick()
    assert.equal(calls.closed, 3)
  })

  it('draws nothing while closed', async () => {
    const { k } = await setup({ open: false })
    assert.equal(k.one('[role="dialog"]'), null)
  })

  it('starts a fresh form every time it opens', async () => {
    const { show, select, textarea, type, k } = await setup()
    await type(select()!, 'other')
    await type(textarea()!, 'left over')
    await show({ open: false }); await k.tick()
    await show({ open: true }); await k.tick()
    assert.equal(select()!.value, '')
    assert.equal(textarea()!.value, '')
  })

  it('starts fresh even when the last one is still fading out', async () => {
    const release = holdClosedContent()
    try {
      const { show, select, textarea, type, k } = await setup()
      await type(select()!, 'other')
      await type(textarea()!, 'left over')
      await show({ open: false }); await k.tick()
      assert.ok(k.one('[role="dialog"]'), 'the closed dialog is still on the page, as during a fade-out')
      await show({ open: true }); await k.tick()
      assert.equal(select()!.value, '')
      assert.equal(textarea()!.value, '')
    } finally {
      release()
    }
  })
})
