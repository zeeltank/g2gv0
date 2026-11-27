import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import { fakeShare, fakeToken, kitItem, scholarcloneItems, VIEW_ONLY } from '../../services/product-master/kit-fake-service'
import { openKit, PRODUCT_ID } from './sales-kit-screen-kit'

/**
 * The public link of an entry, in a fake browser: a manager makes it (and chooses how long it works), copies it, renews it and stops it, each of the last two after a question; a person who may only
 * look can copy a live link and is offered nothing else; a page inside the app has no Share link at all; and a card says Shared.
 */

let open: Awaited<ReturnType<typeof openKit>> | null = null
async function shelf(...args: Parameters<typeof openKit>) {
  open = await openKit(...args)
  return open
}
afterEach(async () => {
  open?.restore()
  open = null
  Reflect.deleteProperty(globalThis.navigator as object, 'clipboard')
  await disposeAll()
})

const PDF = 'Fee collection one-pager'
const sharedPdf = (over = {}) => scholarcloneItems().map((item) => (item.id === 3 ? { ...item, share: fakeShare(7, 30), ...over } : item))
const internalPage = () => kitItem({ id: 50, kind: 'document', title: 'Course page', source: 'link', documentId: null, fileName: null, mimeType: null, size: null, url: '/module/lms/learning/courses/7' })
const webPage = () => kitItem({ id: 51, kind: 'video', title: 'Customer video', source: 'link', documentId: null, fileName: null, mimeType: null, size: null, url: 'https://example.com/video' })

type Shelf = Awaited<ReturnType<typeof shelf>>
async function openShare(s: Shelf, title = PDF) {
  await s.openMenu(`More actions for ${title}`)
  await s.press(s.menuItem('Share link'))
  return s.dialog()!
}
const linkField = (s: Shelf, form: Element) => s.field('Public link', form) as HTMLInputElement | null
async function pick(s: Shelf, select: HTMLSelectElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(s.k.w.HTMLSelectElement.prototype, 'value')!.set!
  await s.k.act(async () => { set.call(select, value); select.dispatchEvent(new s.k.w.Event('change', { bubbles: true })) })
}
function stubClipboard(s: Shelf, behaviour: 'works' | 'refuses') {
  const written: string[] = []
  Object.defineProperty(s.k.w.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => { if (behaviour === 'refuses') throw new Error('blocked'); written.push(text) } },
  })
  return written
}

