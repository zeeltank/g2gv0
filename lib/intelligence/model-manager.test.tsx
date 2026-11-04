import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'

// The AI client reads this when it makes a request, so it only has to be set before the first one.
process.env.NEXT_PUBLIC_AI_BASE_URL = 'http://ai.test'

const PLATFORM_FLASH = 'DeepSeek Flash (platform)'
const OWN_FLASH = 'DeepSeek Flash (ours)'
const OWN_PRO = 'DeepSeek Pro (ours)'
const OWN_LITE = 'DeepSeek Lite (ours)'
const OWN_LONELY = 'Lonely (ours)'
const HINT = 'Price per 1,000,000 tokens. Leave blank if unknown: the cost of a run then shows as unknown, never as zero.'

function row(over: Record<string, unknown>) {
  return {
    id: 0, provider: 'deepseek', model_id: 'm', label: 'm', max_output_tokens: null, input_cost_per_1k: null, output_cost_per_1k: null, currency: 'INR',
    sort_order: 3, status: 1, scope: 'institute', ...over,
  }
}

/** A platform default with a full price, an organisation row of the same model with none, and the other cases the Price column words differently. */
const INDEX = {
  sub_institute_id: 7,
  providers: [{ key: 'deepseek', label: 'DeepSeek', driveable: true, api_type: 'deepseek', docs: '' }],
  models: {
    deepseek: [
      row({ id: 1, model_id: 'deepseek-flash', label: PLATFORM_FLASH, input_cost_per_1k: 0.0288, output_cost_per_1k: 0.1152, scope: 'platform' }),
      row({ id: 2, model_id: 'deepseek-flash', label: OWN_FLASH }),
      row({ id: 3, model_id: 'deepseek-pro', label: OWN_PRO, input_cost_per_1k: 0.0003, output_cost_per_1k: 0.0012, currency: 'USD' }),
      row({ id: 4, model_id: 'deepseek-lite', label: 'DeepSeek Lite (platform)', input_cost_per_1k: 0.01, output_cost_per_1k: 0.02, scope: 'platform' }),
      row({ id: 5, model_id: 'deepseek-lite', label: OWN_LITE, input_cost_per_1k: 0.5, output_cost_per_1k: null }),
      row({ id: 6, model_id: 'lonely', label: OWN_LONELY }),
    ],
  },
}

