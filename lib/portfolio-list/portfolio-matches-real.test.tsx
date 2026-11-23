import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { axeViolations } from '../agent/a11y'
import { adminRows, decision, HR_CAN, hrRows, SALES_CAN } from './fixtures'
import { REAL_ITEMS, realMatchesData } from './matches-real'
import { setup, type SetupOptions } from './screen-setup'
import type { MatchDecisionRow } from '../../services/product-master/portfolio-list-types'

/**
 * The pair review proved against REAL output (slice 15, track WPC, item 5): the fixture is the dry run of `product-master:unify` for organisation 6 on the dev database
 * (13 Nov 2026), nine live catalogue items with their verdicts, scores, reasons, usage and runner-ups, in the JSON shape of `GET /api/product-master/matches`. The earlier
 * tests of the review use one tidy invented pair; this file runs the screen on what the server really sends: two EDITION pairs that share one Sub-product, two AMBIGUOUS
 * pairs, two services and three entries with nothing to decide. Administrators only; the reasons shown; "Same product" asks first; "Different" is remembered; a decision
 * refreshes the list and the pairs.
 */

const FORBIDDEN = /(?<![\w-])(catalogues?|catalogs?|offers?|items?|product[ -]lines?)(?![\w-])/i

const mergedAnswer = (body: { itemMasterId: number; survivorMasterId: number; nameKept?: string }, name: string) => ({
  status: 1,
  data: {
    decision: 'same', result: 'merged', merged: true, itemMasterId: body.itemMasterId, survivorMasterId: body.survivorMasterId, crmProductId: 63, offerRowId: 101, productId: 1,
    nameKept: body.nameKept ?? 'portfolio', name, decisionId: 1, moved: [], claims: null, audit: null,
  },
})
const keptApartAnswer = (body: { itemMasterId: number; survivorMasterId: number }) => ({
  status: 1, data: { decision: 'different', result: 'recorded', merged: false, itemMasterId: body.itemMasterId, survivorMasterId: body.survivorMasterId, decisionId: 2, audit: null },
})

/** A server that remembers: a pair that was merged or kept apart is gone from the next answer, a "different" answer is listed as a decision. */
function memory() {
  let data = realMatchesData()
  const intercept: NonNullable<SetupOptions['intercept']> = (call) => {
    if (call.path.endsWith('/product-master/matches') && call.method === 'GET') return { status: 1, data }
    if (call.path.endsWith('/product-master/matches/decide')) {
      const body = call.body as { itemMasterId: number; survivorMasterId: number; decision: string; nameKept?: string }
      const rest = data.matches.filter((m) => m.itemMasterId !== body.itemMasterId)
      if (body.decision === 'same') {
        data = realMatchesData({ items: rest, decisions: data.decisions })
        return mergedAnswer(body, body.nameKept === 'catalogue' ? 'Scholar One ERP - Gujarat Edition' : 'Scholar School ERP')
      }
      const row: MatchDecisionRow = decision({
        id: 7, itemMasterId: body.itemMasterId, itemName: 'Scholar LMS & Digital Classroom', survivorMasterId: body.survivorMasterId, survivorName: 'LMS-PAL (AI question generation)', decision: 'different', score: 12, signals: 'name 12',
      })
      data = realMatchesData({ items: rest, decisions: [...data.decisions, row] })
      return keptApartAnswer(body)
    }
    return undefined
  }
  return { intercept }
}

