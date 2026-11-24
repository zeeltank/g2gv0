import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { routerHarness } from '../signals/router-harness'
import { portfolioProducts } from '../signals/opportunity-fixtures'
import { axeViolations } from '../agent/a11y'
import { everything, fullRecord, hrCan, listRow, meta, POINTER_BLOCK, productRemovalPreview, removalPreview, SOLD_BLOCK } from './fixtures'
import { installWorld, press, refusal, type World } from './screen-kit'

/**
 * Delete and Move on the two pages (S15 follow-up, contract section 5): the Sub-product page's "Move to another Product" and "Delete" and the Product page's
 * ask-each-time "Delete product". The services are replaced by fakes that record what the page asks (the real requests are pinned in removal-service.test.ts), so
 * these tests prove what a person sees and which call each answer makes.
 */

const dialog = (k: Awaited<ReturnType<typeof kit>>) => k.one('[role="dialog"]')
const dialogText = (k: Awaited<ReturnType<typeof kit>>) => dialog(k)?.textContent ?? ''
const dialogButton = (k: Awaited<ReturnType<typeof kit>>, label: string) => k.all('[role="dialog"] button').find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined

async function openSubProduct(world: World = {}) {
  const k = await kit()
  const router = await routerHarness('', '/portfolio/products/11')
  const calls = await installWorld(k, { record: fullRecord(), ...world })
  const { SubProductPage } = await import('../../components/domain/portfolio/sub-product-page')
  const backs = { n: 0 }
  await k.render(router.wrap(k.h(SubProductPage, { id: '11', onBack: () => { backs.n += 1 } })))
  await k.tick(80)
  return { k, router, calls, backs }
}

async function openProduct(world: World = {}) {
  const k = await kit()
  const router = await routerHarness('', '/portfolio/scholarclone')
  // A Product of the organisation itself (isolated since 24 Nov: no Product is shared), so its menu offers Delete product.
  const data = everything()
  data.data.products[0] = { ...data.data.products[0], shared: false }
  const calls = await installWorld(k, { listRows: [listRow(), listRow({ id: 12, name: 'Admissions', key: 'scholarclone/sch-12' })], everything: data, ...world })
  const { portfolioService } = await import('../../services/portfolio/portfolio-service')
  Object.assign(portfolioService, { getProducts: async () => portfolioProducts() })
  const { ProductDetailView } = await import('../../components/domain/portfolio/product-detail-view')
  await k.render(router.wrap(k.h(ProductDetailView, { context: { token: 'test-token', subInstituteId: '1', syear: '', userId: '2', organizationId: '', orgType: '', profileId: '1' } as never, productKey: 'scholarclone' })))
  await k.tick(80)
  return { k, router, calls }
}

async function openMenuItem(k: Awaited<ReturnType<typeof kit>>, text: string) {
  const trigger = k.all('button').find((b) => b.getAttribute('aria-label') === 'More actions')
  assert.ok(trigger, 'the page has a More actions menu')
  await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
  await k.tick(20)
  const item = k.all('[role="menuitem"]').find((i) => i.textContent?.trim() === text)
  assert.ok(item, `the menu has "${text}"`)
  await k.click(item)
  await k.tick(40)
}

async function choose(k: Awaited<ReturnType<typeof kit>>, select: HTMLSelectElement, value: string) {
  await k.act(async () => {
    Object.getOwnPropertyDescriptor(k.w.HTMLSelectElement.prototype, 'value')!.set!.call(select, value)
    select.dispatchEvent(new k.w.Event('change', { bubbles: true }))
  })
}

