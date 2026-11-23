import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll, kit } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { SEARCH_DEBOUNCE_MS, type PickedSubProduct } from './model'
import { forgetResolved } from './resolver'
import { box, installApi, openPicker, optionById, optionNames, pick, searchBox, typeInto, type ApiOptions, type Kit } from './harness'

/**
 * The shared Sub-product picker as a person meets it: a fake browser, the REAL service building the REAL requests, and a fake server behind `fetch`. What is
 * proved here is what every consumer inherits: one request after a pause in typing, an older answer never replacing a newer one, the catalogue id and the price
 * fields handed back, a value the list no longer offers shown by name, the states, the keyboard, and no price for a person who is not sent one.
 */
const pause = SEARCH_DEBOUNCE_MS + 60

interface Props { initial?: string | null; type?: 'product' | 'service'; excluded?: ReadonlySet<string>; clearable?: boolean; label?: string; id?: string }

async function open(opts: ApiOptions = {}, props: Props = {}) {
  forgetResolved()
  const k = await kit()
  const api = installApi(k, opts)
  const { SubProductPicker } = await import('../../components/domain/portfolio/product-picker')
  const picked: Array<PickedSubProduct | null> = []
  function Harness() {
    const [value, setValue] = k.React.useState<string | null>(props.initial ?? null)
    return k.h(SubProductPicker, {
      value, type: props.type, excluded: props.excluded, clearable: props.clearable, id: props.id,
      'aria-label': props.label ?? 'Sub-product for line 1',
      onChange: (p: PickedSubProduct | null) => { picked.push(p); setValue(p ? p.productId : null) },
    })
  }
  await k.render(k.h(Harness))
  await k.tick(30)
  return { k, api, picked }
}

const text = (k: Kit) => k.one('[data-picker-popover]')?.textContent ?? ''
const triggerText = (k: Kit) => box(k)!.querySelector('[data-picker-value]')!.textContent

describe('the Sub-product picker: what it offers', () => {
  afterEach(disposeAll)

  it('opens on one request with no text, 20 rows at most, and lists only what is sold, grouped by Product with the unplaced last', async () => {
    const { k, api } = await open()
    assert.equal(api.searches().length, 0, 'nothing is asked until the box is opened')
    await openPicker(k)
    assert.equal(api.searches().length, 1, 'one request on opening')
    assert.equal(api.searches()[0].query.get('limit'), '20')
    assert.equal(api.searches()[0].query.has('q'), false)
    assert.deepEqual(optionNames(k), ['LMS Basic', 'Implementation Support', 'Scholar Nine', 'Scholar School ERP', 'Loose Add-on'], 'Product first, then name, the unplaced last; paused and binned are not offered')
    const headings = k.all('[role="group"] > [role="presentation"]').map((h) => h.textContent)
    assert.deepEqual(headings, ['LMS-PAL', 'ScholarClone', 'No Product yet'], 'grouped by the Product above the Sub-product')
  })

  it('shows the SKU and the price with its currency under each name, and the catalogue id on the row', async () => {
    const { k } = await open()
    await openPicker(k)
    const nine = optionById(k, 10)!
    assert.equal(nine.querySelector('[data-picker-sku]')!.textContent, 'SCH-09-SKU')
    assert.match(nine.querySelector('[data-picker-price]')!.textContent ?? '', /^INR 999\.00$/)
    assert.equal(optionById(k, 14)!.querySelector('[data-picker-sku]'), null, 'a Sub-product with no SKU shows no empty line')
  })

  it('asks for one type only when the form says so, and sends it', async () => {
    const { k, api } = await open({}, { type: 'service' })
    await openPicker(k)
    assert.equal(api.searches()[0].query.get('type'), 'service')
    assert.deepEqual(optionNames(k), ['Implementation Support'])
  })

  it('does not offer a catalogue id the form already holds, and asks for room for the rows it hides', async () => {
    const { k, api } = await open({}, { excluded: new Set(['10', '11']) })
    await openPicker(k)
    assert.equal(optionById(k, 10), null)
    assert.equal(optionById(k, 11), null)
    assert.equal(api.searches()[0].query.get('limit'), '22', '20 and one for each row the form hides')
    assert.ok(optionById(k, 13), 'the others are still offered')
  })

  it('sends the person\'s token as a bearer header on the search', async () => {
    const { k, api } = await open()
    await openPicker(k)
    assert.equal(api.searches()[0].headers.Authorization, 'Bearer test-token')
  })
})