describe('the pair review on the real dry-run output', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: SetupOptions = {}) => { current = await setup({ search: 'view=matches', matches: realMatchesData(), ...opts }); return current }
  const matchRows = () => current!.k.all('tr[data-match]')
  const ids = () => matchRows().map((tr) => tr.getAttribute('data-match'))
  const rowOf = (id: number) => current!.k.one(`tr[data-match="${id}"]`)!
  const inRow = (id: number, label: string) => Array.from(rowOf(id).querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!
  const confirmSame = async () => {
    await current!.k.tick(40)
    await current!.k.click(current!.k.all('[role="alertdialog"] button').find((b) => b.textContent?.trim() === 'Same product')!)
    await current!.k.tick(120)
  }

  it('is the dry run of 13 Nov: nine entries, two EDITION, two AMBIGUOUS, two SERVICE, three NO-MATCH', () => {
    const verdicts = REAL_ITEMS.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.verdict]: (acc[row.verdict] ?? 0) + 1 }), {})
    assert.equal(REAL_ITEMS.length, 9)
    assert.deepEqual(verdicts, { EDITION: 2, AMBIGUOUS: 2, SERVICE: 2, 'NO-MATCH': 3 })
    assert.deepEqual(realMatchesData().counts.byVerdict, { 'MATCH-HIGH': 0, EDITION: 2, AMBIGUOUS: 2, SERVICE: 2, 'NO-MATCH': 3, STRAY: 0, 'JUNK?': 0 })
  })

  it('lists the four pairs that have a Sub-product to decide about, and none of the services or the entries with no match', async () => {
    await open()
    assert.deepEqual(ids(), ['66', '67', '68', '69'])
    assert.ok(!current!.text().includes('Faculty & Staff Certification'), 'a service is not offered as a pair')
    assert.ok(!current!.text().includes('Fleet GPS'), 'an entry with no match is not offered as a pair')
  })

  it('counts those four in the banner on the list (not the nine the server sent)', async () => {
    await open({ search: '' })
    assert.ok(current!.text().includes('4 products may be the same as sub-products.'), current!.text().slice(0, 300))
    assert.ok(current!.button('Review matches'))
  })

  it('shows each entry as the server sent it: its name, SKU, price, how often it is used, and the Sub-product it looks like with its offer id', async () => {
    await open()
    const first = rowOf(66).textContent!
    for (const part of ['Scholar One ERP - Gujarat Edition', 'SCH-01-GUJ', 'INR 1,20,000.00', 'Used on 50 records', 'Scholar School ERP', 'SCH-01']) assert.ok(first.includes(part), `row 66 shows ${part}: ${first}`)
    assert.ok(rowOf(67).textContent!.includes('Used on 3 records'), 'the usage total the server counted is the one shown')
    assert.ok(rowOf(68).textContent!.includes('Fees Intelligence & Decision Support'), 'an ampersand in a name is shown as written')
    assert.ok(rowOf(69).textContent!.includes('LMS-PAL (AI question generation)'))
  })

  it('shows the reasons word for word, the verdict as the API sends it, and its hint', async () => {
    await open()
    for (const reason of REAL_ITEMS[0].reasons) assert.ok(rowOf(66).textContent!.includes(reason), `a reason of the server is missing: ${reason}`)
    for (const [id, verdict, hint] of [[66, 'EDITION', 'Two entries for one Sub-product'], [67, 'EDITION', 'Two entries for one Sub-product'], [68, 'AMBIGUOUS', 'Could be this one or another'], [69, 'AMBIGUOUS', 'Could be this one or another']] as const) {
      assert.ok(rowOf(id).textContent!.includes(verdict), `${id} says ${verdict}`)
      assert.ok(rowOf(id).textContent!.includes(hint), `${id} says: ${hint}`)
    }
    assert.ok(rowOf(68).textContent!.includes('weak: the score is below 55'), 'the weak sentence is shown so the person knows it is a guess')
  })

  it('offers a choice of Sub-product where the server found a runner-up (67, 69) and none where it did not (66, 68)', async () => {
    await open()
    assert.equal(rowOf(66).querySelectorAll('select').length, 1, 'only the name to keep')
    assert.equal(rowOf(68).querySelectorAll('select').length, 1)
    for (const id of [67, 69]) assert.equal(rowOf(id).querySelectorAll('select').length, 2, `${id}: the Sub-product and the name to keep`)
    const choice = rowOf(67).querySelector('select') as HTMLSelectElement
    assert.deepEqual(Array.from(choice.options).map((o) => o.textContent), ['Scholar School ERP (SCH-01)', 'School FTS / Digital Office (SCH-07)'])
  })

  it('"Same product" on an EDITION pair asks first, names both records, then posts the pair; the list and the pairs are read again and the pair leaves the screen', async () => {
    const world = memory()
    await open({ intercept: world.intercept })
    const { k, to } = current!
    const listsBefore = to('/product-master/list').length
    const matchesBefore = to('/product-master/matches').filter((c) => c.method === 'GET').length
    await k.click(inRow(66, 'Same product'))
    await k.tick(40)
    const dialog = k.one('[role="alertdialog"]')!
    assert.ok(dialog.textContent!.includes('Are these the same product?'))
    assert.ok(dialog.textContent!.includes('Scholar One ERP - Gujarat Edition') && dialog.textContent!.includes('Scholar School ERP'), 'both records are named')
    assert.equal(to('/matches/decide').length, 0, 'nothing is sent before the answer')
    await confirmSame()
    const [call] = to('/matches/decide')
    assert.equal(call.method, 'POST')
    assert.deepEqual(call.body, { itemMasterId: 66, survivorMasterId: 46, decision: 'same', nameKept: 'portfolio' })
    assert.equal(call.headers.Authorization, 'Bearer test-token')
    assert.equal(to('/product-master/list').length, listsBefore + 1, 'the list is read again')
    assert.equal(to('/product-master/matches').filter((c) => c.method === 'GET').length, matchesBefore + 1, 'the pairs are read again')
    assert.deepEqual(ids(), ['67', '68', '69'], 'the pair that was decided is gone, the other three stay')
    assert.ok(k.bodyText().includes('“Scholar One ERP - Gujarat Edition” and “Scholar School ERP” are now one Sub-product named “Scholar School ERP”.'))
  })

  it('"Same product" with the Sub-product the person picked among the runner-ups, and the name it has in CRM, posts exactly that', async () => {
    const world = memory()
    await open({ intercept: world.intercept })
    const { k, to, setSelect } = current!
    const [survivor, keep] = Array.from(rowOf(67).querySelectorAll('select')) as HTMLSelectElement[]
    await setSelect(survivor, '52')
    await setSelect(keep, 'catalogue')
    await k.click(inRow(67, 'Same product'))
    await confirmSame()
    assert.deepEqual(to('/matches/decide')[0].body, { itemMasterId: 67, survivorMasterId: 52, decision: 'same', nameKept: 'catalogue' })
    assert.deepEqual(ids(), ['66', '68', '69'])
  })

  it('"Different" posts at once with no name and no question, and the pair does not come back; the decision is listed in words', async () => {
    const world = memory()
    await open({ intercept: world.intercept })
    const { k, to, text } = current!
    await k.click(inRow(69, 'Different'))
    await k.tick(120)
    assert.equal(k.all('[role="alertdialog"]').length, 0, 'a refusal needs no confirmation')
    assert.deepEqual(to('/matches/decide')[0].body, { itemMasterId: 69, survivorMasterId: 48, decision: 'different' })
    assert.deepEqual(ids(), ['66', '67', '68'], 'the pair stays apart: it is not offered again')
    assert.ok(text().includes('Kept apart: “Scholar LMS & Digital Classroom” is a different product from “LMS-PAL (AI question generation)”. It will not be suggested again.'))
    assert.ok(text().includes('Decisions already made (1)'))
    assert.ok(text().includes('Scholar LMS & Digital Classroom is a different product from LMS-PAL (AI question generation)'))
  })

  it('shows the server\'s refusal on the pair that was refused and keeps every pair on the screen', async () => {
    await open({ intercept: (call) => (call.path.endsWith('/matches/decide') ? { __status: 409, status: 0, message: 'The merge was taken back: the checker found a problem.' } : undefined) })
    await current!.k.click(inRow(66, 'Same product'))
    await confirmSame()
    assert.ok(Array.from(rowOf(66).querySelectorAll('[role="alert"]')).some((a) => a.textContent?.includes('The merge was taken back')), 'the refusal is on the row it belongs to')
    assert.deepEqual(ids(), ['66', '67', '68', '69'], 'nothing looks done that was not')
  })

  it('is for administrators only: a seller and HR get no banner, no review and no request for the pairs', async () => {
    for (const [rows, can] of [[hrRows(), HR_CAN], [adminRows(), SALES_CAN]] as const) {
      current = await setup({ rows: [...rows], can, matches: realMatchesData() })
      assert.ok(!current.text().includes('may be the same'), 'no banner')
      await disposeAll()
      current.restore()
      current = await setup({ search: 'view=matches', rows: [...rows], can, matches: realMatchesData() })
      assert.ok(current.text().includes('Only an administrator can review matches'))
      assert.equal(current.to('/product-master/matches').length, 0, 'the pairs are not even asked for')
      assert.ok(current.button('Same product') === undefined, 'no decision button')
      await disposeAll()
      current.restore()
    }
    current = null
  })

  it('has no accessibility violation the markup can show (axe, colour excluded) with the real pairs', async () => {
    await open()
    assert.deepEqual(await axeViolations(current!.k.one('body')!), [])
  })
})