describe('a manager makes a link', () => {
  it('is told that anyone with the link can open it, and offers how long it works, starting on No expiry, then Create link', async () => {
    const s = await shelf()
    const form = await openShare(s)
    assert.equal(form.querySelector('h2')?.textContent, 'Share link')
    says(form.textContent, 'Anyone with the link can open this without signing in.')
    const days = s.field('Link works for', form) as HTMLSelectElement
    assert.deepEqual(Array.from(days.options).map((o) => o.textContent), ['7 days', '30 days', '90 days', '1 year', 'No expiry'])
    assert.equal(days.value, '0')
    says(form.textContent, 'No expiry: the link works until you stop sharing it or create a new one.')
    absent(linkField(s, form), 'there is no link yet')
    assert.ok(s.button('Create link', form))
    absent(s.button('Stop sharing', form), 'nothing to stop')
  })

  it('creates a link that does not expire, shows it in a read-only box with the address of this site, says so, and the card says Shared', async () => {
    const s = await shelf()
    const form = await openShare(s)
    await s.press(s.button('Create link', form), 60)
    assert.deepEqual(s.calls.share, [{ productId: PRODUCT_ID, itemId: 3, days: 0 }])
    const box = linkField(s, form)!
    assert.equal(box.value, `http://localhost/share/kit/${fakeToken(1)}`)
    assert.equal(box.readOnly, true)
    says(form.textContent, 'Link created.')
    says(form.textContent, 'Never expires')
    assert.deepEqual(['Copy link', 'Create a new link', 'Stop sharing'].map((label) => Boolean(s.button(label, form))), [true, true, true])
    absent(s.button('Create link', form), 'it is made now')
    says(s.entry(PDF)!.textContent, 'Shared')
  })

  it('sends the length that was chosen: 1 year and no expiry', async () => {
    const s = await shelf()
    let form = await openShare(s)
    await pick(s, s.field('Link works for', form) as HTMLSelectElement, '365')
    await s.press(s.button('Create link', form), 60)
    assert.equal(s.calls.share[0].days, 365)
    await s.press(s.button('Close', form), 40)
    form = await openShare(s, 'Dashboard screenshot')
    await pick(s, s.field('Link works for', form) as HTMLSelectElement, '0')
    await s.press(s.button('Create link', form), 60)
    assert.equal(s.calls.share[1].days, 0)
    says(form.textContent, 'Never expires')
  })

  it('still makes a link that ends: picking 30 days sends 30 and the dialog says when it stops', async () => {
    const s = await shelf()
    const form = await openShare(s)
    await pick(s, s.field('Link works for', form) as HTMLSelectElement, '30')
    await s.press(s.button('Create link', form), 60)
    assert.equal(s.calls.share[0].days, 30)
    says(form.textContent, 'Works until 27 Dec 2026')
  })

  it('says what to do when the server refuses, and makes no link', async () => {
    const s = await shelf({ overrides: { share: async () => { throw new ApiError('Its file is no longer in the Document Library, so it cannot be shared.', 422) } } })
    const form = await openShare(s)
    await s.press(s.button('Create link', form), 60)
    says(form.querySelector('[role="alert"]')!.textContent, 'Its file is no longer in the Document Library, so it cannot be shared.')
    absent(linkField(s, form), 'no link was made')
    assert.ok(s.button('Create link', form), 'and the person can try again')
  })

  it('says so when the server has no share link yet, in the server\'s own sentence', async () => {
    const s = await shelf({ overrides: { share: async () => { throw new ApiError('Sharing is not set up on this server yet.', 503) } } })
    const form = await openShare(s)
    await s.press(s.button('Create link', form), 60)
    says(form.querySelector('[role="alert"]')!.textContent, 'Sharing is not set up on this server yet.')
  })

  it('does not take an answer with no link in it for a link', async () => {
    const s = await shelf({ overrides: { share: async (_p, itemId) => ({ status: 1, data: kitItem({ id: itemId, share: undefined }) }) } })
    const form = await openShare(s)
    await s.press(s.button('Create link', form), 60)
    says(form.querySelector('[role="alert"]')!.textContent, 'The link could not be created. Try again in a moment.')
    absent(linkField(s, form), 'nothing to copy')
  })
})

describe('copying the link', () => {
  it('copies it to the clipboard and says Link copied', async () => {
    const s = await shelf({ items: sharedPdf() })
    const written = stubClipboard(s, 'works')
    const form = await openShare(s)
    await s.press(s.button('Copy link', form), 40)
    assert.deepEqual(written, [`http://localhost/share/kit/${fakeToken(7)}`])
    says(form.textContent, 'Link copied')
  })

  it('selects the text and says so when the clipboard is not there', async () => {
    const s = await shelf({ items: sharedPdf() })
    const form = await openShare(s)
    await s.press(s.button('Copy link', form), 40)
    const box = linkField(s, form)!
    assert.equal(box.selectionStart, 0)
    assert.equal(box.selectionEnd, box.value.length, 'the whole address is selected')
    says(form.textContent, 'The link is selected. Copy it from your keyboard')
    assert.ok(!form.textContent?.includes('Link copied'), 'it does not claim a copy that did not happen')
  })

  it('does the same when the browser refuses the clipboard', async () => {
    const s = await shelf({ items: sharedPdf() })
    const written = stubClipboard(s, 'refuses')
    const form = await openShare(s)
    await s.press(s.button('Copy link', form), 40)
    assert.deepEqual(written, [])
    says(form.textContent, 'The link is selected.')
  })
})

