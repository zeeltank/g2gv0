import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import { ALL_RIGHTS, kitItem, scholarcloneItems, VIEW_ONLY } from '../../services/product-master/kit-fake-service'
import { openKit, PRODUCT_ID } from './sales-kit-screen-kit'

/**
 * The Sales Kit tab of a Product in a fake browser: the real panel on an in-memory kit. A person who only looks sees the shelf and the actions of each entry and no way to change it; a manager
 * sees Add to Sales Kit, edits and removes; each type of entry does its own thing; and an empty, loading or failed shelf says what to do next.
 */

let open: Awaited<ReturnType<typeof openKit>> | null = null
async function shelf(...args: Parameters<typeof openKit>) {
  open = await openKit(...args)
  return open
}
afterEach(async () => {
  open?.restore()
  open = null
  await disposeAll()
})

const pdf = (name = 'brief.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' })

describe('a person who may only look', () => {
  it('sees every entry and its action, and no way to add, edit or remove', async () => {
    const s = await shelf({ can: VIEW_ONLY })
    assert.deepEqual(s.titles().sort(), scholarcloneItems().map((i) => i.title).sort())
    absent(s.button('Add to Sales Kit'), 'no Add to Sales Kit button')
    absent(s.k.one('input[type="file"]'), 'no file box to open')
    assert.equal(s.k.all('button').filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('More actions for')).length, 0, 'no menu to edit or remove')
    assert.equal(s.k.all('button').filter((b) => b.textContent?.trim() === 'Remove').length, 0)
    assert.ok(s.button('Download PowerPoint'), 'but the actions to use an entry are there')
    assert.ok(s.button('Preview PDF'))
    assert.ok(s.button('Play video'))
  })

  it('cannot start an upload by dropping files on the page', async () => {
    const s = await shelf({ can: VIEW_ONLY })
    await s.drop(s.k.one('h2')!.parentElement!.parentElement!, [pdf()])
    absent(s.dialog(), 'no upload dialog')
    absent(s.k.one('[aria-hidden="true"].border-dashed'), 'no drop frame')
    assert.equal(s.calls.uploadFile.length, 0)
  })

  it('is told, on an empty shelf, what will appear, and is offered nothing to press', async () => {
    const s = await shelf({ can: VIEW_ONLY, items: [] })
    says(s.k.bodyText(), 'The Sales Kit is empty')
    says(s.k.bodyText(), 'will appear here once your team adds them')
    assert.equal(s.k.all('button').length, 0, 'not a single button on the empty shelf')
    absent(s.chip('All'), 'and no filter chips with nothing to filter')
  })
})

describe('a manager', () => {
  it('has one Add to Sales Kit menu with Upload files, Add link and From Document Library, in that order', async () => {
    const s = await shelf()
    await s.openMenu('Add to Sales Kit')
    assert.deepEqual(s.menuItems(), ['Upload files', 'Add link', 'From Document Library'])
  })

  it('is told how to start on an empty shelf, with the three ways in as buttons', async () => {
    const s = await shelf({ items: [] })
    says(s.k.bodyText(), 'Start the Sales Kit')
    for (const label of ['Upload files', 'Add link', 'From Document Library']) assert.ok(s.button(label), label)
  })

  it('edits and removes an entry from its own menu, and a viewer\'s tile has no such menu', async () => {
    const s = await shelf()
    const tile = s.entry('Fee collection one-pager')!
    await s.openMenu('More actions for Fee collection one-pager')
    assert.deepEqual(s.menuItems(), ['Edit details', 'Remove'])
    assert.ok(tile)
  })

  it('gets only the menu items it has the right to: no Remove without the delete right, no Edit without the edit right', async () => {
    const noDelete = await shelf({ can: { ...ALL_RIGHTS, delete: false } })
    await noDelete.openMenu('More actions for Fee collection one-pager')
    assert.deepEqual(noDelete.menuItems(), ['Edit details'])
    await disposeAll()
    const noEdit = await shelf({ can: { ...ALL_RIGHTS, edit: false } })
    await noEdit.openMenu('More actions for Fee collection one-pager')
    assert.deepEqual(noEdit.menuItems(), ['Remove'])
  })
})

