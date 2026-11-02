import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from './dom-test-kit'

/** RecordDrawer on the real Sheet and ConfirmDialog (Radix) in a fake browser. */
async function setup(props: { dirty?: boolean; busy?: boolean; description?: string | null; open?: boolean } = {}) {
  const k = await kit()
  const { RecordDrawer } = await import('../../components/shared/scaffolds/record-drawer')
  let closed = 0

  const element = (over: Record<string, unknown> = {}) => k.h(
    RecordDrawer,
    {
      open: props.open ?? true,
      onClose: () => { closed += 1 },
      title: 'Scholar Core',
      description: props.description === null ? undefined : (props.description ?? 'Edit this sub-product'),
      dirty: props.dirty ?? false,
      busy: props.busy ?? false,
      footer: (requestClose: () => void) => k.h('button', { type: 'button', onClick: requestClose }, 'Cancel form'),
      ...over,
    },
    k.h('input', { id: 'name', defaultValue: 'Scholar Core' }),
  )

  await k.render(element())
  await k.tick()

  const askedToDiscard = () => k.bodyText().includes('Discard your changes?')
  // The three ways in: Escape, the X in the corner, and the Cancel button in the footer.
  const ways: Array<[string, () => Promise<unknown>]> = [
    ['Escape', () => k.press('Escape')],
    ['the X button', () => k.click(k.withText('Close')!)],
    ['the Cancel button in the footer', () => k.click(k.withText('Cancel form')!)],
  ]

  return { k, element, closes: () => closed, askedToDiscard, ways }
}

describe('RecordDrawer', () => {
  afterEach(disposeAll)

  it('shows its title, description, body and footer, and nothing while closed', async () => {
    const { k, element } = await setup()
    assert.ok(k.bodyText().includes('Scholar Core'))
    assert.ok(k.bodyText().includes('Edit this sub-product'))
    assert.ok(k.one('#name'))
    assert.ok(k.withText('Cancel form'))

    await k.render(element({ open: false })); await k.tick()
    assert.ok(!k.bodyText().includes('Scholar Core'))
    assert.equal(k.one('#name'), null)
  })

  it('closes at once, with no question, when nothing was changed', async () => {
    for (const index of [0, 1, 2]) {
      const { k, closes, askedToDiscard, ways } = await setup()
      await ways[index][1](); await k.tick()
      assert.equal(closes(), 1, ways[index][0])
      assert.equal(askedToDiscard(), false, ways[index][0])
      await disposeAll()
    }
  })

  it('asks before closing when there are unsaved changes, whichever way it is closed', async () => {
    for (const index of [0, 1, 2]) {
      const { k, closes, askedToDiscard, ways } = await setup({ dirty: true })
      await ways[index][1](); await k.tick()
      assert.equal(askedToDiscard(), true, ways[index][0])
      assert.equal(closes(), 0, `${ways[index][0]}: nothing is closed until the person answers`)
      await disposeAll()
    }
  })

  it('keeps the drawer open and the form as it was when the person decides to keep editing', async () => {
    const { k, closes, askedToDiscard } = await setup({ dirty: true })
    await k.press('Escape'); await k.tick()
    assert.equal(askedToDiscard(), true)

    await k.click(k.withText('Cancel')!); await k.tick()   // the question's own Cancel: do not discard
    assert.equal(closes(), 0)
    assert.equal(askedToDiscard(), false, 'the question is gone')
    assert.ok(k.one('#name'), 'the form is still there')
  })

  it('closes when the person chooses to discard, exactly once', async () => {
    const { k, closes } = await setup({ dirty: true })
    await k.press('Escape'); await k.tick()
    await k.click(k.withText('Discard changes')!); await k.tick()
    assert.equal(closes(), 1)
  })

  it('cannot be closed at all while a save is running', async () => {
    for (const index of [0, 1, 2]) {
      const { k, closes, askedToDiscard, ways } = await setup({ busy: true, dirty: true })
      await ways[index][1](); await k.tick()
      assert.equal(closes(), 0, ways[index][0])
      assert.equal(askedToDiscard(), false, `${ways[index][0]}: no question either, it simply stays`)
      await disposeAll()
    }
  })

  it('links the description to the dialog only when there is one', async () => {
    const withText = await setup()
    assert.ok(withText.k.one('[role="dialog"]')?.getAttribute('aria-describedby'))
    await disposeAll()

    const without = await setup({ description: null })
    assert.equal(without.k.one('[role="dialog"]')?.hasAttribute('aria-describedby'), false)
  })
})