interface Call { method: string; url: string; body: Record<string, any> | null }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** The real model manager in a fake browser, with the AI API replaced by a fake that records every write. */
async function setup(options: { onWrite?: (call: Call) => Response } = {}) {
  const calls: Call[] = []
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call: Call = { method: init?.method ?? 'GET', url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null }
    if (call.method === 'GET') return json({ success: true, message: 'ok', data: INDEX })
    calls.push(call)
    return options.onWrite ? options.onWrite(call) : json({ success: true, message: 'saved', data: { model: {} } })
  }) as typeof fetch

  const k = await kit()
  k.w.localStorage.setItem('userData', JSON.stringify({ token: 'test-token', sub_institute_id: 7 }))
  const { ModelManager } = await import('../../app/ai/_components/ModelManager')
  await k.render(k.h(ModelManager))
  const settle = async () => { for (let i = 0; i < 4; i += 1) await k.tick(5) }
  await settle()

  /** The table row whose first cell is `label`. */
  const rowOf = (label: string) => {
    const tr = k.all('tbody tr').find((r) => r.querySelector('td')?.textContent === label)
    assert.ok(tr, `a row for ${label}`)
    return tr
  }
  /** The cells of that row, by column. */
  const cells = (label: string) => {
    const [name, modelId, maxOutput, price, scope, status, action] = Array.from(rowOf(label).querySelectorAll('td')).map((td) => td.textContent ?? '')
    return { name, modelId, maxOutput, price, scope, status, action }
  }
  /** A form field by the start of its label. The label holds the control and the error under it. */
  const field = (start: string) => {
    const label = k.all('form label').find((l) => l.textContent?.startsWith(start))
    assert.ok(label, `a field labelled ${start}`)
    return { label, control: label.querySelector('input,select') as HTMLInputElement & HTMLSelectElement, text: label.textContent ?? '' }
  }
  /** Sets a native control the way a person's input would, so React's onChange fires. */
  const type = (el: HTMLElement, value: string) => k.act(async () => {
    const proto = el.tagName === 'SELECT' ? k.w.HTMLSelectElement.prototype : k.w.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
    el.dispatchEvent(new k.w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
  const openAdd = async () => { await k.click(k.withText('Add model')!); await settle() }
  const openEdit = async (label: string) => {
    const edit = Array.from(rowOf(label).querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Edit')
    assert.ok(edit, `an Edit button on ${label}`)
    await k.click(edit)
    await settle()
  }
  const fillRequired = async () => {
    await type(field('Provider').control, 'deepseek')
    await type(field('Model id').control, 'deepseek-flash-x')
    await type(field('Label').control, 'Flash X')
  }
  const save = async () => { await k.click(k.one('form button[type="submit"]')!); await settle() }

  return { k, calls, rowOf, cells, field, type, openAdd, openEdit, fillRequired, save, settle }
}

describe('ModelManager: platform rows stay read-only', () => {
  const realFetch = globalThis.fetch
  afterEach(async () => { globalThis.fetch = realFetch; await disposeAll() })

  it('has no Edit button, and no control at all, on a platform row', async () => {
    const { rowOf } = await setup()
    const platform = rowOf(PLATFORM_FLASH)
    assert.equal(platform.querySelectorAll('button').length, 0)
    assert.ok(platform.textContent!.includes('Shared — read only'))
  })

  it('shows the platform row\'s price, in its own currency, and says whose it is', async () => {
    const { cells } = await setup()
    const platform = cells(PLATFORM_FLASH)
    assert.equal(platform.price, '₹28.80 / ₹115.20')
    assert.equal(platform.scope, 'Platform default (set by the developer company)')
  })

  it('offers Edit on the organisation\'s own rows only', async () => {
    const { rowOf } = await setup()
    for (const label of [OWN_FLASH, OWN_PRO, OWN_LITE, OWN_LONELY]) {
      assert.ok(Array.from(rowOf(label).querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Edit'), label)
    }
    assert.equal(rowOf('DeepSeek Lite (platform)').querySelectorAll('button').length, 0)
  })
})

describe('ModelManager: which price applies', () => {
  const realFetch = globalThis.fetch
  afterEach(async () => { globalThis.fetch = realFetch; await disposeAll() })

  it('shows an own row\'s full price in its own currency', async () => {
    const { cells } = await setup()
    assert.equal(cells(OWN_PRO).price, '$0.30 / $1.20')
    assert.equal(cells(OWN_PRO).scope, 'This organisation')
  })

  it('says the platform default applies when the own row has no price and the platform row has one', async () => {
    const { cells } = await setup()
    assert.ok(cells(OWN_FLASH).price.includes('Not set'))
    assert.ok(cells(OWN_FLASH).price.includes('The platform default applies: ₹28.80 / ₹115.20'), cells(OWN_FLASH).price)
  })

  it('says the same for an own row with only one of the two prices, because half a price prices nothing', async () => {
    const { cells } = await setup()
    assert.ok(cells(OWN_LITE).price.includes('The platform default applies: ₹10.00 / ₹20.00'), cells(OWN_LITE).price)
  })

  it('says the cost will be unknown, not zero, when neither the own row nor a platform default has a price', async () => {
    const { cells } = await setup()
    assert.ok(cells(OWN_LONELY).price.includes('No platform default: the cost of a run shows as unknown'), cells(OWN_LONELY).price)
    assert.ok(!cells(OWN_LONELY).price.includes('applies'))
  })

  it('explains the rule above the table', async () => {
    const { k } = await setup()
    assert.ok(k.bodyText().includes('Your own price is used when it has both an input and an output price'))
  })
})

describe('ModelManager: the price inputs', () => {
  const realFetch = globalThis.fetch
  afterEach(async () => { globalThis.fetch = realFetch; await disposeAll() })

  it('adds Currency (rupees by default), Input price and Output price, per million tokens, with the helper text', async () => {
    const { k, openAdd, field } = await setup()
    await openAdd()
    assert.equal(field('Currency').control.value, 'INR')
    assert.deepEqual(Array.from(field('Currency').control.options).map((o) => o.value), ['INR', 'USD'])
    assert.ok(field('Input price').text.includes('per million tokens'))
    assert.ok(field('Output price').text.includes('per million tokens'))
    assert.equal(field('Input price').control.value, '')
    assert.ok(k.bodyText().includes(HINT))
    assert.ok(!k.bodyText().includes('Input cost per 1K'), 'the old per-1,000 USD inputs are gone')
  })

  it('shows the currency symbol before each price and follows the currency', async () => {
    const { k, openAdd, field, type } = await setup()
    await openAdd()
    const symbols = () => k.all('form label span[aria-hidden="true"]').map((s) => s.textContent)
    assert.deepEqual(symbols(), ['₹', '₹'])
    await type(field('Currency').control, 'USD')
    assert.deepEqual(symbols(), ['$', '$'])
  })

  it('sends a price per 1,000 tokens: 28.8 and 115.2 per million become 0.0288 and 0.1152, in rupees', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '28.8')
    await type(field('Output price').control, '115.2')
    await save()

    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.ok(calls[0].url.endsWith('/ai/configuration-models'))
    assert.equal(calls[0].body!.input_cost_per_1k, 0.0288)
    assert.equal(calls[0].body!.output_cost_per_1k, 0.1152)
    assert.equal(calls[0].body!.currency, 'INR')
  })

  it('sends the chosen currency', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Currency').control, 'USD')
    await type(field('Input price').control, '0.3')
    await type(field('Output price').control, '1.2')
    await save()

    assert.equal(calls[0].body!.currency, 'USD')
    assert.equal(calls[0].body!.input_cost_per_1k, 0.0003)
    assert.equal(calls[0].body!.output_cost_per_1k, 0.0012)
  })

  it('sends nulls, not zeros, when both prices are left blank, and still adds the model as before', async () => {
    const { calls, k, openAdd, fillRequired, save } = await setup()
    await openAdd()
    await fillRequired()
    await save()

    assert.equal(calls.length, 1)
    assert.equal(calls[0].body!.input_cost_per_1k, null)
    assert.equal(calls[0].body!.output_cost_per_1k, null)
    assert.equal(calls[0].body!.provider, 'deepseek')
    assert.equal(calls[0].body!.model_id, 'deepseek-flash-x')
    assert.equal(calls[0].body!.label, 'Flash X')
    assert.equal(calls[0].body!.status, 1)
    assert.ok(k.bodyText().includes('Model added.'))
  })

  it('sends a typed zero as a zero: a free model is a price', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '0')
    await type(field('Output price').control, '0')
    await save()
    assert.equal(calls[0].body!.input_cost_per_1k, 0)
    assert.equal(calls[0].body!.output_cost_per_1k, 0)
  })

  it('opens an own row with its prices back in per-million terms, and saves them unchanged', async () => {
    const { calls, openEdit, field, save } = await setup()
    await openEdit(OWN_PRO)
    assert.equal(field('Currency').control.value, 'USD')
    assert.equal(field('Input price').control.value, '0.3')
    assert.equal(field('Output price').control.value, '1.2')

    await save()
    assert.equal(calls[0].method, 'PUT')
    assert.ok(calls[0].url.endsWith('/ai/configuration-models/3'))
    assert.equal(calls[0].body!.input_cost_per_1k, 0.0003)
    assert.equal(calls[0].body!.output_cost_per_1k, 0.0012)
    assert.equal(calls[0].body!.currency, 'USD')
    assert.equal(calls[0].body!.sort_order, 3, 'an edit still carries the model\'s place in the list')
  })

  it('opens an own row with no price as two empty boxes in rupees', async () => {
    const { openEdit, field } = await setup()
    await openEdit(OWN_FLASH)
    assert.equal(field('Currency').control.value, 'INR')
    assert.equal(field('Input price').control.value, '')
    assert.equal(field('Output price').control.value, '')
  })
})

