import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { absent, same, says } from '../agent/assertions'
import { opportunity, pipelineAnswer, REASONS, listAnswer } from './fixtures'
import { screenKit, type Call } from './screen-kit'

/** The opportunity board as a person meets it: the real board, the real dialog, the real sidebar hook and service client, only the network replaced. */

const REFUSAL = { status: 0, message: 'Choose why this opportunity was lost.', code: 'loss_reason_required', errors: { lossReasonCode: ['Required for Closed Lost.'] }, __status: 422 }

interface Setup {
  /** The pipeline answer's reasons; `'older'` leaves the key out, as an older server does. */
  reasons?: unknown[] | 'older'
  /** What the server answers a stage move with, per attempt (the default is to accept it). */
  onStage?: (call: Call, attempt: number) => unknown
  /** Holds a stage move's answer back until the promise settles, so a test can look at the screen while it is saving. */
  hold?: Promise<void>
}

async function open(opts: Setup = {}) {
  const items = [opportunity(), opportunity({ id: '32', name: 'Pongal supplies', organizationName: 'Pongal Traders', salesStage: 'Qualification', amount: 12000 })]
  const moves: Call[] = []
  const screen = await screenKit({
    respond: async (call: Call) => {
      if (call.path.endsWith('/crm/opportunities/pipeline')) return pipelineAnswer(opts.reasons === 'older' ? null : opts.reasons ?? REASONS)
      if (call.method === 'PUT' && call.path.endsWith('/stage')) {
        moves.push(call)
        if (opts.hold) await opts.hold
        const answer = opts.onStage?.(call, moves.length)
        if (answer !== undefined) return answer
        const id = call.path.split('/').at(-2)!
        const body = call.body as { salesStage: string; lossReasonCode?: string }
        const row = items.find((item) => item.id === id)!
        row.salesStage = body.salesStage
        return { status: 1, message: 'Stage updated.', data: { ...row, loss_reason: body.lossReasonCode ? REASONS.find((r) => r.code === body.lossReasonCode) : null } }
      }
      if (call.path.endsWith('/crm/opportunities')) return listAnswer(items)
      return undefined
    },
  })
  const prompts: unknown[] = []
  ;(screen.k.w as unknown as { prompt: (...args: unknown[]) => null }).prompt = (...args) => { prompts.push(args); return null }
  const { OpportunityKanbanView } = await import('../../components/domain/crm/opportunity-kanban-view')
  await screen.mount(screen.k.h(OpportunityKanbanView), 40)

  const { k } = screen
  const w = k.w
  const card = (id: string) => k.all('[data-opportunity-card]').find((c) => c.getAttribute('data-opportunity-card') === id) ?? null
  const column = (label: string) => k.all('div').find((d) => d.className.includes('w-[220px]') && d.querySelector('span.text-sm')?.textContent === label) ?? null
  const stageOf = (id: string) => card(id)?.parentElement?.parentElement?.querySelector('span.text-sm')?.textContent ?? null
  const dialog = () => k.one('[role="dialog"]')
  const select = () => dialog()?.querySelector('select') as HTMLSelectElement | null
  const note = () => dialog()?.querySelector('textarea') as HTMLTextAreaElement | null
  const submitButton = () => dialog() ? (Array.from(dialog()!.querySelectorAll('button')).find((b) => /Mark as lost|Saving/.test(b.textContent ?? '')) ?? null) : null
  const drop = async (id: string, label: string) => {
    const target = column(label)
    assert.ok(target, `a ${label} column`)
    const event = new w.Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { getData: (type: string) => (type === 'text/crm-opportunity-id' ? id : ''), setData: () => undefined, dropEffect: '', effectAllowed: '' } })
    await k.act(async () => { target.dispatchEvent(event) })
    await k.tick(30)
  }
  const setValue = async (el: HTMLElement, value: string) => {
    const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLTextAreaElement.prototype
    await k.act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    })
    await k.tick(10)
  }
  const submit = async () => { await k.click(submitButton()!); await k.tick(30); await k.tick(30) }
  const listCalls = () => screen.calls.filter((c) => c.method === 'GET' && c.path.endsWith('/crm/opportunities'))
  const active = () => w.document.activeElement
  return { ...screen, card, column, stageOf, dialog, select, note, submitButton, drop, setValue, submit, moves, prompts, listCalls, active }
}