describe('renewing and stopping', () => {
  it('asks before a new link, and on Cancel changes nothing', async () => {
    const s = await shelf({ items: sharedPdf() })
    const form = await openShare(s)
    const before = linkField(s, form)!.value
    await s.press(s.button('Create a new link', form))
    const ask = s.confirmDialog()!
    says(ask.textContent, 'Create a new link for "Fee collection one-pager"?')
    says(ask.textContent, 'The link you shared before stops working at once.')
    await s.press(s.button('Cancel', ask), 40)
    assert.equal(s.calls.share.length, 0)
    assert.equal(linkField(s, form)!.value, before)
  })

  it('makes a new link when told to, shows it instead of the old one, and says the old one has stopped', async () => {
    const s = await shelf({ items: sharedPdf() })
    const form = await openShare(s)
    const before = linkField(s, form)!.value
    await pick(s, s.field('Link works for', form) as HTMLSelectElement, '90')
    await s.press(s.button('Create a new link', form))
    await s.press(s.button('Create a new link', s.confirmDialog()!), 60)
    assert.deepEqual(s.calls.share, [{ productId: PRODUCT_ID, itemId: 3, days: 90 }])
    assert.notEqual(linkField(s, form)!.value, before, 'a different address')
    says(form.textContent, 'New link created. The old one has stopped.')
    says(form.textContent, 'Works until 25 Feb 2027')
  })

  it('asks before stopping, says what it means, and on Cancel keeps the link', async () => {
    const s = await shelf({ items: sharedPdf() })
    const form = await openShare(s)
    await s.press(s.button('Stop sharing', form))
    const ask = s.confirmDialog()!
    says(ask.textContent, 'Stop sharing "Fee collection one-pager"?')
    says(ask.textContent, 'Anyone who has it will see that it is not available.')
    await s.press(s.button('Cancel', ask), 40)
    assert.equal(s.calls.stopSharing.length, 0)
    assert.ok(linkField(s, form), 'the link is still there')
  })

  it('stops sharing when told to, takes the link away, offers to make a new one, and the card no longer says Shared', async () => {
    const s = await shelf({ items: sharedPdf() })
    const form = await openShare(s)
    await s.press(s.button('Stop sharing', form))
    await s.press(s.button('Stop sharing', s.confirmDialog()!), 60)
    assert.deepEqual(s.calls.stopSharing, [{ productId: PRODUCT_ID, itemId: 3 }])
    absent(linkField(s, form), 'the link is gone')
    says(form.textContent, 'Sharing stopped. The link no longer works.')
    assert.ok(s.button('Create link', form), 'a manager can make another')
    assert.ok(!s.entry(PDF)!.textContent?.includes('Shared'))
  })

  it('renews a link that has run out with no question (there is nothing left to break), and says when it ran out', async () => {
    const s = await shelf({ items: sharedPdf({ share: fakeShare(7, 30, { expired: true, expiresAt: '2026-11-01 08:00:00' }) }) })
    const form = await openShare(s)
    says(form.textContent, 'Expired on 1 Nov 2026. The link no longer works. Create a new link to share it again.')
    absent(linkField(s, form), 'a dead link is not offered for copying')
    absent(s.button('Copy link', form), 'nothing to copy')
    await s.press(s.button('Create a new link', form), 60)
    assert.equal(s.calls.share.length, 1)
    absent(s.confirmDialog(), 'no question')
    assert.ok(linkField(s, form))
  })
})