describe('ModelManager: checks before anything is sent', () => {
  const realFetch = globalThis.fetch
  afterEach(async () => { globalThis.fetch = realFetch; await disposeAll() })

  it('needs both prices or neither: with only the input price it sends nothing and asks for the output price under that field', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '28.8')
    await save()

    assert.equal(calls.length, 0, 'nothing was sent')
    assert.ok(field('Output price').text.includes('leave both blank'), field('Output price').text)
    assert.ok(!field('Input price').text.includes('leave both blank'), 'the price that is there is not blamed')
    assert.equal(field('Output price').control.getAttribute('aria-invalid'), 'true')
  })

  it('asks for the input price when only the output price is there', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Output price').control, '115.2')
    await save()
    assert.equal(calls.length, 0)
    assert.ok(field('Input price').text.includes('leave both blank'))
  })

  it('refuses a negative price, text, and more than three decimals, each under its own field', async () => {
    const { calls, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '-1')
    await type(field('Output price').control, 'abc')
    await save()
    assert.equal(calls.length, 0)
    assert.ok(field('Input price').text.includes('A price cannot be negative.'))
    assert.ok(field('Output price').text.includes('Enter a number'))

    await type(field('Input price').control, '28.8')
    await type(field('Output price').control, '115.2001')
    await save()
    assert.equal(calls.length, 0)
    assert.ok(field('Output price').text.includes('at most 3 decimal places'))
    assert.ok(!field('Input price').text.includes('Enter a number'), 'the fixed price is no longer blamed')
  })

  it('sends once the prices are put right, and drops the old errors', async () => {
    const { calls, k, openAdd, fillRequired, field, type, save } = await setup()
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '28.8')
    await save()
    assert.equal(calls.length, 0)

    await type(field('Output price').control, '115.2')
    await save()
    assert.equal(calls.length, 1)
    assert.ok(k.bodyText().includes('Model added.'))
  })
})