describe('a Sub-product page: Delete', () => {
  afterEach(disposeAll)

  it('has Move to another Product and Delete next to Archive for a person who may change and archive it, and neither for one who may not', async () => {
    const full = await openSubProduct()
    for (const text of ['Archive', 'Move to another Product', 'Delete']) assert.ok(full.k.withText(text), `a ${text} button`)
    await disposeAll()
    const readOnly = await openSubProduct({ meta: meta({}, { editSubProduct: false, archive: false }) })
    assert.ok(!readOnly.k.withText('Delete'), 'it is not there')
    assert.ok(!readOnly.k.withText('Move to another Product'), 'it is not there')
  })

  it('asks before it deletes: reads what the delete would do, names the record, and sends nothing until Delete is pressed', async () => {
    const { k, calls } = await openSubProduct()
    await press(k, 'Delete')
    await k.tick(40)
    assert.ok(dialog(k), 'a dialog opens')
    assert.equal(dialog(k)!.getAttribute('aria-labelledby') !== null && dialog(k)!.getAttribute('aria-describedby') !== null, true, 'it has a title and a description')
    assert.ok(dialogText(k).includes('Delete Fee Collection?'))
    assert.ok(dialogText(k).includes('This cannot be undone'))
    assert.deepEqual(calls.previews, [11], 'what it would do is read with the record\'s id')
    assert.deepEqual(calls.removed, [], 'nothing is sent before the answer')
    await k.click(dialogButton(k, 'Cancel')!)
    await k.tick(30)
    assert.ok(!dialog(k), 'Cancel closes it')
    assert.deepEqual(calls.removed, [], 'and sends nothing')
  })

  it('takes focus into the dialog when it opens, and leaves no dialog behind when it closes', async () => {
    const { k } = await openSubProduct()
    await press(k, 'Delete')
    await k.tick(40)
    assert.ok(dialog(k)!.contains(k.w.document.activeElement), 'focus is inside the dialog')
    await k.click(dialogButton(k, 'Cancel')!)
    await k.tick(40)
    assert.ok(!k.one('[role="dialog"]'), 'and no dialog is left behind')
  })

  it('closes on Escape and sends nothing', async () => {
    const { k, calls } = await openSubProduct()
    await press(k, 'Delete')
    await k.tick(40)
    await k.press('Escape', dialog(k)!)
    await k.tick(40)
    assert.ok(!dialog(k), 'it is not there')
    assert.deepEqual(calls.removed, [])
  })

  it('deletes with an empty body, then goes back to the Portfolio', async () => {
    const { k, calls, backs } = await openSubProduct()
    await press(k, 'Delete')
    await k.tick(40)
    await k.click(dialogButton(k, 'Delete')!)
    await k.tick(40)
    assert.deepEqual(calls.removed, [{ id: 11, body: {} }], 'a Sub-product is deleted with an empty body')
    assert.equal(backs.n, 1, 'the page it was on is gone: back to the Portfolio')
  })

  it('names what holds it in plain sentences, offers Archive instead and Move, and has no Delete button, when the server says it cannot be deleted', async () => {
    const { k, calls } = await openSubProduct({ removal: removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK, POINTER_BLOCK] }) })
    await press(k, 'Delete')
    await k.tick(40)
    const text = dialogText(k)
    assert.ok(text.includes('3 quotes or orders hold it.'), 'the first sentence, as the server wrote it')
    assert.ok(text.includes('12 leads and 2 tickets point at it.'), 'the second')
    assert.ok(text.includes('cannot be deleted yet'))
    assert.ok(!dialogButton(k, 'Delete'), 'there is no Delete button while something holds it')
    assert.ok(dialogButton(k, 'Archive instead'), 'Archive instead')
    assert.ok(dialogButton(k, 'Move to another Product'), 'and Move')
    assert.deepEqual(calls.removed, [])
  })

  it('"Archive instead" archives it at once (the dialog was the question) and deletes nothing', async () => {
    const { k, calls } = await openSubProduct({ removal: removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK] }) })
    await press(k, 'Delete')
    await k.tick(40)
    await k.click(dialogButton(k, 'Archive instead')!)
    await k.tick(60)
    assert.deepEqual(calls.archive, [11], 'archived with the record\'s id')
    assert.ok(!dialogText(k).includes('Archive instead') && dialog(k) === null, 'the dialog is gone and no second question is asked')
    assert.deepEqual(calls.removed, [])
  })

  it('says the read failed, with Try again, and offers no Delete when it cannot tell what depends on the record', async () => {
    const { k, calls } = await openSubProduct({ removalFails: true })
    await press(k, 'Delete')
    await k.tick(40)
    assert.ok(k.one('[role="dialog"] [role="alert"]'), 'an alert')
    assert.ok(dialogText(k).includes('The preview could not be read.'))
    assert.ok(!dialogButton(k, 'Delete'), 'nothing to confirm')
    assert.ok(dialogButton(k, 'Try again'))
    await k.click(dialogButton(k, 'Try again')!)
    await k.tick(40)
    assert.deepEqual(calls.previews, [11, 11], 'Try again reads it again')
  })

  it('shows the server\'s words when the delete is refused, keeps the dialog open, and reads what holds it when the answer is 409', async () => {
    const { k, calls, backs } = await openSubProduct({ removeRefuse: refusal(409, 'Something holds it now.', {}) })
    await press(k, 'Delete')
    await k.tick(40)
    await k.click(dialogButton(k, 'Delete')!)
    await k.tick(60)
    assert.ok(dialogText(k).includes('Something holds it now.'), 'the refusal in the server\'s words')
    assert.equal(backs.n, 0, 'the page is not left')
    assert.deepEqual(calls.previews, [11, 11], 'a 409 means something changed: what holds it is read again')
  })

  it('has no axe violation in its three states (asking, blocked, failed)', async () => {
    const asking = await openSubProduct()
    await press(asking.k, 'Delete')
    await asking.k.tick(40)
    assert.deepEqual(await axeViolations(asking.k.w.document.body), [], 'asking')
    await disposeAll()
    const blocked = await openSubProduct({ removal: removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK] }) })
    await press(blocked.k, 'Delete')
    await blocked.k.tick(40)
    assert.deepEqual(await axeViolations(blocked.k.w.document.body), [], 'blocked')
  })
})