describe('the Sub-product picker: typing', () => {
  afterEach(disposeAll)

  it('sends ONE request after the pause, not one per letter', async () => {
    const { k, api } = await open()
    await openPicker(k)
    await typeInto(k, searchBox(k)!, 'nine', 20)
    assert.equal(api.searches().length, 1, 'still only the opening request while the letters are going in')
    await k.tick(pause)
    assert.deepEqual(api.searchTexts(), ['', 'nine'], 'one search for the whole word')
    assert.deepEqual(optionNames(k), ['Scholar Nine'])
  })

  it('treats white space around the text as nothing and does not search again for the same text', async () => {
    const { k, api } = await open()
    await openPicker(k)
    await typeInto(k, searchBox(k)!, '  ', 10)
    await k.tick(pause)
    assert.equal(api.searches().length, 1, 'blank text is the opening list, which is already shown')
  })

  it('never lets a slow answer to an older text replace the list for the newer one', async () => {
    const { k, api } = await open({ pickerDelay: (q) => (q === 'lms' ? 700 : 0) })
    await openPicker(k)
    await typeInto(k, searchBox(k)!, 'lms')
    await k.tick(pause)
    assert.deepEqual(api.searchTexts(), ['', 'lms'], 'the slow search is on its way')
    await typeInto(k, searchBox(k)!, 'nine')
    await k.tick(pause)
    assert.deepEqual(optionNames(k), ['Scholar Nine'], 'the newer text is shown')
    await k.tick(800)
    assert.deepEqual(optionNames(k), ['Scholar Nine'], 'the older answer arrived later and was ignored')
  })

  it('never lets a slow FAILURE of an older text replace the list for the newer one', async () => {
    const { k, api } = await open({ pickerDelay: (q) => (q === 'lms' ? 700 : 0), pickerFails: (q) => q === 'lms' })
    await openPicker(k)
    await typeInto(k, searchBox(k)!, 'lms')
    await k.tick(pause)
    assert.deepEqual(api.searchTexts(), ['', 'lms'], 'the slow, failing search is on its way')
    await typeInto(k, searchBox(k)!, 'nine')
    await k.tick(pause)
    assert.deepEqual(optionNames(k), ['Scholar Nine'], 'the newer text is shown')
    await k.tick(800)
    assert.deepEqual(optionNames(k), ['Scholar Nine'], 'the older failure arrived later and was ignored')
    assert.ok(k.one('[data-picker-failure]') === null, 'no failure notice for a search the person has moved on from')
  })

  it('says so when nothing is sold that matches', async () => {
    const { k } = await open()
    await openPicker(k)
    await typeInto(k, searchBox(k)!, 'zzz')
    await k.tick(pause)
    assert.ok(text(k).includes('No sold sub-product matches'), text(k))
    assert.equal(k.one('[role="listbox"]'), null, 'no empty listbox for a screen reader')
  })

  it('says the list is cut at its limit, so a missing row is not read as a missing record', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ crmProductId: 100 + i, masterId: 200 + i, name: `Item ${String(i).padStart(2, '0')}`, productName: 'Big', sku: null, unitPrice: 1, currency: 'INR', taxRateId: null, type: 'product' as const, state: 'sold' as const }))
    const { k } = await open({ catalogue: many })
    await openPicker(k)
    assert.equal(optionNames(k).length, 20)
    assert.ok(k.one('[data-picker-cut]')?.textContent?.includes('first 20'), 'the cut is named')
  })
})

