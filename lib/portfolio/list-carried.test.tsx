import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { aboutOnly, envelope, product, shared } from '../portfolio-list/fixtures'
import { ICP_WORD, icpTone } from '../portfolio-list/model'
import { setup } from '../portfolio-list/screen-setup'

/**
 * What the old Product lines list and the old Catalogue list pinned, and the Product Portfolio list carries but no other test names (slice 15, track WPD; every
 * row is in `Docs/agentic-crm/_evidence/s15/wpd-test-map-2026-11-23.md`). The list itself belongs to the list track, so these tests live in a file of their own and
 * only read what that track's kit shows: a real zero is not a dash, an archived or shared record says so, and a slow old answer never replaces a newer one.
 */

describe('the Product Portfolio list: what the old lists pinned', () => {
  let current: Awaited<ReturnType<typeof setup>> | null = null
  afterEach(async () => { current?.restore(); current = null; await disposeAll() })
  const open = async (opts: Parameters<typeof setup>[0] = {}) => { current = await setup(opts); return current }

  it('draws a real zero of signals as 0 and a missing count as a dash', async () => {
    const { rowOf, heads } = await open({ rows: [product(), aboutOnly({ id: 30, name: 'Zero Fees', key: 'scholarclone/sch-30', signalsFound: 0, icp: 'active' }), aboutOnly({ id: 31, name: 'Unknown Fees', key: 'scholarclone/sch-31', signalsFound: null, icp: null })] })
    const signals = heads().indexOf('Signals')
    const icp = heads().indexOf('ICP')
    assert.ok(signals > 0 && icp > 0, `the columns are there: ${heads().join(', ')}`)
    const cell = (name: string, at: number) => rowOf(name)!.querySelectorAll('td')[at].textContent?.trim()
    assert.equal(cell('Zero Fees', signals), '0', 'a count of zero is a count')
    assert.equal(cell('Unknown Fees', signals), '—', 'a count nobody made is a dash')
    assert.equal(cell('Zero Fees', icp), 'In use', 'an active profile is said in words')
    assert.equal(cell('Unknown Fees', icp), 'Not applicable', 'no ideal-customer profile applies')
  })

  it('marks an archived Sub-product, an archived Product and a shared Product', async () => {
    const { rowOf, k } = await open({
      rows: [
        product({ id: 3, name: 'Retired Suite', key: 'retired', status: 'archived', subProductCount: 1 }),
        aboutOnly({ id: 32, name: 'Old Gateway', key: 'retired/gw', productId: 3, productName: 'Retired Suite', status: 'archived' }),
        shared(),
        aboutOnly({ id: 33, name: 'Live Gateway', key: 'scholarclone/gw', productId: 1, productName: 'ScholarClone' }),
      ],
    })
    assert.ok(rowOf('Retired Suite')!.textContent!.includes('Archived'), 'an archived Product says so on its header')
    assert.ok(rowOf('Old Gateway')!.textContent!.includes('Archived'), 'an archived Sub-product says so on its row')
    assert.ok(!rowOf('Live Gateway')!.textContent!.includes('Archived'), 'a live one does not')
    assert.ok(rowOf('Enterprise Brain')!.textContent!.includes('Shared, read only'), 'a built-in Product says it is shared and read only')
    assert.equal(k.all('button').filter((b) => b.getAttribute('aria-label') === 'Add a sub-product to Retired Suite').length, 0, 'an archived Product gets no Add sub-product')
    assert.equal(k.all('button').filter((b) => b.getAttribute('aria-label') === 'Add a sub-product to Enterprise Brain').length, 0, 'a shared Product gets none')
  })

  it('shows the answer to the newest search, not a slower answer to an older one', async () => {
    let releaseFirst: (answer: unknown) => void = () => {}
    const first = new Promise((resolve) => { releaseFirst = resolve })
    const { k, rowOf, text } = await open({
      list: (query) => (query.get('q') ? envelope([aboutOnly({ id: 40, name: 'Fees Desk', key: 'scholarclone/sch-40', productId: 1, productName: 'ScholarClone' })]) : first),
    })
    const box = k.all('input').find((i) => i.getAttribute('aria-label') === 'Search the portfolio') as HTMLInputElement
    const set = Object.getOwnPropertyDescriptor(k.w.HTMLInputElement.prototype, 'value')!.set!
    await k.act(async () => { set.call(box, 'fees'); box.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
    await k.tick(500)
    assert.ok(rowOf('Fees Desk'), 'the newest search is answered')
    await k.act(async () => { releaseFirst(envelope([product(), aboutOnly({ id: 10, name: 'Scholar School ERP' })])) })
    await k.tick(60)
    assert.ok(rowOf('Fees Desk'), 'the late answer for the first, unfiltered request did not replace it')
    assert.ok(!text().includes('Scholar School ERP'), 'and none of its rows appeared')
  })

  it('gives every ideal-customer state of the list its own word and tone', () => {
    assert.deepEqual(ICP_WORD, { active: 'In use', draft: 'Draft', archived: 'Archived', template: 'Built in', none: 'None yet' })
    const tones = (['active', 'draft', 'archived', 'template', 'none'] as const).map(icpTone)
    assert.deepEqual(tones, ['success', 'pending', 'inactive', 'primary', 'default'], 'in use is good, a draft pending, archived quiet, built-in informational, none plain')
  })
})
