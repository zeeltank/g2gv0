import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './dom-test-kit'

/** useConfirm with the real ConfirmDialog (Radix AlertDialog) in a fake browser. */
async function setup() {
  const k = await kit()
  const { useConfirm } = await import('../../components/shared/scaffolds/use-confirm')
  const answers: boolean[] = []

  function Host() {
    const { confirm, confirmDialog } = useConfirm()
    return k.h(k.React.Fragment, null,
      k.h('button', {
        id: 'ask',
        onClick: async () => { answers.push(await confirm({ title: 'Archive Scholar Core?', description: 'It leaves the pickers.', confirmLabel: 'Archive' })) },
      }, 'ask'),
      confirmDialog)
  }

  await k.render(k.h(Host))
  const ask = () => k.click(k.one('#ask')!)

  return { k, answers, ask, Host }
}

describe('useConfirm', () => {
  afterEach(disposeAll)

  it('asks with the given words and answers true on the confirm button', async () => {
    const { k, answers, ask } = await setup()
    assert.ok(!k.bodyText().includes('Archive Scholar Core?'), 'nothing is shown until it is asked')

    await ask(); await k.tick()
    assert.ok(k.bodyText().includes('Archive Scholar Core?'))
    assert.ok(k.bodyText().includes('It leaves the pickers.'))
    assert.deepEqual(answers, [], 'still waiting for the person')

    await k.click(k.withText('Archive')!); await k.tick()
    assert.deepEqual(answers, [true])
    assert.ok(!k.bodyText().includes('Archive Scholar Core?'), 'and the question closes')
  })

  it('answers false on Cancel', async () => {
    const { k, answers, ask } = await setup()
    await ask(); await k.tick()
    await k.click(k.withText('Cancel')!); await k.tick()
    assert.deepEqual(answers, [false])
    assert.ok(!k.bodyText().includes('Archive Scholar Core?'), 'and the question closes')
  })

  it('answers false on Escape', async () => {
    const { k, answers, ask } = await setup()
    await ask(); await k.tick()
    await k.press('Escape'); await k.tick()
    assert.deepEqual(answers, [false])
    assert.ok(!k.bodyText().includes('Archive Scholar Core?'), 'and the question closes')
  })

  it('answers a question that is still open with "no" when a second one is asked', async () => {
    const { k, answers, ask } = await setup()
    await ask(); await k.tick()
    await ask(); await k.tick()
    assert.deepEqual(answers, [false], 'the first question was answered no')

    await k.click(k.withText('Archive')!); await k.tick()
    assert.deepEqual(answers, [false, true], 'and the second one can still be answered')
  })

  it('answers "no" when the component goes away with a question open, so nothing waits forever', async () => {
    const { k, answers, ask } = await setup()
    await ask(); await k.tick()
    await k.unmount(); await k.tick()
    assert.deepEqual(answers, [false])
  })
})