describe('the board: asking why a deal was lost', () => {
  afterEach(async () => { await disposeAll() })

  it('a card dropped on Closed Lost opens a dialog that names the deal and asks why; it is not the browser\'s prompt, and nothing has moved or been sent', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    assert.ok(s.dialog(), 'a dialog is open')
    assert.equal(s.dialog()!.querySelector('h2')!.textContent, 'Why was this opportunity lost?')
    says(s.dialog()!.textContent, 'Hillcrest ERP rollout')
    assert.deepEqual(s.prompts, [], 'window.prompt was never called')
    assert.equal(s.moves.length, 0, 'no request went out')
    assert.equal(s.stageOf('31'), 'Negotiation/Review', 'the card is still where it was')
    s.restore()
  })

  it('offers the server\'s coded reasons in the server\'s order after a prompt, and a box for the person\'s own words', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    assert.deepEqual(Array.from(s.select()!.options).map((o) => o.textContent), ['Choose a reason…', ...REASONS.map((r) => r.label)])
    assert.deepEqual(Array.from(s.select()!.options).map((o) => o.value), ['', ...REASONS.map((r) => r.code)])
    assert.equal(s.select()!.value, '', 'nothing is chosen for the person')
    assert.ok(s.note(), 'a box for words')
    const label = (el: HTMLElement) => s.k.w.document.querySelector(`label[for="${el.id}"]`)?.textContent
    assert.equal(label(s.select()!), 'Reason lost')
    assert.equal(label(s.note()!), 'Anything to add? (optional)')
    s.restore()
  })

  it('choosing a reason sends it with the move (lossReasonCode), no free text when none was written, then the board shows the card in Closed Lost', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.submit()
    assert.equal(s.moves.length, 1)
    assert.equal(s.moves[0].path.endsWith('/crm/opportunities/31/stage'), true)
    const body = s.moves[0].body as Record<string, unknown>
    assert.equal(body.salesStage, 'Closed Lost')
    assert.equal(body.lossReasonCode, 'price')
    assert.equal('closeReason' in body, false, 'no words, no closeReason key')
    absent(s.dialog(), 'the dialog closed')
    assert.equal(s.stageOf('31'), 'Closed Lost')
    assert.ok(s.listCalls().length >= 2, 'the board read the list again')
    s.restore()
  })

  it('the person\'s own words go with the move as closeReason, beside the code', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'competitor')
    await s.setValue(s.note()!, '  Went with Acme at 20% less  ')
    await s.submit()
    const body = s.moves[0].body as Record<string, unknown>
    assert.equal(body.lossReasonCode, 'competitor')
    assert.equal(body.closeReason, 'Went with Acme at 20% less')
    s.restore()
  })

  it('words alone are enough (the rule the server has always had): no code key is sent', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.note()!, 'Gone quiet')
    await s.submit()
    const body = s.moves[0].body as Record<string, unknown>
    assert.equal(body.closeReason, 'Gone quiet')
    assert.equal('lossReasonCode' in body, false)
    s.restore()
  })

  it('with neither a reason nor words it says so next to the Reason box, sends nothing, keeps the dialog and puts focus on the box', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.submit()
    assert.equal(s.moves.length, 0)
    assert.ok(s.dialog(), 'the dialog stays')
    const error = s.dialog()!.querySelector('[data-loss-reason-error]')
    assert.ok(error, 'an error under the box')
    assert.equal(error!.textContent, 'Choose why this opportunity was lost, or write it in your own words.')
    assert.equal(s.select()!.getAttribute('aria-invalid'), 'true')
    assert.equal(s.select()!.getAttribute('aria-describedby'), error!.id, 'the box points at its error, so a screen reader reads it')
    same(s.active(), s.select(), 'focus is on the Reason box')
    s.restore()
  })

  it('the error goes when the person answers', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.submit()
    await s.setValue(s.select()!, 'timing')
    absent(s.dialog()!.querySelector('[data-loss-reason-error]'), 'no error once a reason is chosen')
    absent(s.select()!.getAttribute('aria-invalid'), 'and the box is no longer invalid')
    s.restore()
  })

  it('each opening starts a fresh form', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.setValue(s.note()!, 'half written')
    await s.k.click(s.k.withText('Cancel')!)
    await s.k.tick(30)
    await s.drop('32', 'Closed Lost')
    assert.equal(s.select()!.value, '')
    assert.equal(s.note()!.value, '')
    says(s.dialog()!.textContent, 'Pongal supplies')
    s.restore()
  })
})