describe('a Sub-product page: Move to another Product', () => {
  afterEach(disposeAll)

  it('opens a dialog with the Products from the removal read (the record\'s own id), and keeps Move disabled until one is chosen', async () => {
    const { k, calls } = await openSubProduct()
    await press(k, 'Move to another Product')
    await k.tick(40)
    assert.deepEqual(calls.previews, [11])
    assert.ok(dialogText(k).includes('Move Fee Collection to another Product'))
    const select = k.one('[role="dialog"] select') as HTMLSelectElement
    assert.deepEqual(Array.from(select.options).map((o) => o.textContent), ['Choose a Product…', 'ScholarClone', 'Enterprise Brain'])
    assert.equal(dialogButton(k, 'Move')!.disabled, true, 'no Product chosen: Move cannot be pressed')
    assert.deepEqual(calls.moved, [])
  })

  it('sends one move with the record and the chosen Product, says what happened, and reads the record again', async () => {
    const { k, calls } = await openSubProduct()
    await press(k, 'Move to another Product')
    await k.tick(40)
    await choose(k, k.one('[role="dialog"] select') as HTMLSelectElement, '7')
    assert.equal(dialogButton(k, 'Move')!.disabled, false)
    await k.click(dialogButton(k, 'Move')!)
    await k.tick(60)
    assert.deepEqual(calls.moved, [{ subProductIds: [11], toProductId: 7 }])
    assert.ok(!dialog(k), 'the dialog closes')
    assert.ok(k.bodyText().includes('Moved 1 sub-product to Enterprise Brain.'), 'the sentence says what happened')
    assert.ok(calls.get.length >= 2, 'the record is read again, so its Product is the new one')
  })

  it('says there is no other Product when the read has none, and has nothing to press', async () => {
    const { k } = await openSubProduct({ removal: removalPreview({ targets: [] }) })
    await press(k, 'Move to another Product')
    await k.tick(40)
    assert.ok(dialogText(k).includes('There is no other Product to move to'))
    assert.equal(dialogButton(k, 'Move')!.disabled, true)
  })

  it('shows the server\'s words when the move is refused and changes nothing on the page', async () => {
    const { k, calls } = await openSubProduct({ moveRefuse: refusal(422, 'That is not a Product of this organisation.', {}) })
    await press(k, 'Move to another Product')
    await k.tick(40)
    await choose(k, k.one('[role="dialog"] select') as HTMLSelectElement, '7')
    await k.click(dialogButton(k, 'Move')!)
    await k.tick(60)
    assert.ok(dialogText(k).includes('That is not a Product of this organisation.'))
    assert.ok(dialog(k), 'the dialog stays open so the person can choose again')
    assert.equal(calls.moved.length, 1)
  })

  it('"Move to another Product" from a blocked Delete opens the Move dialog', async () => {
    const { k } = await openSubProduct({ removal: removalPreview({ canDelete: false, blockedBy: [SOLD_BLOCK] }) })
    await press(k, 'Delete')
    await k.tick(40)
    await k.click(dialogButton(k, 'Move to another Product')!)
    await k.tick(60)
    assert.ok(dialogText(k).includes('Move Fee Collection to another Product'))
  })

  it('has no axe violation', async () => {
    const { k } = await openSubProduct()
    await press(k, 'Move to another Product')
    await k.tick(40)
    assert.deepEqual(await axeViolations(k.w.document.body), [])
  })
})

