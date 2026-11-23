import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { adminRows, decision, HR_CAN, hrRows, match, matchesData, noMatch, SALES_CAN } from './fixtures'
import { setup, type SetupOptions } from './screen-setup'

/** The pair review (mock-up view 5): an administrator decides each pair; nobody else sees it. */

const merged = (over: Record<string, unknown> = {}) => ({ status: 1, data: { decision: 'same', result: 'merged', merged: true, itemMasterId: 31, survivorMasterId: 10, name: 'Scholar School ERP', ...over } })
const kept = () => ({ status: 1, data: { decision: 'different', result: 'recorded', merged: false, itemMasterId: 31, survivorMasterId: 10 } })

const world = (answer: (body: Record<string, unknown>) => unknown = () => merged()): SetupOptions['intercept'] => (call) => (
  call.path.endsWith('/product-master/matches/decide') ? answer(call.body as Record<string, unknown>) : undefined
)

describe('the banner', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  it('tells an administrator how many products may be the same as sub-products, counting only the ones with a Sub-product to decide about', async () => {
    current = await setup({ matches: matchesData([match(), match({ itemMasterId: 32, verdict: 'EDITION' }), noMatch()]) })
    assert.ok(current.text().includes('2 products may be the same as sub-products.'))
    assert.ok(current.text().includes('Nothing merges until you confirm each pair.'))
    assert.ok(current.button('Review matches'))
  })

  it('says it in the singular for one, and not at all when there is nothing to decide', async () => {
    current = await setup({ matches: matchesData([match()]) })
    assert.ok(current.text().includes('1 product may be the same as a sub-product.'))
    await disposeAll()
    current.restore()
    current = await setup({ matches: matchesData([noMatch()]) })
    assert.ok(!current.text().includes('may be the same'))
    assert.equal(current.button('Review matches'), undefined)
  })

  it('is never drawn for a person who is not an administrator, and the matches are not even asked for', async () => {
    for (const [rows, can] of [[hrRows(), HR_CAN], [adminRows(), SALES_CAN]] as const) {
      current = await setup({ rows: [...rows], can, matches: matchesData([match()]) })
      assert.ok(!current.text().includes('may be the same'), 'no banner')
      assert.equal(current.button('Review matches'), undefined)
      assert.equal(current.to('/product-master/matches').length, 0, 'the server is not asked for suggestions on behalf of somebody who cannot decide')
      await disposeAll()
      current.restore()
    }
    current = null
  })

  it('opens the review in the address (view=matches) from the banner', async () => {
    current = await setup({ matches: matchesData([match()]) })
    await current.k.click(current.button('Review matches')!)
    await current.k.tick(40)
    assert.equal(new URLSearchParams(current.router.lastSearch()).get('view'), 'matches')
    assert.ok(current.text().includes('Possible matches'))
    assert.ok(!current.k.all('table').some((t) => t.textContent?.includes('Readiness')), 'the list is not drawn under the review')
  })
})

