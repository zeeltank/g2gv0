import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './dom-test-kit'

describe('FormLayout', () => {
  afterEach(disposeAll)

  async function setup() {
    const k = await kit()
    const { FormLayout } = await import('../../components/shared/scaffolds/form-layout')
    let submitted = 0
    await k.render(k.h(FormLayout, { id: 'f', onSubmit: () => { submitted += 1 } },
      k.h('input', { id: 'name', required: true, defaultValue: '' }),
      k.h('button', { type: 'submit' }, 'Save')))
    return { k, submitted: () => submitted, form: () => k.one('#f') as HTMLFormElement }
  }

  it('runs onSubmit when the form is submitted and stops the browser from navigating', async () => {
    const { k, submitted, form } = await setup()
    let delivered = true
    await k.act(async () => { delivered = form().dispatchEvent(new k.w.Event('submit', { bubbles: true, cancelable: true })) })
    assert.equal(submitted(), 1)
    assert.equal(delivered, false, 'preventDefault was called, so the page does not reload')
  })

  it('does not let the browser block the submit on its own validation: the server\'s answer is the one source of messages', async () => {
    const { k, submitted, form } = await setup()
    assert.equal(form().noValidate, true)
    await k.click(k.withText('Save')!)
    assert.equal(submitted(), 1, 'the empty required input did not stop it')
  })
})