describe('a Product page: Delete product asks what to do with the Sub-products, each time', () => {
  afterEach(disposeAll)

  it('is in the menu for an administrator and not for anybody else', async () => {
    const admin = await openProduct()
    const items = async (k: Awaited<ReturnType<typeof kit>>) => {
      const trigger = k.all('button').find((b) => b.getAttribute('aria-label') === 'More actions')!
      await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
      await k.tick(20)
      return k.all('[role="menuitem"]').map((i) => i.textContent?.trim())
    }
    assert.ok((await items(admin.k)).includes('Delete product'))
    await disposeAll()
    const other = await openProduct({ meta: meta({}, hrCan) })
    assert.ok(!(await items(other.k)).includes('Delete product'))
  })

  it('lists the Sub-products, offers Move them and Delete them together, and keeps the button disabled until the answer is valid', async () => {
    const { k, calls } = await openProduct({ removal: productRemovalPreview() })
    await openMenuItem(k, 'Delete product')
    assert.ok(dialogText(k).includes('Delete product ScholarClone?'))
    assert.ok(dialogText(k).includes('ScholarClone has 2 sub-products. Choose what happens to them.'))
    assert.deepEqual(calls.previews, [1], 'read with the Product\'s own id')
    for (const name of ['Fee Collection', 'Admissions']) assert.ok(dialogText(k).includes(name), name)
    assert.ok(dialogText(k).includes('Move them to another Product') && dialogText(k).includes('Delete them together with it'))
    assert.equal(dialogButton(k, 'Delete product')!.disabled, true, 'no answer yet')
    const radios = k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[]
    await k.click(radios[0])
    assert.equal(dialogButton(k, 'Delete product')!.disabled, true, 'Move them is chosen but no Product to move to')
    await choose(k, k.one('[role="dialog"] select') as HTMLSelectElement, '9')
    assert.equal(dialogButton(k, 'Delete product')!.disabled, false, 'a Product is chosen')
    assert.deepEqual(calls.removed, [], 'nothing sent yet')
  })

  it('moves the Sub-products first when asked: the body carries the answer and the Product, and the page goes to the list', async () => {
    const { k, calls, router } = await openProduct({ removal: productRemovalPreview() })
    await openMenuItem(k, 'Delete product')
    await k.click((k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[])[0])
    await choose(k, k.one('[role="dialog"] select') as HTMLSelectElement, '9')
    await k.click(dialogButton(k, 'Delete product')!)
    await k.tick(60)
    assert.deepEqual(calls.removed, [{ id: 1, body: { subProducts: 'move', toProductId: 9 } }])
    assert.ok(router.written.includes('/signals/portfolio'), `it goes to the list (wrote ${router.written.join(', ')})`)
  })

  it('deletes the Sub-products together with it when asked, and sends nothing about a Product to move to', async () => {
    const { k, calls, router } = await openProduct({ removal: productRemovalPreview() })
    await openMenuItem(k, 'Delete product')
    await k.click((k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[])[1])
    assert.equal(dialogButton(k, 'Delete product')!.disabled, false, '"Delete them together" needs nothing more')
    await k.click(dialogButton(k, 'Delete product')!)
    await k.tick(60)
    assert.deepEqual(calls.removed, [{ id: 1, body: { subProducts: 'delete' } }])
    assert.ok(router.written.includes('/signals/portfolio'))
  })

  it('marks a Sub-product that is held, rules out "delete them together", and still lets them be moved', async () => {
    const { k } = await openProduct({ removal: productRemovalPreview(true) })
    await openMenuItem(k, 'Delete product')
    const held = k.one('[role="dialog"] [data-sub-product="12"]')!
    assert.ok(held.textContent!.includes('Held'), 'the held Sub-product is marked')
    assert.ok(held.textContent!.includes('3 quotes or orders hold it.'), 'with the sentence that holds it')
    assert.equal(k.one('[role="dialog"] [data-sub-product="11"]')!.textContent!.includes('Held'), false, 'the other is not')
    const radios = k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[]
    assert.equal(radios[1].disabled, true, 'Delete them together with it is not available')
    assert.ok(dialogText(k).includes('Some of them are held and cannot be deleted. Move them instead.'))
    assert.equal(radios[0].disabled, false, 'moving them is')
  })

  it('says what holds the Product itself, with Archive instead, and no way to delete it', async () => {
    const { k, calls } = await openProduct({ removal: productRemovalPreview(false, { canDelete: false, blockedBy: [SOLD_BLOCK] }) })
    await openMenuItem(k, 'Delete product')
    assert.ok(dialogText(k).includes('3 quotes or orders hold it.'))
    assert.ok(!dialogButton(k, 'Delete product'), 'no way to delete it')
    assert.equal(k.all('[role="dialog"] input[type="radio"]').length, 0, 'and no question about its Sub-products')
    await k.click(dialogButton(k, 'Archive instead')!)
    await k.tick(60)
    assert.deepEqual(calls.archive, [1], 'archived')
    assert.deepEqual(calls.removed, [])
  })

  it('asks for nothing about Sub-products when there are none: a plain confirmation with an empty body', async () => {
    const { k, calls } = await openProduct({ removal: productRemovalPreview(false, { subProducts: [] }) })
    await openMenuItem(k, 'Delete product')
    assert.equal(k.all('[role="dialog"] input[type="radio"]').length, 0)
    assert.equal(dialogButton(k, 'Delete product')!.disabled, false)
    await k.click(dialogButton(k, 'Delete product')!)
    await k.tick(60)
    assert.deepEqual(calls.removed, [{ id: 1, body: {} }])
  })

  it('offers no "Move them" when there is no other Product to move them to', async () => {
    const { k } = await openProduct({ removal: productRemovalPreview(false, { targets: [] }) })
    await openMenuItem(k, 'Delete product')
    const radios = k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[]
    assert.equal(radios[0].disabled, true)
    assert.ok(dialogText(k).includes('There is no other Product to move them to.'))
  })

  it('has no axe violation while asking', async () => {
    const { k } = await openProduct({ removal: productRemovalPreview() })
    await openMenuItem(k, 'Delete product')
    await k.click((k.all('[role="dialog"] input[type="radio"]') as HTMLInputElement[])[0])
    assert.deepEqual(await axeViolations(k.w.document.body), [])
  })
})