describe('a person who may only look', () => {
  it('sees an existing link, can copy it, is told when it stops, and is offered nothing else', async () => {
    const s = await shelf({ items: sharedPdf(), can: VIEW_ONLY })
    const written = stubClipboard(s, 'works')
    const form = await openShare(s)
    assert.equal(linkField(s, form)!.value, `http://localhost/share/kit/${fakeToken(7)}`)
    says(form.textContent, 'Works until 27 Dec 2026')
    await s.press(s.button('Copy link', form), 40)
    assert.equal(written.length, 1)
    for (const label of ['Create link', 'Create a new link', 'Stop sharing']) absent(s.button(label, form), label)
    absent(s.field('Link works for', form), 'no length to choose')
    absent(s.k.one('select'), 'no select at all')
  })

  it('has no Share link on a card that has no link, and no menu at all there', async () => {
    const s = await shelf({ items: sharedPdf(), can: VIEW_ONLY })
    assert.equal(s.k.all('button').filter((b) => b.getAttribute('aria-label') === 'More actions for Admissions walkthrough').length, 0)
    await s.openMenu(`More actions for ${PDF}`)
    assert.deepEqual(s.menuItems(), ['Share link'], 'on the card that has one, only that')
  })

  it('is told, for a link that has run out, to ask a manager, with nothing to copy', async () => {
    const s = await shelf({ items: sharedPdf({ share: fakeShare(7, 30, { expired: true, expiresAt: '2026-11-01 08:00:00' }) }), can: VIEW_ONLY })
    const form = await openShare(s)
    says(form.textContent, 'Expired on 1 Nov 2026. The link no longer works. Ask a manager to create a new one.')
    absent(linkField(s, form), 'nothing to copy')
    absent(s.button('Copy link', form), 'no Copy link')
    absent(s.button('Create a new link', form), 'no way to renew')
  })
})

describe('which cards can be shared', () => {
  it('offers Share link on a file, an address on the web and the interactive deck, and not on a page inside the app', async () => {
    const s = await shelf({ items: [...scholarcloneItems(), internalPage(), webPage()] })
    for (const title of [PDF, 'Customer video', 'What is your school not seeing?', 'ScholarClone client presentation']) {
      await s.openMenu(`More actions for ${title}`)
      assert.ok(s.menuItems().includes('Share link'), title)
      await s.k.act(async () => { s.k.w.document.dispatchEvent(new s.k.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
      await s.settle(20)
    }
    await s.openMenu('More actions for Course page')
    assert.deepEqual(s.menuItems(), ['Edit details', 'Remove'], 'a page that needs a sign-in cannot be public')
  })

  it('offers it on a file that is gone to nobody', async () => {
    const gone = kitItem({ id: 60, title: 'Old sheet', missing: true, fileName: null, mimeType: null, size: null, share: fakeShare(3, 30) })
    const s = await shelf({ items: [gone], can: VIEW_ONLY })
    assert.equal(s.entry('Old sheet')!.querySelectorAll('button').length, 0)
  })
})

describe('the Shared mark', () => {
  it('says Shared on a card with a live link, with an icon, and Link expired on one that has run out, and nothing on the others', async () => {
    const items = scholarcloneItems().map((item) => (item.id === 3 ? { ...item, share: fakeShare(7, 30) } : item.id === 4 ? { ...item, share: fakeShare(8, 30, { expired: true, expiresAt: '2026-11-01 08:00:00' }) } : item))
    const s = await shelf({ items })
    const facts = (title: string) => s.entry(title)!.querySelector('p.flex')!
    says(facts(PDF).textContent, 'Shared')
    assert.ok(facts(PDF).querySelector('svg[aria-hidden="true"]'), 'an icon beside the words, not colour alone')
    says(facts('Admissions walkthrough').textContent, 'Link expired')
    assert.ok(!facts('Dashboard screenshot').textContent?.includes('Shared'))
    assert.ok(!facts('Dashboard screenshot').textContent?.includes('expired'))
  })

  it('shows it on the featured card too', async () => {
    const items = scholarcloneItems().map((item) => (item.id === 1 ? { ...item, share: fakeShare(9, 0) } : item))
    const s = await shelf({ items })
    says(s.k.one('[data-kit-featured]')!.textContent, 'Shared')
  })
})

describe('the dialog is accessible', () => {
  it('has no violation a fake page can see, for a manager with and without a link, and for a viewer', async () => {
    const manager = await shelf()
    let form = await openShare(manager)
    assert.deepEqual(await axeViolations(form), [])
    await manager.press(manager.button('Create link', form), 60)
    assert.deepEqual(await axeViolations(form), [])
    await disposeAll()
    const viewer = await shelf({ items: sharedPdf(), can: VIEW_ONLY })
    form = await openShare(viewer)
    assert.deepEqual(await axeViolations(form), [])
  })
})