describe('the board: backing out', () => {
  afterEach(async () => { await disposeAll() })

  it('Cancel closes the dialog, sends nothing, leaves the card in its column and gives focus back to the card', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.k.click(s.k.withText('Cancel')!)
    await s.k.tick(30)
    absent(s.dialog(), 'closed')
    assert.equal(s.moves.length, 0)
    assert.equal(s.stageOf('31'), 'Negotiation/Review')
    same(s.active(), s.card('31'), 'focus is on the card')
    s.restore()
  })

  it('Escape does the same', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.note()!, 'half written')
    await s.k.press('Escape')
    await s.k.tick(30)
    absent(s.dialog(), 'closed')
    assert.equal(s.moves.length, 0)
    assert.equal(s.stageOf('31'), 'Negotiation/Review')
    same(s.active(), s.card('31'), 'focus is on the card')
    s.restore()
  })

  it('a card can be asked about again after backing out', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.k.press('Escape')
    await s.k.tick(30)
    await s.drop('31', 'Closed Lost')
    assert.ok(s.dialog(), 'the dialog opens again')
    await s.setValue(s.select()!, 'no_budget')
    await s.submit()
    assert.equal((s.moves[0].body as Record<string, unknown>).lossReasonCode, 'no_budget')
    s.restore()
  })

  it('after a successful move the card is in Closed Lost and has focus', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.submit()
    await s.k.tick(40)
    assert.equal(s.stageOf('31'), 'Closed Lost')
    same(s.active(), s.card('31'), 'focus is on the card, which was drawn again')
    s.restore()
  })
})

describe('the board: when the server says no', () => {
  afterEach(async () => { await disposeAll() })

  it('a required reason (loss_reason_required) is said next to the Reason box, in the server\'s words; the dialog stays and the card does not move', async () => {
    const s = await open({ onStage: (_call, attempt) => (attempt === 1 ? REFUSAL : undefined) })
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.note()!, 'Gone quiet')   // words are enough for the browser; this server wants a code
    await s.submit()
    assert.equal(s.moves.length, 1)
    assert.ok(s.dialog(), 'the dialog stays')
    const error = s.dialog()!.querySelector('[data-loss-reason-field] [data-loss-reason-error]')
    assert.ok(error, 'the sentence is inside the Reason field')
    assert.equal(error!.textContent, 'Choose why this opportunity was lost.')
    assert.equal(s.select()!.getAttribute('aria-describedby'), error!.id)
    assert.equal(s.stageOf('31'), 'Negotiation/Review', 'the card did not move')
    same(s.active(), s.select(), 'focus is on the Reason box, ready for the answer')
    s.restore()
  })

  it('then choosing a reason and trying again succeeds', async () => {
    const s = await open({ onStage: (_call, attempt) => (attempt === 1 ? REFUSAL : undefined) })
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.note()!, 'Gone quiet')
    await s.submit()
    await s.setValue(s.select()!, 'no_response')
    absent(s.dialog()!.querySelector('[data-loss-reason-error]'), 'the old sentence goes once the person answers')
    await s.submit()
    assert.equal(s.moves.length, 2)
    assert.equal((s.moves[1].body as Record<string, unknown>).lossReasonCode, 'no_response')
    absent(s.dialog(), 'closed')
    assert.equal(s.stageOf('31'), 'Closed Lost')
    s.restore()
  })

  it('any other refusal is an alert in the dialog, the dialog stays, and Cancel still backs out', async () => {
    const s = await open({ onStage: () => ({ status: 0, message: 'You cannot change this opportunity.', __status: 403 }) })
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.submit()
    const alert = s.dialog()!.querySelector('[role="alert"]')
    assert.ok(alert, 'an alert')
    says(alert!.textContent, 'You cannot change this opportunity.')
    absent(s.dialog()!.querySelector('[data-loss-reason-error]'), 'it is not about the reason')
    assert.equal(s.stageOf('31'), 'Negotiation/Review')
    await s.k.click(s.k.withText('Cancel')!)
    await s.k.tick(30)
    absent(s.dialog(), 'closed')
    s.restore()
  })

  it('while the move is being saved the controls are disabled and Escape does not close the dialog', async () => {
    let release: () => void = () => undefined
    const hold = new Promise<void>((resolve) => { release = resolve })
    const s = await open({ hold })
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.k.click(s.submitButton()!)
    await s.k.tick(20)
    assert.equal(s.submitButton()!.textContent, 'Saving…')
    assert.equal(s.submitButton()!.hasAttribute('disabled'), true)
    assert.equal(s.select()!.disabled, true)
    assert.equal(s.note()!.disabled, true)
    assert.equal((s.k.withText('Cancel') as HTMLButtonElement).disabled, true)
    await s.k.press('Escape')
    await s.k.tick(20)
    assert.ok(s.dialog(), 'Escape did nothing while saving')
    // The form can also be submitted without the button (Enter in a field): that must not send the move twice.
    const form = s.dialog()!.querySelector('form')!
    await s.k.act(async () => { form.dispatchEvent(new s.k.w.Event('submit', { bubbles: true, cancelable: true })) })
    await s.k.tick(20)
    release()
    await s.k.tick(40)
    absent(s.dialog(), 'closed once saved')
    assert.equal(s.moves.length, 1, 'one request, not two')
    s.restore()
  })

  it('a second card dropped while the question is open does not replace it', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    await s.drop('32', 'Closed Lost')
    says(s.dialog()!.textContent, 'Hillcrest ERP rollout')
    assert.equal(s.dialog()!.textContent!.includes('Pongal supplies'), false, 'still the first deal')
    await s.setValue(s.select()!, 'price')
    await s.submit()
    assert.equal(s.moves.length, 1)
    assert.equal(s.moves[0].path.endsWith('/crm/opportunities/31/stage'), true, 'the answer went to the first deal')
    s.restore()
  })

  it('stops the box for words at the length the server accepts', async () => {
    const s = await open()
    await s.drop('31', 'Closed Lost')
    assert.equal(s.note()!.getAttribute('maxlength'), '1000')
    await s.setValue(s.note()!, 'x'.repeat(1200))
    assert.equal(s.note()!.value.length, 1000)
    says(s.dialog()!.textContent, '1000 / 1000')
    s.restore()
  })
})