describe('the Sub-product picker: what it hands back', () => {
  afterEach(disposeAll)

  it('returns the CATALOGUE id as text with the price, the currency, the default tax rate and the name, and closes', async () => {
    const { k, picked } = await open()
    await pick(k, 10)
    assert.equal(picked.length, 1)
    assert.equal(picked[0]!.productId, '10', 'the catalogue id, as a string like the old picker\'s')
    assert.equal(picked[0]!.crmProductId, 10)
    assert.equal(picked[0]!.masterId, 23)
    assert.equal(picked[0]!.name, 'Scholar Nine')
    assert.equal(picked[0]!.unitPrice, 999)
    assert.equal(picked[0]!.currency, 'INR')
    assert.equal(picked[0]!.taxRateId, '4')
    assert.equal(k.one('[data-picker-popover]'), null, 'the list closes')
    assert.equal(triggerText(k), 'Scholar Nine', 'the box shows the choice')
    assert.equal(box(k)!.getAttribute('title'), 'ScholarClone › Scholar Nine', 'Product › Sub-product on hover')
  })

  it('has no price to hand back for a person the server sent none to, and draws none in the list', async () => {
    const { k, picked } = await open({ hidePrices: true })
    await openPicker(k)
    assert.equal(k.all('[data-picker-price]').length, 0, 'no price is drawn')
    assert.equal(text(k).includes('0.00'), false, 'and no invented zero')
    await k.click(optionById(k, 10)!)
    assert.equal(picked[0]!.unitPrice, null, 'the form is handed null, not zero')
  })

  it('clears the value when the form allows it', async () => {
    const { k, picked } = await open({}, { initial: '10', clearable: true })
    await k.tick(20)
    await openPicker(k)
    await k.click(k.one('[data-picker-clear]')!)
    assert.equal(picked[picked.length - 1], null)
    assert.equal(triggerText(k), 'Pick a Sub-product')
  })
})

describe('the Sub-product picker: a value the document already holds', () => {
  afterEach(disposeAll)

  it('shows a paused Sub-product by name with the word Paused, though the list does not offer it', async () => {
    const { k } = await open({}, { initial: '15' })
    await k.tick(30)
    assert.equal(triggerText(k), 'Old Gujarat Edition')
    assert.equal(k.one('[data-picker-state]')!.textContent, 'Paused')
    await openPicker(k)
    assert.equal(optionById(k, 15), null, 'it is not offered for a new line')
  })

  it('shows a Sub-product in the Recycle Bin by name with the words Not sold', async () => {
    const { k } = await open({}, { initial: '16' })
    await k.tick(30)
    assert.equal(triggerText(k), 'Retired Pack')
    assert.equal(k.one('[data-picker-state]')!.textContent, 'Not sold')
  })

  it('shows a Sub-product that is offered by name too, and asks for its name once, not once per picker', async () => {
    const { k, api } = await open({}, { initial: '11' })
    await k.tick(30)
    assert.equal(triggerText(k), 'Scholar School ERP')
    assert.equal(api.to('/by-crm/11').length, 1)
    assert.equal(api.to('/product-master/24').length, 1)
  })

  it('never shows an id that cannot be read as a blank box: it says which Sub-product', async () => {
    const { k } = await open({}, { initial: '999' })
    await k.tick(30)
    assert.equal(triggerText(k), 'Sub-product 999')
  })

  it('names the box for a screen reader with its label and its value, and gives a label\'s `for` something to point at', async () => {
    const { k } = await open({}, { initial: '10', id: 'line-1' })
    await k.tick(30)
    const labelled = box(k)!.getAttribute('aria-labelledby')!.split(' ').map((id) => k.w.document.getElementById(id)?.textContent).join(' | ')
    assert.equal(labelled, 'Sub-product for line 1 | Scholar Nine')
    assert.equal(box(k)!.id, 'line-1')
  })
})