describe('the words of the pair review on the real output', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })

  /** The sentences the SERVER wrote that carry a retired word. */
  const serverSentences = () => REAL_ITEMS.flatMap((row) => row.reasons).filter((reason) => FORBIDDEN.test(reason))

  it('puts no retired word on the screen of its own (every word around the server\'s sentences is Product or Sub-product)', async () => {
    current = await setup({ search: 'view=matches', matches: realMatchesData() })
    let own = current.text()
    for (const sentence of serverSentences()) own = own.split(sentence).join(' ')
    for (const row of REAL_ITEMS) for (const reason of row.reasons) own = own.split(reason).join(' ')
    assert.ok(!FORBIDDEN.test(own), `a retired word is on the screen: ${own.match(FORBIDDEN)?.[0]}`)
    await current.k.click(Array.from(current.k.all('tr[data-match="66"] button')).find((b) => b.textContent?.trim() === 'Same product')!)
    await current.k.tick(40)
    assert.ok(!FORBIDDEN.test(current.k.one('[role="alertdialog"]')!.textContent!), 'and none in the question')
  })

  it('KNOWN DEFECT, backend (ProductMatchSuggester.php:469 and :714): three server sentences carry a retired word the screen shows as written: "offer id" once and "item(s)" twice', () => {
    const found = serverSentences()
    assert.equal(found.length, 3, 'exactly these three; when the backend says Sub-product and other product(s) this becomes 0: change the expectation then')
    assert.equal(found.filter((sentence) => /^the SKU .+ holds the offer id /.test(sentence)).length, 1, 'the SKU sentence of the first pair says offer id')
    assert.equal(found.filter((sentence) => /^item\(s\) \d+ ".+" have the same best Sub-product/.test(sentence)).length, 2, 'the two EDITION sentences say item(s)')
  })
})