describe('the review', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup({ search: 'view=matches', matches: matchesData([match()]), ...opts }); return current }

  it('lists each pair with the name sold in CRM, the Sub-product it looks like, the verdict as the API sends it, the reasons and the two answers', async () => {
    const { rowOf, heads, k } = await open()
    assert.deepEqual(k.all('thead th').map((t) => t.textContent?.trim()), ['Sold in CRM as', 'Looks like this Sub-product', 'Why', 'Name to keep', 'Your decision'])
    void heads
    const row = rowOf('Scholar One ERP - Gujarat Edition')!.textContent!
    for (const part of ['Scholar One ERP - Gujarat Edition', 'SCH-01-GUJ', 'INR 95,000.00', 'Used on 3 records', 'Scholar School ERP', 'SCH-01', 'AMBIGUOUS', 'category “School ERP” is inside the Sub-product name', 'Same product', 'Different']) {
      assert.ok(row.includes(part), `the row shows ${part}: ${row}`)
    }
  })

  it('keeps the Sub-product\'s name by default and offers the name it has in CRM', async () => {
    const { k } = await open()
    const select = k.one('tbody select') as HTMLSelectElement
    assert.equal(select.value, 'portfolio')
    assert.deepEqual(Array.from(select.options).map((o) => o.textContent), ['Sub-product name: Scholar School ERP', 'CRM name: Scholar One ERP - Gujarat Edition'])
  })

  it('asks before "Same product", names both records, and sends nothing on Cancel', async () => {
    const { k, button, to } = await open({ intercept: world() })
    await k.click(button('Same product')!)
    await k.tick(40)
    const dialog = k.one('[role="alertdialog"]')!
    assert.ok(dialog.textContent!.includes('Are these the same product?'))
    assert.ok(dialog.textContent!.includes('Scholar One ERP - Gujarat Edition') && dialog.textContent!.includes('Scholar School ERP'))
    assert.equal(to('/matches/decide').length, 0, 'nothing is sent before the answer')
    await k.click(k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Cancel')!)
    await k.tick(40)
    assert.equal(to('/matches/decide').length, 0, 'Cancel sends nothing')
    assert.ok(button('Same product'), 'the pair is still there to decide')
  })

  it('"Same product" posts the pair with the name to keep, then reads the list and the matches again and says what became of them', async () => {
    const { k, button, to } = await open({ intercept: world() })
    const listsBefore = to('/product-master/list').length
    const matchesBefore = to('/product-master/matches').filter((c) => c.method === 'GET').length
    await k.click(button('Same product')!)
    await k.tick(40)
    await k.click(k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Same product')!)
    await k.tick(100)
    const [call] = to('/matches/decide')
    assert.equal(call.method, 'POST')
    assert.deepEqual(call.body, { itemMasterId: 31, survivorMasterId: 10, decision: 'same', nameKept: 'portfolio' })
    assert.equal(call.headers.Authorization, 'Bearer test-token')
    assert.equal(to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.equal(to('/product-master/matches').filter((c) => c.method === 'GET').length, matchesBefore + 1, 'the suggestions are read again')
    assert.ok(k.bodyText().includes('are now one Sub-product named “Scholar School ERP”.'))
  })

  it('sends nameKept catalogue when the person keeps the name it has in CRM, and the Sub-product the person picked', async () => {
    const two = match({ alternatives: [
      { masterId: 10, offerCode: 'SCH-01', name: 'Scholar School ERP', score: 52 },
      { masterId: 12, offerCode: 'SCH-03', name: 'Scholar Core', score: 44 },
    ] })
    const { k, button, to, setSelect } = await open({ matches: matchesData([two]), intercept: world((b) => merged({ survivorMasterId: b.survivorMasterId, name: 'Scholar One ERP - Gujarat Edition' })) })
    const [survivor, keep] = k.all('tbody select') as HTMLSelectElement[]
    assert.deepEqual(Array.from(survivor.options).map((o) => o.textContent), ['Scholar School ERP (SCH-01)', 'Scholar Core (SCH-03)'])
    await setSelect(survivor, '12')
    await setSelect(keep, 'catalogue')
    await k.click(button('Same product')!)
    await k.tick(40)
    await k.click(k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Same product')!)
    await k.tick(100)
    assert.deepEqual(to('/matches/decide')[0].body, { itemMasterId: 31, survivorMasterId: 12, decision: 'same', nameKept: 'catalogue' })
  })

  it('"Different" posts at once (no question, no name) and says the pair will not be suggested again', async () => {
    const { k, button, to } = await open({ intercept: world(() => kept()) })
    await k.click(button('Different')!)
    await k.tick(100)
    assert.equal(k.all('[role="alertdialog"]').length, 0, 'a refusal needs no confirmation')
    assert.deepEqual(to('/matches/decide')[0].body, { itemMasterId: 31, survivorMasterId: 10, decision: 'different' })
    assert.ok(k.bodyText().includes('Kept apart: “Scholar One ERP - Gujarat Edition” is a different product from “Scholar School ERP”. It will not be suggested again.'))
  })

  it('shows the server\'s own refusal on the pair and keeps the pair, so nothing looks done that was not', async () => {
    const { k, button } = await open({ intercept: world(() => ({ __status: 409, status: 0, message: 'The merge was taken back: the checker found a problem.' })) })
    await k.click(button('Same product')!)
    await k.tick(40)
    await k.click(k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Same product')!)
    await k.tick(100)
    assert.ok(k.all('[role="alert"]').some((a) => a.textContent?.includes('The merge was taken back: the checker found a problem.')))
    assert.ok(button('Different'), 'the pair is still on the screen')
  })

  it('says "already joined" when the API says it already was, and writes nothing more', async () => {
    const { k, button } = await open({ intercept: world(() => merged({ result: 'already_merged', merged: false })) })
    await k.click(button('Same product')!)
    await k.tick(40)
    await k.click(k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Same product')!)
    await k.tick(100)
    assert.ok(k.bodyText().includes('These two were already joined. Nothing changed.'))
  })

  it('lists the decisions already made, in words', async () => {
    const { text } = await open({ matches: matchesData([match()], [decision(), decision({ id: 2, decision: 'same', itemName: 'CCB Fees', survivorName: 'Fees Intelligence' })]) })
    assert.ok(text().includes('Decisions already made (2)'))
    assert.ok(text().includes('Old CCB Fees is a different product from Fees Intelligence'))
    assert.ok(text().includes('CCB Fees and Fees Intelligence are the same product'))
  })

  it('says there is nothing to decide when every suggestion has been answered', async () => {
    const { text } = await open({ matches: matchesData([noMatch()]) })
    assert.ok(text().includes('Nothing to decide'))
  })

  it('goes back to the list from "Back to the list" (view=list leaves the address)', async () => {
    const { k, button, router, text } = await open()
    await k.click(button('Back to the list')!)
    await k.tick(60)
    assert.equal(new URLSearchParams(router.lastSearch()).get('view'), null)
    assert.ok(text().includes('Readiness'), 'the list is back')
  })

  it('shows an error with a Retry when the matches cannot be read', async () => {
    let fail = true
    const { k, button, text, to } = await open({ matches: 'fail', intercept: (call) => (fail || !call.path.endsWith('/matches') ? undefined : { status: 1, data: matchesData([match()]) }) })
    assert.ok(text().includes('The matches could not be loaded'))
    fail = false
    const before = to('/product-master/matches').length
    await k.click(button('Retry')!)
    await k.tick(60)
    assert.equal(to('/product-master/matches').length, before + 1)
    assert.ok(text().includes('Same product'))
  })

  it('says only an administrator can review when somebody else opens the address, and asks for nothing', async () => {
    for (const [rows, can] of [[hrRows(), HR_CAN], [adminRows(), SALES_CAN]] as const) {
      current = await setup({ search: 'view=matches', rows: [...rows], can, matches: matchesData([match()]) })
      assert.ok(current.text().includes('Only an administrator can review matches'))
      assert.equal(current.to('/product-master/matches').length, 0)
      assert.equal(current.button('Same product'), undefined)
      await disposeAll()
      current.restore()
    }
    current = null
  })

  it('has no accessibility violations the markup can show (axe, colour excluded)', async () => {
    const { k } = await open({ matches: matchesData([match(), match({ itemMasterId: 32, name: 'Second', verdict: 'EDITION', alternatives: [{ masterId: 10, offerCode: 'SCH-01', name: 'Scholar School ERP', score: 50 }, { masterId: 12, offerCode: 'SCH-03', name: 'Scholar Core', score: 40 }] })], [decision()]) })
    assert.deepEqual(await axeViolations(k.one('body')!), [])
  })

  it('says every word as Product or Sub-product (never Catalogue, Offer, Item or Product line)', async () => {
    const { text, k, button } = await open({ intercept: world() })
    const forbidden = /\b(catalogue|catalog|offers?|items?|product lines?)\b/i
    // The reasons are the server's sentences; the words around them are this screen's.
    const own = text().replace(/category “School ERP” is inside the Sub-product name|“erp” is in both/g, '')
    assert.ok(!forbidden.test(own), `forbidden word in the review: ${own.match(forbidden)?.[0]}`)
    await k.click(button('Same product')!)
    await k.tick(40)
    assert.ok(!forbidden.test(k.one('[role="alertdialog"]')!.textContent!), 'and in the question')
  })
})