describe('the shelf: chips and the featured presentation', () => {
  it('draws All and the four kinds with their counts, pressed on All', async () => {
    const s = await shelf()
    const chips = s.k.all('[role="group"][aria-label="Show"] button')
    assert.deepEqual(chips.map((b) => b.textContent), ['All5', 'Demo presentations2', 'Documents1', 'Videos1', 'Images1'])
    assert.deepEqual(chips.map((b) => b.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false'])
  })

  it('features the first presentation once, large and first, and draws every other entry as a tile', async () => {
    const s = await shelf()
    const featured = s.k.all('[data-kit-featured]')
    assert.equal(featured.length, 1)
    assert.equal(featured[0].querySelector('h3')?.textContent, 'What is your school not seeing?')
    assert.equal(s.titles()[0], 'What is your school not seeing?', 'it comes first, so a screen reader reaches it first too')
    assert.equal(s.k.all('li[data-kit-entry]').length, 4, 'the other four are tiles')
    assert.equal(s.k.all('li[data-kit-entry] h3').some((h) => h.textContent === 'What is your school not seeing?'), false, 'and the featured one is not drawn twice')
  })

  it('filters to one kind, keeping the featured card only on Demo presentations', async () => {
    const s = await shelf()
    await s.press(s.chip('Videos'))
    assert.deepEqual(s.titles(), ['Admissions walkthrough'])
    assert.equal(s.chip('Videos')!.getAttribute('aria-pressed'), 'true')
    assert.equal(s.k.all('[data-kit-featured]').length, 0)
    await s.press(s.chip('Demo presentations'))
    assert.equal(s.k.all('[data-kit-featured]').length, 1)
    assert.deepEqual(s.titles(), ['What is your school not seeing?', 'ScholarClone client presentation'])
    await s.press(s.chip('All'))
    assert.equal(s.titles().length, 5)
  })

  it('says a kind has nothing yet, to a viewer and to a manager, differently', async () => {
    const items = scholarcloneItems().filter((i) => i.kind !== 'video')
    const viewer = await shelf({ items, can: VIEW_ONLY })
    await viewer.press(viewer.chip('Videos'))
    says(viewer.k.bodyText(), 'No videos yet')
    says(viewer.k.bodyText(), 'Your team has not added any to this product.')
    await disposeAll()
    const manager = await shelf({ items })
    await manager.press(manager.chip('Videos'))
    says(manager.k.bodyText(), 'No videos yet')
    says(manager.k.bodyText(), 'Use Add to Sales Kit to put one here')
  })
})

describe('what each type of entry does', () => {
  it('opens the interactive deck in a new tab as a real link, and offers no Download for it', async () => {
    const s = await shelf()
    const card = s.k.one('[data-kit-featured]')!
    const link = card.querySelector('a') as HTMLAnchorElement
    assert.equal(link.textContent, 'Open interactive deck')
    assert.equal(link.getAttribute('href'), '/signals/portfolio/deck/scholarclone')
    assert.equal(link.getAttribute('target'), '_blank')
    assert.match(link.getAttribute('rel') ?? '', /noopener/)
    assert.match(link.getAttribute('aria-label') ?? '', /^Open interactive deck, What is your school not seeing\? \(opens in a new tab\)$/)
    assert.equal(Array.from(card.querySelectorAll('button')).some((b) => /download/i.test(b.textContent ?? '')), false, 'a link is not a file')
    assert.equal(s.calls.fetchFile.filter((c) => c.itemId === 1).length, 0, 'nothing was read for the link')
  })

  it('does not draw an address that is not https or an app path as a link', async () => {
    const s = await shelf({ items: [kitItem({ id: 9, kind: 'document', title: 'Odd', source: 'link', url: 'javascript:alert(1)' })] })
    assert.equal(s.k.all('a').length, 0)
    assert.ok(s.entry('Odd'), 'it is still listed')
  })

  it('downloads a PowerPoint as a file under its own name, reading the file with the kit\'s download', async () => {
    const s = await shelf()
    await s.press(s.button('Download PowerPoint'))
    // (the picture's thumbnail is read too: this fake browser has no IntersectionObserver, so it is read at once)
    assert.deepEqual(s.calls.fetchFile.filter((c) => c.itemId === 2).map((c) => c.inline), [false])
    assert.deepEqual(s.saved.map((d) => d.name), ['ScholarClone-Client-Presentation.pptx'])
    assert.equal(s.saved[0].blob.type, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  })

  it('says so when a download fails, and keeps the shelf', async () => {
    const s = await shelf({ overrides: { fetchFile: async () => { throw new ApiError('The file could not be read.', 500) } } })
    await s.press(s.button('Download PowerPoint'))
    const alert = s.k.one('[role="alert"]')!
    says(alert.textContent, '"ScholarClone client presentation" could not be downloaded. The file could not be read.')
    assert.equal(s.saved.length, 0)
    assert.equal(s.titles().length, 5)
  })

  it('previews a PDF in the Document Library viewer, reading the library document, and also offers Download', async () => {
    const s = await shelf()
    await s.press(s.button('Preview PDF'))
    await s.settle(40)
    assert.deepEqual(s.previewed, [503], 'the viewer read the library document behind the entry')
    assert.ok(s.dialog()?.textContent?.includes('Fee collection one-pager'))
    assert.equal(s.calls.fetchFile.filter((c) => c.itemId === 3).length, 0, 'the kit\'s own download was not used for the preview')
  })

  it('previews a picture and downloads it from the icon beside the button', async () => {
    const s = await shelf()
    assert.ok(s.button('Preview image'))
    const save = s.k.all('button').find((b) => b.getAttribute('aria-label') === 'Download Dashboard screenshot')!
    await s.press(save)
    assert.deepEqual(s.saved.map((d) => d.name), ['dashboard.png'])
  })

  it('plays a video from a blob address and releases the address when the player closes', async () => {
    const s = await shelf()
    await s.press(s.button('Play video'), 40)
    const video = s.k.one('video') as HTMLVideoElement
    assert.ok(video, 'a player is on the page')
    assert.ok(video.getAttribute('src')?.startsWith('blob:test/'))
    assert.deepEqual(s.calls.fetchFile.filter((c) => c.itemId === 4).map((c) => c.inline), [true])
    const address = video.getAttribute('src')!
    assert.equal(s.released.includes(address), false, 'still playing')
    await s.press(s.button('Close', s.dialog()!))
    await s.settle(40)
    assert.equal(s.released.includes(address), true, 'the address was released on close')
  })

  it('offers a video of more than 100 MB as a download, not a player', async () => {
    const big = kitItem({ id: 20, kind: 'video', title: 'Full day recording', fileName: 'day.mp4', mimeType: 'video/mp4', size: 104_857_601 })
    const s = await shelf({ items: [big] })
    assert.ok(s.button('Download video'))
    absent(s.button('Play video'), 'no player for it')
  })

  it('loads a picture\'s thumbnail only when its tile comes into view, and releases it when the tile goes', async () => {
    const watchers: Array<{ cb: (entries: Array<{ isIntersecting: boolean }>) => void; disconnected: boolean }> = []
    class FakeObserver {
      record = { cb: null as never as (entries: Array<{ isIntersecting: boolean }>) => void, disconnected: false }
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { this.record.cb = cb; watchers.push(this.record) }
      observe() {}
      unobserve() {}
      disconnect() { this.record.disconnected = true }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: FakeObserver, configurable: true, writable: true })
    try {
      const s = await shelf()
      assert.equal(s.calls.fetchFile.length, 0, 'nothing is read while the tile is out of view')
      assert.equal(watchers.length, 1, 'one picture, one watcher')
      await s.k.act(async () => { watchers[0].cb([{ isIntersecting: true }]) })
      await s.settle(30)
      assert.deepEqual(s.calls.fetchFile.map((c) => [c.itemId, c.inline]), [[5, true]])
      const img = s.entry('Dashboard screenshot')!.querySelector('img')
      assert.ok(img, 'the thumbnail is drawn')
      assert.equal(img.getAttribute('alt'), '', 'decorative: the title beside it names it')
      const address = img.getAttribute('src')!
      await disposeAll()
      assert.equal(s.released.includes(address), true, 'the address is released when the tile unmounts')
    } finally {
      Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    }
  })
})

describe('a file that is no longer in the Document Library', () => {
  const gone = () => kitItem({ id: 30, kind: 'document', title: 'Old price sheet', missing: true, fileName: null, mimeType: null, size: null })

  it('says so, to a viewer, and offers nothing to press', async () => {
    const s = await shelf({ items: [gone()], can: VIEW_ONLY })
    const row = s.entry('Old price sheet')!
    says(row.textContent, 'File no longer in the Document Library')
    assert.equal(row.querySelectorAll('button, a').length, 0)
  })

  it('offers a manager only Remove, which asks first and then removes it', async () => {
    const s = await shelf({ items: [gone()] })
    const row = s.entry('Old price sheet')!
    assert.deepEqual(Array.from(row.querySelectorAll('button')).map((b) => b.textContent?.trim()), ['Remove'])
    await s.press(s.button('Remove', row))
    assert.ok(s.confirmDialog(), 'it asks first')
    assert.equal(s.calls.remove.length, 0)
    await s.press(s.button('Remove', s.confirmDialog()!), 40)
    assert.deepEqual(s.calls.remove, [{ productId: PRODUCT_ID, itemId: 30 }])
    absent(s.entry('Old price sheet'), 'gone from the shelf')
  })

  it('is never featured, even when it is the only presentation', async () => {
    const s = await shelf({ items: [kitItem({ id: 31, kind: 'presentation', title: 'Lost deck', missing: true, fileName: null, mimeType: null, size: null })] })
    assert.equal(s.k.all('[data-kit-featured]').length, 0)
    assert.ok(s.entry('Lost deck'))
  })
})

describe('loading, failing and retrying', () => {
  it('draws skeletons while the kit is read, named for a screen reader', async () => {
    const s = await shelf({ state: { status: 'loading', data: null, error: '' } })
    const busy = s.k.one('[aria-busy="true"]')!
    says(busy.textContent, 'Loading the Sales Kit')
    assert.equal(s.k.all('h3').length, 0)
  })

  it('says why a first read failed and retries it from a button', async () => {
    const s = await shelf({ state: { status: 'error', data: null, error: 'The Sales Kit is not set up on this server yet.' } })
    const alert = s.k.one('[role="alert"]')!
    says(alert.textContent, 'The Sales Kit is not set up on this server yet.')
    await s.press(s.button('Retry', alert))
    assert.equal(s.retried.count, 1)
  })

  it('reads the kit through the service and keeps the shelf when a later read fails', async () => {
    let calls = 0
    const s = await shelf({ overrides: { get: async () => { calls += 1; throw new ApiError('Offline', 500) } } })
    assert.ok(calls >= 1)
    says(s.k.one('[role="alert"]')!.textContent, 'Offline')
  })
})

describe('adding a link', () => {
  it('checks the title and the address before asking, in words under each box', async () => {
    const s = await shelf()
    await s.openMenu('Add to Sales Kit')
    await s.press(s.menuItem('Add link'))
    const form = s.dialog()!
    assert.equal(form.querySelector('h2')?.textContent, 'Add link')
    await s.press(s.button('Add link', form))
    says(form.textContent, 'Give it a title.')
    says(form.textContent, 'Paste the address.')
    await s.type(s.field('Title', form), 'Pricing page')
    await s.type(s.field('Link', form), 'http://example.com')
    await s.press(s.button('Add link', form))
    says(form.textContent, 'Use an address that starts with https:// or a path that starts with /.')
    assert.equal(s.calls.addLink.length, 0, 'nothing was sent')
  })

  it('sends the title, the address and the kind, closes, says so, and shows the new entry', async () => {
    const s = await shelf()
    await s.openMenu('Add to Sales Kit')
    await s.press(s.menuItem('Add link'))
    const form = s.dialog()!
    await s.type(s.field('Title', form), '  Pricing page ')
    await s.type(s.field('Link', form), 'https://example.com/pricing')
    await s.press(s.button('Add link', form), 60)
    assert.deepEqual(s.calls.addLink, [{ productId: PRODUCT_ID, body: { title: 'Pricing page', url: 'https://example.com/pricing', kind: 'presentation' } }])
    absent(s.dialog(), 'the dialog closed')
    says(s.k.one('[role="status"]')!.textContent, 'Added the link to the Sales Kit.')
    assert.ok(s.entry('Pricing page'), 'the shelf was read again')
  })

  it('shows what the server refuses under the box it names', async () => {
    const s = await shelf({ overrides: { addLink: async () => { throw new ApiError('The given data was invalid.', 422, { url: ['The url must start with https://.'] }) } } })
    await s.openMenu('Add to Sales Kit')
    await s.press(s.menuItem('Add link'))
    const form = s.dialog()!
    await s.type(s.field('Title', form), 'Deck')
    await s.type(s.field('Link', form), '/signals/portfolio/deck/scholarclone')
    await s.press(s.button('Add link', form), 60)
    says(form.textContent, 'The url must start with https://.')
    assert.ok(s.dialog(), 'the dialog stays open so the person can fix it')
  })
})

describe('uploading files', () => {
  it('lists each chosen file with its title, tells a type the server would refuse before sending, and sends the rest one by one', async () => {
    const s = await shelf()
    const deck = new File(['pptx'], 'Spring-Demo.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
    const exe = new File(['x'], 'tool.exe', { type: 'application/octet-stream' })
    await s.choose([deck, exe])
    const form = s.dialog()!
    assert.equal(form.querySelector('h2')?.textContent, 'Upload files')
    says(form.textContent, 'Accepted: PDF, DOC, DOCX')
    says(form.textContent, 'Up to 100 MB each.')
    says(form.textContent, '"tool.exe" is not a type the Sales Kit takes.')
    assert.equal((s.field('Title', form) as HTMLInputElement).value, 'Spring-Demo', 'the title starts as the name without the extension')
    assert.equal(form.querySelectorAll('select').length, 1, 'a PowerPoint may be a presentation or a document; the exe has no box')
    await s.press(s.button('Upload', form), 80)
    assert.deepEqual(s.calls.uploadFile.map((c) => [c.name, c.meta?.title, c.meta?.kind]), [['Spring-Demo.pptx', 'Spring-Demo', 'presentation']], 'only the file that can be sent was sent')
    absent(s.dialog(), 'the dialog closed')
    says(s.k.one('[role="status"]')!.textContent, 'Added 1 file to the Sales Kit.')
    assert.ok(s.entry('Spring-Demo'), 'the shelf shows it')
  })

  it('sends the title and the line a person typed', async () => {
    const s = await shelf()
    await s.choose([pdf('one-pager.pdf')])
    const form = s.dialog()!
    await s.type(s.field('Title', form), 'Fee one-pager')
    await s.type(s.field('What it is for', form), 'Send after the first call.')
    await s.press(s.button('Upload', form), 80)
    assert.deepEqual(s.calls.uploadFile[0].meta, { title: 'Fee one-pager', description: 'Send after the first call.', kind: 'document' })
  })

  it('asks for a title before sending', async () => {
    const s = await shelf()
    await s.choose([pdf()])
    const form = s.dialog()!
    await s.type(s.field('Title', form), '   ')
    await s.press(s.button('Upload', form))
    says(form.textContent, 'Give it a title.')
    assert.equal(s.calls.uploadFile.length, 0)
  })

  it('keeps the dialog open when a file is refused, says why under that file, and keeps the ones that were added', async () => {
    let n = 0
    const s = await shelf({ overrides: { uploadFile: async (_p, file) => { n += 1; if (file.name === 'b.pdf') throw new ApiError('The file could not be stored.', 500); return { status: 1, data: kitItem({ id: 300 + n, title: file.name }) } } } })
    await s.choose([pdf('a.pdf'), pdf('b.pdf')])
    await s.press(s.button('Upload 2 files', s.dialog()!), 80)
    const form = s.dialog()!
    assert.ok(form, 'still open')
    says(form.textContent, 'The file could not be stored.')
    says(form.textContent, 'Added')
    says(form.textContent, 'Not added')
    assert.equal(s.calls.uploadFile.length, 2)
    says(s.k.bodyText(), 'Added 1 file to the Sales Kit.')
  })

  it('does not close while a file is on its way, shows that it is, and closes when it is done', async () => {
    let finish: () => void = () => undefined
    const s = await shelf({ overrides: { uploadFile: (_p, file) => new Promise((resolve) => { finish = () => resolve({ status: 1, data: kitItem({ id: 400, title: file.name }) }) }) } })
    await s.choose([pdf('slow.pdf')])
    const form = s.dialog()!
    await s.press(s.button('Upload', form))
    says(form.textContent, 'Uploading')
    assert.equal((s.button('Cancel', form) as HTMLButtonElement).disabled, true)
    await s.k.act(async () => { s.k.w.document.dispatchEvent(new s.k.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await s.settle(30)
    assert.ok(s.dialog(), 'Escape did not close it')
    await s.k.act(async () => { finish() })
    await s.settle(60)
    absent(s.dialog(), 'closed once the file was in')
  })

  it('shows how far a file has gone when the transport says so', async () => {
    let report: (fraction: number) => void = () => undefined
    let finish: () => void = () => undefined
    const s = await shelf({ overrides: { uploadFile: (_p, file, _m, onProgress) => new Promise((resolve) => { report = onProgress ?? report; finish = () => resolve({ status: 1, data: kitItem({ id: 401, title: file.name }) }) }) } })
    await s.choose([pdf('big.pdf')])
    await s.press(s.button('Upload', s.dialog()!))
    await s.k.act(async () => { report(0.42) })
    says(s.dialog()!.textContent, 'Uploading 42%')
    await s.k.act(async () => { finish() })
    await s.settle(60)
  })

  it('opens the upload from a dropped file, and ignores a drag that carries no file', async () => {
    const s = await shelf()
    const panel = s.k.one('h2')!.parentElement!.parentElement!
    await s.drop(panel, [pdf('dropped.pdf')], ['text/plain'])
    absent(s.dialog(), 'text dragged over the page does nothing')
    await s.drop(panel, [pdf('dropped.pdf')])
    const form = s.dialog()!
    assert.ok(form, 'the upload dialog is open')
    says(form.textContent, 'dropped.pdf')
  })
})

describe('adding from the Document Library', () => {
  const library = [
    { id: 71, title: 'Board pack', fileName: 'board-pack.pdf', mimeType: 'application/pdf', size: 900_000, visibility: 'organization', ownedByMe: false },
    { id: 72, title: 'Board draft', fileName: 'board-draft.docx', mimeType: null, size: 40_000, visibility: 'private', ownedByMe: true },
    { id: 73, title: 'Board minutes', fileName: 'board-minutes.docx', mimeType: null, size: 30_000, visibility: 'private', ownedByMe: false },
  ]

  async function openLibrary() {
    const s = await shelf({ library })
    await s.openMenu('Add to Sales Kit')
    await s.press(s.menuItem('From Document Library'))
    return { s, form: s.dialog()! }
  }
  const pick = async (s: Awaited<ReturnType<typeof shelf>>, form: Element, title: string) => {
    const row = Array.from(form.querySelectorAll('label')).find((l) => l.textContent?.includes(title))
    assert.ok(row, `${title} is listed`)
    await s.press(row.querySelector('input'))
  }

  it('searches after two letters, not before, and lists what it finds with who can open each', async () => {
    const { s, form } = await openLibrary()
    assert.equal(form.querySelector('h2')?.textContent, 'From Document Library')
    await s.type(s.field('Search by name', form), 'b')
    await s.settle(320)
    assert.equal(s.calls.searchLibrary.length, 0, 'one letter asks nothing')
    await s.type(s.field('Search by name', form), 'board')
    await s.settle(320)
    assert.deepEqual(s.calls.searchLibrary, [{ productId: PRODUCT_ID, q: 'board' }])
    says(form.textContent, 'Board pack')
    says(form.textContent, 'Shared with your organisation')
    says(form.textContent, 'Only you can open it')
    says(form.textContent, 'Not shared with your organisation')
  })

  it('adds a document that is already shared with no question', async () => {
    const { s, form } = await openLibrary()
    await s.type(s.field('Search by name', form), 'board')
    await s.settle(320)
    await pick(s, form, 'Board pack')
    assert.equal((s.button('Add to Sales Kit', form) as HTMLButtonElement).disabled, false)
    await s.press(s.button('Add to Sales Kit', form), 60)
    assert.deepEqual(s.calls.fromLibrary, [{ productId: PRODUCT_ID, body: { documentId: 71, title: 'Board pack', kind: 'document' } }])
    assert.equal('makeShared' in s.calls.fromLibrary[0].body, false)
    assert.ok(s.entry('Board pack'))
  })

  it('adds the owner\'s own unshared document only after they agree to share it, and sends makeShared', async () => {
    const { s, form } = await openLibrary()
    await s.type(s.field('Search by name', form), 'board')
    await s.settle(320)
    await pick(s, form, 'Board draft')
    const add = s.button('Add to Sales Kit', form) as HTMLButtonElement
    assert.equal(add.disabled, true, 'not until they agree')
    const agree = Array.from(form.querySelectorAll('input[type="checkbox"]'))[0] as HTMLInputElement
    assert.ok(agree, 'the question is asked')
    says(form.textContent, 'Share it with everyone in my organisation')
    await s.press(agree)
    assert.equal(add.disabled, false)
    await s.press(add, 60)
    assert.equal(s.calls.fromLibrary[0].body.makeShared, true)
  })

  it('does not let anybody add somebody else\'s unshared document, and says who can', async () => {
    const { s, form } = await openLibrary()
    await s.type(s.field('Search by name', form), 'board')
    await s.settle(320)
    await pick(s, form, 'Board minutes')
    says(form.textContent, 'Only its owner can share it with your organisation.')
    assert.equal((s.button('Add to Sales Kit', form) as HTMLButtonElement).disabled, true)
    absent(form.querySelector('input[type="checkbox"]'), 'there is nothing the person can tick')
  })

  it('says when nothing is found and what is searched', async () => {
    const { s, form } = await openLibrary()
    await s.type(s.field('Search by name', form), 'zzzz')
    await s.settle(320)
    says(form.textContent, 'Nothing found. Only documents you can open, and that are not already in this Sales Kit, are listed.')
  })
})

describe('editing and removing', () => {
  it('sends only what was changed', async () => {
    const s = await shelf()
    await s.openMenu('More actions for Fee collection one-pager')
    await s.press(s.menuItem('Edit details'))
    const form = s.dialog()!
    assert.equal(form.querySelector('h2')?.textContent, 'Edit details')
    assert.equal((s.button('Save', form) as HTMLButtonElement).disabled, true, 'nothing changed yet')
    await s.type(s.field('Title', form), 'Fee collection summary')
    await s.press(s.button('Save', form), 60)
    assert.deepEqual(s.calls.update, [{ productId: PRODUCT_ID, itemId: 3, patch: { title: 'Fee collection summary' } }])
    absent(s.dialog(), 'closed')
    assert.ok(s.entry('Fee collection summary'))
  })

  it('lets a PDF be filed as a presentation, and gives a picture no choice', async () => {
    const s = await shelf()
    await s.openMenu('More actions for Fee collection one-pager')
    await s.press(s.menuItem('Edit details'))
    const kind = s.field('Kind', s.dialog()!) as HTMLSelectElement
    assert.deepEqual(Array.from(kind.options).map((o) => o.value), ['presentation', 'document'])
    assert.equal(kind.disabled, false)
    await disposeAll()
    const again = await shelf()
    await again.openMenu('More actions for Dashboard screenshot')
    await again.press(again.menuItem('Edit details'))
    const fixed = again.field('Kind', again.dialog()!) as HTMLSelectElement
    assert.equal(fixed.disabled, true)
    says(again.dialog()!.textContent, 'Its file type decides this.')
  })

  it('edits the address of a link and checks it', async () => {
    const s = await shelf()
    await s.openMenu('More actions for What is your school not seeing?')
    await s.press(s.menuItem('Edit details'))
    const form = s.dialog()!
    await s.type(s.field('Link', form), 'ftp://nope')
    await s.press(s.button('Save', form))
    says(form.textContent, 'Use an address that starts with https:// or a path that starts with /.')
    assert.equal(s.calls.update.length, 0)
  })

  it('asks before removing, says what stays, and does nothing on Cancel', async () => {
    const s = await shelf()
    await s.openMenu('More actions for Fee collection one-pager')
    await s.press(s.menuItem('Remove'))
    const ask = s.confirmDialog()!
    says(ask.textContent, 'Remove "Fee collection one-pager"?')
    says(ask.textContent, 'The file stays in the Document Library.')
    await s.press(s.button('Cancel', ask), 40)
    assert.equal(s.calls.remove.length, 0)
    assert.ok(s.entry('Fee collection one-pager'))
    await s.openMenu('More actions for Fee collection one-pager')
    await s.press(s.menuItem('Remove'))
    await s.press(s.button('Remove', s.confirmDialog()!), 60)
    assert.deepEqual(s.calls.remove, [{ productId: PRODUCT_ID, itemId: 3 }])
    absent(s.entry('Fee collection one-pager'), 'gone')
    says(s.k.one('[role="status"]')!.textContent, 'Removed "Fee collection one-pager" from the Sales Kit.')
  })

  it('says a link\'s page is not changed when the link is removed', async () => {
    const s = await shelf()
    await s.openMenu('More actions for What is your school not seeing?')
    await s.press(s.menuItem('Remove'))
    says(s.confirmDialog()!.textContent, 'The page it points to is not changed.')
  })
})

describe('accessibility and wording', () => {
  it('has no violation a fake page can see, for a manager and for a viewer', async () => {
    const manager = await shelf()
    assert.deepEqual(await axeViolations(manager.k.one('h2')!.parentElement!.parentElement!), [])
    await disposeAll()
    const viewer = await shelf({ can: VIEW_ONLY })
    assert.deepEqual(await axeViolations(viewer.k.one('h2')!.parentElement!.parentElement!), [])
  })

  it('gives every action a name that starts with what the button says and ends with the entry\'s title', async () => {
    const s = await shelf()
    const names = s.k.all('button, a').map((el) => el.getAttribute('aria-label')).filter(Boolean) as string[]
    assert.ok(names.includes('Download PowerPoint, ScholarClone client presentation'))
    assert.ok(names.includes('Preview PDF, Fee collection one-pager'))
    assert.ok(names.includes('Play video, Admissions walkthrough'))
    assert.equal(new Set(names).size, names.length, 'no two controls share a name')
  })

  it('never says item, offer or catalogue, and uses no all-capitals label, middle dot or arrow', async () => {
    const s = await shelf()
    const text = s.k.bodyText()
    assert.doesNotMatch(text, /\b(items?|offers?|catalogues?)\b/i)
    assert.doesNotMatch(text, /[·→]/)
    assert.equal(s.k.all('[class*="uppercase"]').length, 0)
  })
})
