import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { adminRows, HR_CAN, hrRows, product, SALES_CAN, shared, sold } from './fixtures'
import { setup, type SetupOptions } from './screen-setup'
import type { Call } from './screen-kit'
import { POINTER_BLOCK, productRemovalPreview, removalPreview, SOLD_BLOCK } from '../portfolio/fixtures'
import type { PmRemovalPreview } from '../../services/product-master/record-types'

/**
 * Delete and Move on the Product Portfolio list (S15 follow-up, contract section 5): a menu on each row, the Product's own menu, and "Move to another Product" in the
 * bar of ticked rows. The real component and the real service client run; only the network is replaced, so the address, method, body and bearer header of every call are
 * what the server would receive.
 */

type Previews = Record<number, PmRemovalPreview | { __status: number; status: 0; message: string }>

/** Answers the delete preview of each id, the delete, the move and the archive; every call is recorded by the kit. */
const world = (previews: Previews = {}, extra?: (call: Call) => unknown): SetupOptions['intercept'] => (call) => {
  const own = extra?.(call)
  if (own !== undefined) return own
  const preview = call.path.match(/\/product-master\/(\d+)\/removal$/)
  if (preview) {
    const id = Number(preview[1])
    const answer = previews[id]
    if (answer && '__status' in answer) return answer
    return { status: 1, data: answer ?? removalPreview({ id, name: `Record ${id}` }) }
  }
  const remove = call.path.match(/\/product-master\/(\d+)\/remove$/)
  if (remove) return { status: 1, data: { removed: [Number(remove[1])] } }
  if (call.path.endsWith('/product-master/move')) {
    const body = call.body as { subProductIds: number[]; toProductId: number }
    return { status: 1, data: { moved: body.subProductIds, unchanged: [], toProductId: body.toProductId } }
  }
  if (call.path.match(/\/product-master\/\d+\/archive$/)) return { status: 1, data: {} }
  return undefined
}