describe('Bundle: Add a part lists a Sub-product that is not sold, tagged and not choosable (D-7)', () => {
  afterEach(disposeAll)

  it('asks for every Sub-product (scope all), tags the one that is not sold in CRM and the one that is paused, disables them, and keeps a sold one choosable', async () => {
    const { openTab } = await import('./screen-kit')
    const { k, calls } = await openSubProduct({
      bundle: [],
      pickerRows: [
        { crmProductId: 450, masterId: 15, name: 'Barcode scanner', productName: 'ScholarClone', sku: 'BC-1', unitPrice: 80, currency: 'INR', taxRateId: null, type: 'product', sold: true, state: 'sold' },
        { crmProductId: null, masterId: 16, name: 'Admissions Desk', productName: 'ScholarClone', sku: null, unitPrice: null, currency: null, taxRateId: null, type: 'product', sold: false, state: 'not_sold' },
        { crmProductId: 451, masterId: 17, name: 'Old scanner', productName: 'ScholarClone', sku: null, unitPrice: 10, currency: 'INR', taxRateId: null, type: 'product', sold: false, state: 'paused' },
      ],
    })
    await openTab(k, 'Bundle')
    await k.tick(20)
    await press(k, 'Add a part')
    await k.tick(300)
    assert.ok(calls.pickerScopes.length > 0 && calls.pickerScopes.every((scope) => scope === 'all'), `asked for scope all: ${calls.pickerScopes.join(', ')}`)
    const options = Array.from((k.one('[role="dialog"] select') as HTMLSelectElement).options)
    const by = (name: string) => options.find((o) => o.textContent!.includes(name))!
    assert.equal(by('Barcode scanner').disabled, false, 'a sold one can be chosen')
    assert.equal(by('Admissions Desk').disabled, true, 'a Sub-product that is not sold cannot')
    assert.ok(by('Admissions Desk').textContent!.endsWith('- Not sold in CRM'), by('Admissions Desk').textContent!)
    assert.equal(by('Old scanner').disabled, true, 'a paused one cannot')
    assert.ok(by('Old scanner').textContent!.endsWith('- Paused'))
  })
})