describe('ModelManager: the server\'s answer', () => {
  const realFetch = globalThis.fetch
  afterEach(async () => { globalThis.fetch = realFetch; await disposeAll() })

  const refusal = (errors: Record<string, string[]>) => (): Response => json({ success: false, message: 'The request was not valid.', errors }, 422)

  it('shows the server\'s field errors under the field they are keyed to', async () => {
    const { k, openAdd, fillRequired, field, type, save } = await setup({
      onWrite: refusal({
        currency: ['The selected currency is invalid.'],
        input_cost_per_1k: ['The input cost per 1k must be at least 0.'],
        output_cost_per_1k: ['The output cost per 1k must be at least 0.'],
      }),
    })
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '28.8')
    await type(field('Output price').control, '115.2')
    await save()

    assert.ok(field('Currency').text.includes('The selected currency is invalid.'))
    assert.ok(field('Input price').text.includes('The input cost per 1k must be at least 0.'))
    assert.ok(field('Output price').text.includes('The output cost per 1k must be at least 0.'))
    assert.ok(!field('Currency').text.includes('input cost'), 'each message sits under its own field only')
    assert.ok(k.one('form'), 'the form stays open so the person can correct it')
    assert.ok(!k.bodyText().includes('Model added.'))
  })

  it('does not show one field\'s error under another', async () => {
    const { openAdd, fillRequired, field, type, save } = await setup({ onWrite: refusal({ output_cost_per_1k: ['Too large.'] }) })
    await openAdd()
    await fillRequired()
    await type(field('Input price').control, '1')
    await type(field('Output price').control, '2')
    await save()
    assert.ok(field('Output price').text.includes('Too large.'))
    assert.ok(!field('Input price').text.includes('Too large.'))
    assert.ok(!field('Model id').text.includes('Too large.'))
  })
})