describe('the board against an older server (no lossReasons in the pipeline answer)', () => {
  afterEach(async () => { await disposeAll() })

  it('still asks, in a proper dialog, for the person\'s own words as the one required thing, and sends them as closeReason alone', async () => {
    const s = await open({ reasons: 'older' })
    await s.drop('31', 'Closed Lost')
    assert.ok(s.dialog(), 'the dialog opens')
    absent(s.select(), 'no Reason box to offer')
    assert.deepEqual(s.prompts, [])
    const label = s.k.w.document.querySelector(`label[for="${s.note()!.id}"]`)
    assert.equal(label!.textContent, 'Reason lost')
    assert.equal(s.note()!.getAttribute('aria-required'), 'true')

    await s.submit()
    assert.equal(s.moves.length, 0)
    assert.equal(s.dialog()!.querySelector('[data-loss-reason-error]')!.textContent, 'Say why this opportunity was lost - it is the only way the pipeline learns from it.')
    assert.equal(s.note()!.getAttribute('aria-invalid'), 'true')
    same(s.active(), s.note(), 'focus is on the box for words')

    await s.setValue(s.note()!, 'No money this year')
    await s.submit()
    const body = s.moves[0].body as Record<string, unknown>
    assert.equal(body.closeReason, 'No money this year')
    assert.equal('lossReasonCode' in body, false)
    s.restore()
  })

  it('an empty list of reasons is the same as none', async () => {
    const s = await open({ reasons: [] })
    await s.drop('31', 'Closed Lost')
    absent(s.select(), 'no Reason box')
    s.restore()
  })
})