describe('the Sub-product picker: failures', () => {
  afterEach(disposeAll)

  it('says it could not load, offers Retry, and shows the list after a second try', async () => {
    let failing = true
    const { k, api } = await open({ pickerFails: () => failing })
    await openPicker(k)
    assert.equal(k.one('[data-picker-failure]')!.getAttribute('data-picker-failure'), 'error')
    assert.ok(text(k).includes('could not be loaded'), text(k))
    failing = false
    await k.click(k.withText('Retry')!)
    await k.tick(30)
    assert.equal(api.searches().length, 2)
    assert.equal(k.one('[data-picker-failure]'), null)
    assert.ok(optionById(k, 10), 'the rows are there')
  })

  it('says a person without the right may not choose here, and offers no Retry that could not help', async () => {
    const { k } = await open({ pickerForbidden: true })
    await openPicker(k)
    assert.equal(k.one('[data-picker-failure]')!.getAttribute('data-picker-failure'), 'forbidden')
    assert.equal(k.withText('Retry'), null)
  })
})

describe('the Sub-product picker: keyboard and roles', () => {
  afterEach(disposeAll)

  it('opens with the arrow key, moves with the arrows, chooses with Enter and gives the focus back to the box', async () => {
    const { k, picked } = await open()
    box(k)!.focus()
    await k.press('ArrowDown', box(k)!)
    await k.tick(30)
    assert.ok(k.one('[data-picker-popover]'), 'ArrowDown opens the list')
    const input = searchBox(k)!
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('option-0'), true, 'the first row is highlighted')
    await k.press('ArrowDown', input)
    await k.press('ArrowDown', input)
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('option-2'), true, 'two arrows down')
    await k.press('ArrowUp', input)
    assert.equal(input.getAttribute('aria-activedescendant')?.endsWith('option-1'), true)
    await k.press('Enter', input)
    assert.equal(picked[0]!.name, 'Implementation Support', 'the second row: after LMS Basic')
    assert.equal(k.w.document.activeElement, box(k), 'the focus is back on the box')
  })

  it('closes on Escape without choosing, and puts the focus back', async () => {
    const { k, picked } = await open()
    await openPicker(k)
    await k.press('Escape', searchBox(k)!)
    assert.equal(k.one('[data-picker-popover]'), null)
    assert.equal(picked.length, 0)
    assert.equal(k.w.document.activeElement, box(k))
  })

  it('has the roles a screen reader needs: a button that opens a listbox, a combobox input, a listbox of options in groups', async () => {
    const { k } = await open()
    await openPicker(k)
    assert.equal(box(k)!.getAttribute('aria-haspopup'), 'listbox')
    assert.equal(box(k)!.getAttribute('aria-expanded'), 'true')
    assert.equal(searchBox(k)!.getAttribute('role'), 'combobox')
    const list = k.one('[role="listbox"]')!
    assert.equal(searchBox(k)!.getAttribute('aria-controls'), list.id)
    assert.equal(k.all('[role="option"]').length, 5)
    assert.equal(k.all('[role="listbox"] > [role="group"]').length, 3, 'one group per Product')
  })

  it('has no axe violation open, empty, failing or closed', async () => {
    const closed = await open({}, { initial: '10' })
    await closed.k.tick(30)
    assert.deepEqual(await axeViolations(closed.k.w.document.body), [], 'closed')
    await openPicker(closed.k)
    assert.deepEqual(await axeViolations(closed.k.w.document.body), [], 'open with rows')
    await typeInto(closed.k, searchBox(closed.k)!, 'zzz')
    await closed.k.tick(pause)
    assert.deepEqual(await axeViolations(closed.k.w.document.body), [], 'open and empty')
    await disposeAll()
    const failing = await open({ pickerFails: () => true })
    await openPicker(failing.k)
    assert.deepEqual(await axeViolations(failing.k.w.document.body), [], 'open and failing')
  })
})