describe('the menu of a row', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  const openRowMenu = async (name: string) => {
    const trigger = current!.k.all('button').find((b) => b.getAttribute('aria-label') === `Actions for ${name}`)
    assert.ok(trigger, `${name} has a menu`)
    await current!.k.act(async () => { trigger.dispatchEvent(new current!.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await current!.k.tick(20)
    return current!.menuItems().map((i) => i.textContent?.trim())
  }
  const hasMenu = (name: string) => current!.k.all('button').some((b) => b.getAttribute('aria-label') === `Actions for ${name}`)

  it('offers a Sub-product Move to another Product and Delete, and an administrator\'s Product Delete product only', async () => {
    current = await setup({ intercept: world() })
    assert.deepEqual(await openRowMenu('Fees Intelligence'), ['Move to another Product', 'Delete'])
    await current.k.press('Escape')
    await current.k.tick(20)
    assert.deepEqual(await openRowMenu('ScholarClone'), ['Delete product'], 'a Product cannot be moved under another')
  })

  it('draws the Product\'s menu for an administrator only, and a Sub-product\'s for whoever may change Sub-products', async () => {
    current = await setup({ rows: adminRows(), can: SALES_CAN, intercept: world() })
    assert.equal(hasMenu('ScholarClone'), false, 'a sales profile is not an administrator')
    assert.equal(hasMenu('Fees Intelligence'), true)
    await disposeAll()
    current.restore()
    current = await setup({ rows: hrRows(), can: { ...HR_CAN, editSubProduct: false }, intercept: world() })
    assert.equal(hasMenu('Fees Intelligence'), false, 'a person who may not change Sub-products has no menu')
  })

  it('draws no menu on a shared record, which is read only', async () => {
    current = await setup({ rows: [product(), sold(), shared()], intercept: world() })
    assert.equal(hasMenu('Enterprise Brain'), false)
    assert.equal(hasMenu('Fees Intelligence'), true)
  })
})

describe('Delete from a row', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  const choose = async (name: string, item: string) => {
    const trigger = current!.k.all('button').find((b) => b.getAttribute('aria-label') === `Actions for ${name}`)!
    await current!.k.act(async () => { trigger.dispatchEvent(new current!.k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await current!.k.tick(20)
    await current!.k.click(current!.menuItems().find((i) => i.textContent?.trim() === item)!)
    await current!.k.tick(40)
  }
  const dialogButton = (label: string) => current!.k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
  const dialogText = () => current!.k.one('[role="dialog"]')?.textContent ?? ''

  it('asks first (reading what it would do), sends nothing on Escape, and the real request on Delete: POST /product-master/{id}/remove with an empty body and the bearer header', async () => {
    current = await setup({ intercept: world() })
    await choose('Fees Intelligence', 'Delete')
    assert.ok(dialogText().includes('Delete Fees Intelligence?'))
    assert.equal(current.to('/product-master/11/removal').length, 1, 'what it would do is read with the record\'s id')
    assert.equal(current.to('/remove').length, 0)
    await current.k.press('Escape', current.k.one('[role="dialog"]')!)
    await current.k.tick(40)
    assert.ok(!current.k.one('[role="dialog"]'), 'it is not there')
    assert.equal(current.to('/remove').length, 0, 'Escape sends nothing')

    await choose('Fees Intelligence', 'Delete')
    const listsBefore = current.to('/product-master/list').length
    await current.k.click(dialogButton('Delete')!)
    await current.k.tick(80)
    const sent = current.to('/product-master/11/remove')
    assert.equal(sent.length, 1)
    assert.equal(sent[0].method, 'POST')
    assert.deepEqual(sent[0].body, {})
    assert.equal(sent[0].headers.Authorization, 'Bearer test-token')
    assert.equal(current.to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.ok(current.text().includes('Deleted Fees Intelligence.'), 'and says what happened')
  })

  it('names what holds a Sub-product and offers Archive instead, which archives it', async () => {
    current = await setup({ intercept: world({ 11: removalPreview({ id: 11, name: 'Fees Intelligence', canDelete: false, blockedBy: [SOLD_BLOCK, POINTER_BLOCK] }) }) })
    await choose('Fees Intelligence', 'Delete')
    assert.ok(dialogText().includes('3 quotes or orders hold it.'))
    assert.ok(dialogText().includes('12 leads and 2 tickets point at it.'))
    assert.ok(!dialogButton('Delete'), 'it is not there')
    await current.k.click(dialogButton('Archive instead')!)
    await current.k.tick(80)
    assert.equal(current.to('/product-master/11/archive').length, 1, 'archived by id')
    assert.equal(current.to('/remove').length, 0, 'nothing deleted')
    assert.ok(current.text().includes('Archived Fees Intelligence.'))
  })

  it('asks a Product each time what happens to its Sub-products, and sends the answer: move them to a Product', async () => {
    current = await setup({ intercept: world({ 1: productRemovalPreview() }) })
    await choose('ScholarClone', 'Delete product')
    assert.ok(dialogText().includes('ScholarClone has 2 sub-products. Choose what happens to them.'))
    assert.equal(dialogButton('Delete product')!.disabled, true, 'no answer yet')
    await current.k.click((current.k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[])[0])
    const select = current.k.one('[role="dialog"] select') as HTMLSelectElement
    await current.k.act(async () => {
      Object.getOwnPropertyDescriptor(current!.k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, '9')
      select.dispatchEvent(new current!.k.w.Event('change', { bubbles: true }))
    })
    await current.k.click(dialogButton('Delete product')!)
    await current.k.tick(80)
    const sent = current.to('/product-master/1/remove')
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0].body, { subProducts: 'move', toProductId: 9 })
  })

  it('and the other answer: delete them together with it', async () => {
    current = await setup({ intercept: world({ 1: productRemovalPreview() }) })
    await choose('ScholarClone', 'Delete product')
    await current.k.click((current.k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[])[1])
    await current.k.click(dialogButton('Delete product')!)
    await current.k.tick(80)
    assert.deepEqual(current.to('/product-master/1/remove')[0].body, { subProducts: 'delete' })
  })

  it('tells a person the read failed and offers no Delete, rather than guessing', async () => {
    current = await setup({ intercept: world({ 11: { __status: 500, status: 0, message: 'The server is busy.' } }) })
    await choose('Fees Intelligence', 'Delete')
    assert.ok(dialogText().includes('The server is busy.'))
    assert.ok(!dialogButton('Delete'), 'it is not there')
    assert.ok(dialogButton('Try again'))
  })
})

describe('Move to another Product from ticked rows', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  const tick = async (name: string) => {
    await current!.k.click(current!.rowOf(name)!.querySelector('input[type="checkbox"]') as HTMLInputElement)
    await current!.k.tick(20)
  }
  const dialogButton = (label: string) => current!.k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined

  it('is in the bar for ticked Sub-products, sold or not, and not before anything is ticked', async () => {
    current = await setup({ intercept: world() })
    assert.ok(!current.button('Move to another Product'), 'nothing ticked: no bar')
    await tick('Scholar School ERP')
    assert.ok(current.button('Move to another Product'), 'a Sub-product that is not sold can be moved')
  })

  it('says Reassign and Delete are for sold Sub-products, and does not draw them, when a ticked one is not sold in CRM', async () => {
    current = await setup({ intercept: world() })
    await tick('Fees Intelligence')
    assert.ok(current.button('Reassign') && current.button('Delete (to the Recycle Bin)'), 'a sold one alone: all three')
    assert.ok(current.button('Move to another Product'))
    await tick('Scholar School ERP')
    assert.ok(!current.button('Reassign'), 'it is not there')
    assert.ok(!current.button('Delete (to the Recycle Bin)'), 'it is not there')
    assert.ok(current.k.one('[role="note"]')!.textContent!.includes('Reassign and Delete are for sub-products that are sold in CRM'))
    assert.ok(current.button('Move to another Product'), 'Move stays')
  })

  it('moves every ticked Sub-product in ONE request: the ids and the Product chosen, then reads the list again, clears the ticks and says what happened', async () => {
    current = await setup({ intercept: world({ 10: removalPreview({ id: 10, targets: [{ id: 2, name: 'G2G' }, { id: 5, name: 'Enterprise Brain' }] }) }) })
    await tick('Scholar School ERP')
    await tick('Fees Intelligence')
    await current.k.click(current.button('Move to another Product')!)
    await current.k.tick(40)
    assert.ok(current.k.one('[role="dialog"]')!.textContent!.includes('Move 2 sub-products to another Product'))
    assert.equal(current.to('/product-master/10/removal').length, 1, 'the Products are the targets read for the first ticked one')
    assert.equal(dialogButton('Move')!.disabled, true, 'no Product chosen')
    const select = current.k.one('[role="dialog"] select') as HTMLSelectElement
    assert.deepEqual(Array.from(select.options).map((o) => o.textContent), ['Choose a Product…', 'G2G', 'Enterprise Brain'])
    await current.k.act(async () => {
      Object.getOwnPropertyDescriptor(current!.k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, '5')
      select.dispatchEvent(new current!.k.w.Event('change', { bubbles: true }))
    })
    const listsBefore = current.to('/product-master/list').length
    await current.k.click(dialogButton('Move')!)
    await current.k.tick(80)
    const sent = current.to('/product-master/move')
    assert.equal(sent.length, 1, 'one request for all of them')
    assert.equal(sent[0].method, 'POST')
    assert.deepEqual(sent[0].body, { subProductIds: [10, 11], toProductId: 5 })
    assert.equal(sent[0].headers.Authorization, 'Bearer test-token')
    assert.equal(current.to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.ok(current.text().includes('Moved 2 sub-products to Enterprise Brain.'))
    await current.k.tick(400)
    assert.equal(current.k.all('tbody input[type="checkbox"]').filter((c) => (c as HTMLInputElement).checked).length, 0, 'the ticks are cleared')
  })

  it('moves nothing when Cancel is pressed or Escape is', async () => {
    current = await setup({ intercept: world() })
    await tick('Fees Intelligence')
    await current.k.click(current.button('Move to another Product')!)
    await current.k.tick(40)
    await current.k.click(dialogButton('Cancel')!)
    await current.k.tick(40)
    assert.ok(!current.k.one('[role="dialog"]'), 'it is not there')
    assert.equal(current.to('/product-master/move').length, 0, 'nothing was moved')
  })

  it('is offered to a person who may change Sub-products but not see prices (HR), who is offered neither Reassign nor Delete', async () => {
    current = await setup({ rows: hrRows(), can: HR_CAN, intercept: world() })
    await tick('Scholar School ERP')
    assert.ok(current.button('Move to another Product'))
    assert.ok(!current.button('Reassign'), 'it is not there')
    assert.ok(!current.button('Delete (to the Recycle Bin)'), 'it is not there')
  })

  it('never ticks a Product, so a Product can never be moved under another', async () => {
    current = await setup({ intercept: world() })
    const group = current.k.all('tbody tr').find((tr) => tr.getAttribute('data-group') === 'p:1')!
    assert.ok(!group.querySelector('input[type="checkbox"]'), 'the Product\'s header has no tick box')
    const all = current.k.one('thead input[type="checkbox"]') as HTMLInputElement
    await current.k.click(all)
    await current.k.tick(20)
    assert.ok(current.button('Move to another Product'))
    const ticked = current.k.all('tbody input[type="checkbox"]').filter((c) => (c as HTMLInputElement).checked).map((c) => c.getAttribute('aria-label'))
    assert.ok(ticked.every((label) => !/^Select (ScholarClone|Enterprise Brain)$/.test(label ?? '')), `ticked: ${ticked.join(', ')}`)
  })
})