describe('the board: every other move is as it was', () => {
  afterEach(async () => { await disposeAll() })

  it('a move to another stage opens no dialog, moves the card at once and sends the stage alone', async () => {
    const s = await open()
    await s.drop('31', 'Closed Won')
    absent(s.dialog(), 'no dialog')
    assert.equal(s.moves.length, 1)
    assert.equal((s.moves[0].body as Record<string, unknown>).salesStage, 'Closed Won')
    assert.equal('lossReasonCode' in (s.moves[0].body as object), false)
    assert.equal('closeReason' in (s.moves[0].body as object), false)
    assert.equal(s.stageOf('31'), 'Closed Won')
    assert.deepEqual(s.prompts, [])
    s.restore()
  })

  it('a failed ordinary move puts the card back and shows the server\'s sentence above the board', async () => {
    const s = await open({ onStage: () => ({ status: 0, message: 'Stage change refused.', __status: 422 }) })
    await s.drop('31', 'Closed Won')
    assert.equal(s.stageOf('31'), 'Negotiation/Review')
    says(s.k.bodyText(), 'Stage change refused.')
    s.restore()
  })

  it('dropping a card on the column it is already in does nothing', async () => {
    const s = await open()
    await s.drop('31', 'Negotiation/Review')
    absent(s.dialog(), 'no dialog')
    assert.equal(s.moves.length, 0)
    s.restore()
  })

  it('dropping a deal that is already lost on Closed Lost asks nothing', async () => {
    const s = await open({ onStage: undefined })
    await s.drop('31', 'Closed Lost')
    await s.setValue(s.select()!, 'price')
    await s.submit()
    await s.drop('31', 'Closed Lost')
    absent(s.dialog(), 'it is already there')
    assert.equal(s.moves.length, 1)
    s.restore()
  })

  it('a card opens its deal on click and on Enter, and can be reached with the keyboard', async () => {
    const s = await open()
    const card = s.card('31')!
    assert.equal(card.getAttribute('tabindex'), '0')
    assert.equal(card.getAttribute('role'), 'button')
    await s.k.click(card)
    assert.equal(s.router.written.at(-1), '/module/crm/sales/opportunities/31')
    await s.k.press('Enter', s.card('32')!)
    assert.equal(s.router.written.at(-1), '/module/crm/sales/opportunities/32')
    s.restore()
  })

  it('the box that scrolls the board sideways can be focused, and has a role and a name', async () => {
    const s = await open()
    const box = s.k.one('[aria-label="Opportunity pipeline board"]')
    assert.ok(box, 'the scroll box is named')
    assert.equal(box!.getAttribute('role'), 'region')
    assert.equal(box!.getAttribute('tabindex'), '0')
    assert.match(box!.className, /\boverflow-x-auto\b/, 'and it is the box that scrolls')
    assert.ok(box!.querySelector('[data-opportunity-card]'), 'and it holds the cards')
    s.restore()
  })

  it('keeps every column and card the board always showed', async () => {
    const s = await open()
    for (const label of ['Prospecting', 'Qualification', 'Negotiation/Review', 'Closed Won', 'Closed Lost']) assert.ok(s.column(label), label)
    assert.ok(s.card('31') && s.card('32'))
    says(s.k.bodyText(), 'Hillcrest ERP rollout')
    says(s.k.bodyText(), 'Hillcrest Academy')
    says(s.k.bodyText(), 'INR 12,000')
    s.restore()
  })
})

describe('the board: accessibility', () => {
  afterEach(async () => { await disposeAll() })

  it('the dialog has nothing for the accessibility rules to find, with a reason chosen, with an error showing and with a server refusal showing', async () => {
    const s = await open({ onStage: (_call, attempt) => (attempt === 1 ? REFUSAL : undefined) })
    await s.drop('31', 'Closed Lost')
    assert.deepEqual(await axeViolations(s.dialog()!), [], 'fresh')
    await s.submit()
    assert.deepEqual(await axeViolations(s.dialog()!), [], 'with the screen\'s own error')
    await s.setValue(s.note()!, 'Gone quiet')
    await s.submit()
    assert.ok(s.dialog()!.querySelector('[data-loss-reason-error]'), 'the server\'s refusal is showing')
    assert.deepEqual(await axeViolations(s.dialog()!), [], 'with the server\'s refusal')
    s.restore()
  })

  it('the dialog without a list of reasons (older server) has nothing for the rules to find either', async () => {
    const s = await open({ reasons: 'older' })
    await s.drop('31', 'Closed Lost')
    await s.submit()
    assert.deepEqual(await axeViolations(s.dialog()!), [])
    s.restore()
  })

  it('the board itself has nothing for the rules to find (cards are now keyboard buttons)', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.k.w.document.body), [])
    s.restore()
  })
})
