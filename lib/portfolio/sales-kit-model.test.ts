import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fakeShare, kitItem, scholarcloneItems } from '../../services/product-master/kit-fake-service'
import {
  acceptAttribute, acceptedExtensionsText, addedText, canShare, checkFile, DEFAULT_SHARE_DAYS, deckKeyOf, defaultKindForFile, emptyText, entryFormErrors, fileFamily, filterItems, isKitFilter, isLiveShare,
  kindChoicesForFile, kitChips, linkHref, primaryAction, publicShareUrl, secondaryAction, SHARE_DAY_CHOICES, shareDecision, shareExpiryText, shareMark, shareMode, shelfOf, showShareLink, sizeText,
  sortItems, THUMBNAIL_LIMIT_BYTES, tileOf, titleFromFileName, typeWord, uploadLimitText, VIDEO_PLAY_LIMIT_BYTES, visibilityText,
} from './sales-kit-model'

/**
 * The rules of the Sales Kit tab, with no browser: the chips and their counts, which entry is featured, the main action each type of entry gets, the sizes and limits in words,
 * what an empty shelf says to a person who looks and to one who manages, and the checks of a file and of the forms.
 */

const LIMITS = { maxUploadKb: 102400, extensions: ['pdf', 'pptx', 'png', 'mp4'] }
const link = (over = {}) => kitItem({ source: 'link', documentId: null, fileName: null, mimeType: null, size: null, url: 'https://example.com/deck', ...over })

describe('the chips', () => {
  it('are All and the four kinds, each with its count, in the order a person looks for them', () => {
    const chips = kitChips({ all: 9, presentation: 2, document: 4, video: 1, image: 2 })
    assert.deepEqual(chips.map((c) => [c.id, c.label, c.count]), [['all', 'All', 9], ['presentation', 'Demo presentations', 2], ['document', 'Documents', 4], ['video', 'Videos', 1], ['image', 'Images', 2]])
  })

  it('draw a kind with nothing in it too: it tells a manager what the shelf can hold', () => {
    assert.deepEqual(kitChips({ all: 0, presentation: 0, document: 0, video: 0, image: 0 }).map((c) => c.count), [0, 0, 0, 0, 0])
  })

  it('know a filter from a stray word in an address', () => {
    for (const ok of ['all', 'presentation', 'document', 'video', 'image']) assert.equal(isKitFilter(ok), true, ok)
    for (const bad of ['link', 'Videos', '', null, undefined]) assert.equal(isKitFilter(bad), false, String(bad))
  })
})

describe('the shelf: sort, filter and the featured presentation', () => {
  it('puts the manager\'s order first and the newest first within it', () => {
    const items = [kitItem({ id: 1, sortOrder: 5, createdAt: '2026-11-01 09:00:00' }), kitItem({ id: 2, sortOrder: 0, createdAt: '2026-11-02 09:00:00' }), kitItem({ id: 3, sortOrder: 0, createdAt: '2026-11-10 09:00:00' }), kitItem({ id: 4, sortOrder: 0, createdAt: '2026-11-10 09:00:00' })]
    assert.deepEqual(sortItems(items).map((i) => i.id), [4, 3, 2, 1])
  })

  it('does not change the list it was given', () => {
    const items = [kitItem({ id: 1, sortOrder: 2 }), kitItem({ id: 2, sortOrder: 1 })]
    sortItems(items)
    assert.deepEqual(items.map((i) => i.id), [1, 2])
  })

  it('features the first presentation on All, and draws every other entry as the rest', () => {
    const shelf = shelfOf(scholarcloneItems(), 'all')
    assert.equal(shelf.featured?.id, 1, 'the interactive deck is the first presentation')
    assert.deepEqual(shelf.rest.map((i) => i.id).sort(), [2, 3, 4, 5], 'the PowerPoint is a presentation too, and sits among the rest')
  })

  it('features the first presentation on Demo presentations and nothing on the other kinds', () => {
    assert.equal(shelfOf(scholarcloneItems(), 'presentation').featured?.id, 1)
    for (const filter of ['document', 'video', 'image'] as const) {
      const shelf = shelfOf(scholarcloneItems(), filter)
      assert.equal(shelf.featured, null, filter)
      assert.ok(shelf.rest.length > 0 && shelf.rest.every((i) => i.kind === filter), `${filter} lists only its own kind`)
    }
  })

  it('never features a presentation whose file is gone, and has no featured entry when there is no presentation', () => {
    const gone = kitItem({ id: 1, kind: 'presentation', missing: true, fileName: null })
    const live = kitItem({ id: 2, kind: 'presentation', sortOrder: 3 })
    assert.equal(shelfOf([gone, live], 'all').featured?.id, 2)
    assert.equal(shelfOf([gone], 'all').featured, null)
    assert.equal(shelfOf([kitItem({ kind: 'document' })], 'all').featured, null)
    assert.deepEqual(shelfOf([], 'all'), { featured: null, rest: [] })
  })

  it('filters by kind', () => {
    assert.deepEqual(filterItems(scholarcloneItems(), 'video').map((i) => i.id), [4])
    assert.equal(filterItems(scholarcloneItems(), 'all').length, 5)
  })
})

describe('sizes, limits and the types a file may be', () => {
  it('writes a size the way the rest of the app does: 1 MB is 1,048,576 bytes', () => {
    assert.equal(sizeText(57_400_000), '54.7 MB', 'the real PowerPoint')
    assert.equal(sizeText(480_000), '469 KB')
    assert.equal(sizeText(12), '12 B')
    assert.equal(sizeText(2 * 1024 * 1024 * 1024), '2.0 GB')
    for (const none of [null, undefined, 0, -3]) assert.equal(sizeText(none), null, String(none))
  })

  it('says the upload limit in words', () => {
    assert.equal(uploadLimitText(102400), '100 MB')
    assert.equal(uploadLimitText(1536), '1.5 MB')
    assert.equal(uploadLimitText(512), '512 KB')
  })

  it('lists the accepted types once each, in the server\'s order, in capitals, with an "and" before the last', () => {
    assert.equal(acceptedExtensionsText(['pdf', 'pptx', 'mp4']), 'PDF, PPTX and MP4')
    assert.equal(acceptedExtensionsText(['pdf', 'PDF', '.pdf']), 'PDF')
    assert.equal(acceptedExtensionsText([]), acceptedExtensionsText(undefined), 'a server that sent none gets the standard list')
    assert.match(acceptedExtensionsText([]), /^PDF, DOC, .* and MOV$/)
    assert.equal(acceptAttribute(['pdf', 'pptx']), '.pdf,.pptx')
  })

  it('refuses a file of a type the server does not take, an empty one and one over the limit, each in its own sentence', () => {
    assert.equal(checkFile({ name: 'deck.pptx', size: 5_000_000 }, LIMITS), null)
    assert.equal(checkFile({ name: 'DECK.PPTX', size: 5_000_000 }, LIMITS), null, 'capitals do not matter')
    assert.match(checkFile({ name: 'tool.exe', size: 10 }, LIMITS)!, /"tool.exe" is not a type the Sales Kit takes\. It takes PDF, PPTX, PNG and MP4\./)
    assert.match(checkFile({ name: 'noextension', size: 10 }, LIMITS)!, /not a type/)
    assert.match(checkFile({ name: 'a.pdf', size: 0 }, LIMITS)!, /is empty/)
    assert.match(checkFile({ name: 'big.mp4', size: 104_857_601 }, LIMITS)!, /"big.mp4" is 100.0 MB, over the 100 MB limit\./)
    assert.equal(checkFile({ name: 'edge.mp4', size: 104_857_600 }, LIMITS), null, 'exactly the limit is allowed')
  })

  it('gives a file the kind the server gives it, and lets a person choose only for a PDF or a PowerPoint', () => {
    assert.equal(defaultKindForFile('deck.pptx'), 'presentation')
    assert.equal(defaultKindForFile('old.ppt'), 'presentation')
    assert.equal(defaultKindForFile('sheet.xlsx'), 'document')
    assert.equal(defaultKindForFile('brief.pdf'), 'document')
    assert.equal(defaultKindForFile('shot.PNG'), 'image')
    assert.equal(defaultKindForFile('clip.mov'), 'video')
    assert.deepEqual(kindChoicesForFile('brief.pdf'), ['presentation', 'document'])
    assert.deepEqual(kindChoicesForFile('deck.pptx'), ['presentation', 'document'])
    assert.deepEqual(kindChoicesForFile('shot.png'), ['image'])
    assert.deepEqual(kindChoicesForFile('clip.mp4'), ['video'])
    assert.deepEqual(kindChoicesForFile('notes.docx'), ['document'])
  })

  it('titles a file by its name without the extension', () => {
    assert.equal(titleFromFileName('ScholarClone-Client-Presentation.pptx'), 'ScholarClone-Client-Presentation')
    assert.equal(titleFromFileName('a.b.c.pdf'), 'a.b.c')
    assert.equal(titleFromFileName('.hidden'), '.hidden')
    assert.equal(titleFromFileName('plain'), 'plain')
  })
})

describe('what an entry is called, what its tile draws, and its main action', () => {
  it('opens an address in a new tab: the interactive deck is called so, any other address is a link', () => {
    const deck = link({ kind: 'presentation', url: '/signals/portfolio/deck/scholarclone' })
    assert.deepEqual(primaryAction(deck), { id: 'open-link', label: 'Open interactive deck' })
    assert.equal(typeWord(deck), 'Interactive deck')
    assert.deepEqual(primaryAction(link({ kind: 'document' })), { id: 'open-link', label: 'Open link' })
    assert.equal(typeWord(link({ kind: 'video' })), 'Video link')
    assert.equal(secondaryAction(deck), null, 'an address is not saved')
  })

  it('never offers Download for an address, and never an action for an address that is not safe', () => {
    const unsafe = link({ url: 'javascript:alert(1)' })
    assert.equal(primaryAction(unsafe), null)
    assert.equal(primaryAction(link({ url: '//evil.test/x' })), null)
    assert.equal(primaryAction(link({ url: 'http://example.com' })), null, 'plain http is not accepted either')
  })

  it('downloads a PowerPoint, previews a PDF and a picture, plays a video, and downloads anything else', () => {
    const ppt = kitItem({ kind: 'presentation', fileName: 'deck.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
    assert.deepEqual(primaryAction(ppt), { id: 'download', label: 'Download PowerPoint' })
    assert.equal(typeWord(ppt), 'PowerPoint')
    assert.deepEqual(primaryAction(kitItem({ fileName: 'a.pdf', mimeType: 'application/pdf' })), { id: 'preview', label: 'Preview PDF' })
    assert.deepEqual(primaryAction(kitItem({ kind: 'image', fileName: 'a.png', mimeType: 'image/png' })), { id: 'preview', label: 'Preview image' })
    assert.deepEqual(primaryAction(kitItem({ kind: 'video', fileName: 'a.mp4', mimeType: 'video/mp4', size: 5_000_000 })), { id: 'play', label: 'Play video' })
    assert.deepEqual(primaryAction(kitItem({ fileName: 'a.docx', mimeType: null })), { id: 'download', label: 'Download' })
    assert.deepEqual(primaryAction(kitItem({ fileName: 'a.xlsx', mimeType: null })), { id: 'download', label: 'Download' })
  })

  it('offers Download beside Preview and Play, and nowhere else', () => {
    assert.deepEqual(secondaryAction(kitItem({ fileName: 'a.pdf', mimeType: 'application/pdf' })), { id: 'download', label: 'Download' })
    assert.deepEqual(secondaryAction(kitItem({ kind: 'video', fileName: 'a.mp4', mimeType: 'video/mp4', size: 1000 })), { id: 'download', label: 'Download' })
    assert.equal(secondaryAction(kitItem({ fileName: 'a.docx', mimeType: null })), null, 'it already downloads')
    assert.equal(secondaryAction(kitItem({ kind: 'presentation', fileName: 'a.pptx', mimeType: null })), null)
  })

  it('offers a video of more than 100 MB as a download, not a player, and plays exactly 100 MB', () => {
    const video = (size: number) => kitItem({ kind: 'video', fileName: 'big.mp4', mimeType: 'video/mp4', size })
    assert.deepEqual(primaryAction(video(VIDEO_PLAY_LIMIT_BYTES + 1)), { id: 'download', label: 'Download video' })
    assert.deepEqual(primaryAction(video(VIDEO_PLAY_LIMIT_BYTES)), { id: 'play', label: 'Play video' })
    assert.equal(secondaryAction(video(VIDEO_PLAY_LIMIT_BYTES + 1)), null)
  })

  it('gives a file that is gone no action at all, and a tile that says so', () => {
    const gone = kitItem({ missing: true, fileName: null, mimeType: null, size: null })
    assert.equal(primaryAction(gone), null)
    assert.equal(secondaryAction(gone), null)
    assert.equal(tileOf(gone), 'missing')
  })

  it('chooses the tile: a thumbnail for a picture, a play tile for a video, a glyph for a file, a link tile for an address', () => {
    assert.equal(tileOf(kitItem({ kind: 'image', fileName: 'a.png', mimeType: 'image/png', size: 900_000 })), 'thumbnail')
    assert.equal(tileOf(kitItem({ kind: 'image', fileName: 'a.png', mimeType: 'image/png', size: THUMBNAIL_LIMIT_BYTES + 1 })), 'file', 'too big to read into the grid')
    assert.equal(tileOf(kitItem({ kind: 'video', fileName: 'a.mp4', mimeType: 'video/mp4' })), 'video')
    assert.equal(tileOf(kitItem({ fileName: 'a.pdf' })), 'file')
    assert.equal(tileOf(link()), 'link')
  })

  it('knows a file by its mime type when its name has no extension', () => {
    assert.equal(fileFamily({ fileName: 'download', mimeType: 'application/pdf' }), 'pdf')
    assert.equal(fileFamily({ fileName: null, mimeType: 'image/webp' }), 'image')
    assert.equal(fileFamily({ fileName: null, mimeType: 'video/webm' }), 'video')
    assert.equal(fileFamily({ fileName: null, mimeType: null }), 'other')
  })

  it('writes who added it and when, or only when, or nothing', () => {
    assert.equal(addedText({ createdAt: '2026-11-20 10:00:00', createdByName: 'Asha Rao' }), 'Added by Asha Rao on 20 Nov 2026')
    assert.equal(addedText({ createdAt: '2026-11-20T10:00:00+05:30', createdByName: null }), 'Added on 20 Nov 2026')
    assert.equal(addedText({ createdAt: 'not a date', createdByName: 'Asha Rao' }), 'Added by Asha Rao')
    assert.equal(addedText({ createdAt: '', createdByName: null }), '')
  })

  it('allows an address only when it is https or a single-slash path', () => {
    assert.equal(linkHref('https://example.com/a?b=1'), 'https://example.com/a?b=1')
    assert.equal(linkHref(' /signals/portfolio/deck/scholarclone '), '/signals/portfolio/deck/scholarclone')
    assert.equal(linkHref('/'), '/')
    for (const bad of ['http://example.com', '//example.com', 'javascript:alert(1)', 'data:text/html,x', 'example.com', '', null, undefined, 'https://', 'https:// x']) assert.equal(linkHref(bad), null, String(bad))
  })
})

describe('what an empty shelf says', () => {
  it('tells a person who only looks what will appear, and does not mention buttons they do not have', () => {
    const text = emptyText({ filter: 'all', canAdd: false, total: 0 })
    assert.equal(text.title, 'The Sales Kit is empty')
    assert.match(text.description, /will appear here once your team adds them/)
    assert.doesNotMatch(`${text.title} ${text.description}`, /\b(upload|add to|button)\b/i)
  })

  it('tells a manager how to start, and the three ways in', () => {
    const text = emptyText({ filter: 'all', canAdd: true, total: 0 })
    assert.equal(text.title, 'Start the Sales Kit')
    assert.match(text.description, /Upload a deck/)
    assert.match(text.description, /add a link/)
    assert.match(text.description, /Document Library/)
  })

  it('says a kind has nothing yet, and points a manager at the Add button and a viewer back to All', () => {
    const manager = emptyText({ filter: 'video', canAdd: true, total: 4 })
    assert.equal(manager.title, 'No videos yet')
    assert.match(manager.description, /Add to Sales Kit/)
    const viewer = emptyText({ filter: 'presentation', canAdd: false, total: 4 })
    assert.equal(viewer.title, 'No demo presentations yet')
    assert.match(viewer.description, /Choose All/)
    assert.doesNotMatch(viewer.description, /Add to Sales Kit/)
  })
})

describe('the forms\' checks', () => {
  it('asks for a title, and for an address in a link', () => {
    assert.deepEqual(entryFormErrors({ title: '  ' }), { title: 'Give it a title.' })
    assert.deepEqual(entryFormErrors({ title: 'Deck', url: '' }), { url: 'Paste the address.' })
    assert.deepEqual(entryFormErrors({ title: 'Deck', url: 'ftp://x.test/file' }), { url: 'Use an address that starts with https:// or a path that starts with /.' })
    assert.deepEqual(entryFormErrors({ title: 'Deck', url: 'https://example.com/deck' }), {})
    assert.deepEqual(entryFormErrors({ title: 'Deck', url: '/signals/portfolio/deck/scholarclone', description: 'Short' }), {})
  })

  it('does not ask for an address when the entry is a file (the url is not given)', () => {
    assert.deepEqual(entryFormErrors({ title: 'Deck' }), {})
  })

  it('keeps the title under 191 characters and the description under 500, as the server does', () => {
    assert.equal(entryFormErrors({ title: 'a'.repeat(191) }).title, undefined)
    assert.match(entryFormErrors({ title: 'a'.repeat(192) }).title!, /191/)
    assert.equal(entryFormErrors({ title: 'T', description: 'd'.repeat(500) }).description, undefined)
    assert.match(entryFormErrors({ title: 'T', description: 'd'.repeat(501) }).description!, /500/)
  })
})

describe('adding from the Document Library', () => {
  const hit = (over = {}) => ({ visibility: 'organization', ownedByMe: false, ...over })

  it('adds a document that is shared with the organisation with no question', () => {
    assert.deepEqual(shareDecision(hit(), false), { canAdd: true, needsAgreement: false, makeShared: false, note: null })
    assert.equal(visibilityText(hit()), 'Shared with your organisation')
  })

  it('asks the owner of an unshared document to share it first, and sends makeShared only when they agree', () => {
    const mine = hit({ visibility: 'private', ownedByMe: true })
    assert.equal(shareDecision(mine, false).canAdd, false)
    assert.equal(shareDecision(mine, false).needsAgreement, true)
    assert.equal(shareDecision(mine, false).makeShared, false)
    assert.deepEqual([shareDecision(mine, true).canAdd, shareDecision(mine, true).makeShared], [true, true])
    assert.equal(visibilityText(mine), 'Only you can open it')
  })

  it('does not let anybody add an unshared document that is not theirs, and says who can fix it', () => {
    const theirs = hit({ visibility: 'private', ownedByMe: false })
    for (const agreed of [false, true]) {
      const decision = shareDecision(theirs, agreed)
      assert.deepEqual([decision.canAdd, decision.makeShared, decision.needsAgreement], [false, false, false], `agreed=${agreed}`)
      assert.match(decision.note!, /Only its owner can share it/)
    }
    assert.equal(visibilityText(theirs), 'Not shared with your organisation')
  })
})

describe('the public link', () => {
  const deck = () => link({ kind: 'presentation', url: '/signals/portfolio/deck/scholarclone' })

  it('is the origin of this site, then /share/kit/, then the token, whatever slash the origin ends with', () => {
    assert.equal(publicShareUrl('https://g2gv0.vercel.app', 'Tabc123'), 'https://g2gv0.vercel.app/share/kit/Tabc123')
    assert.equal(publicShareUrl('https://g2gv0.vercel.app/', 'Tabc123'), 'https://g2gv0.vercel.app/share/kit/Tabc123')
    assert.equal(publicShareUrl('http://localhost:3000///', 'x'), 'http://localhost:3000/share/kit/x')
    assert.equal(publicShareUrl('https://a.test', 'a/b?c'), 'https://a.test/share/kit/a%2Fb%3Fc', 'a token is never able to change the path')
  })

  it('offers 7 days, 30 days, 90 days, 1 year and no expiry, and starts on No expiry', () => {
    assert.deepEqual(SHARE_DAY_CHOICES.map((c) => [c.value, c.label]), [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year'], [0, 'No expiry']])
    assert.equal(DEFAULT_SHARE_DAYS, 0)
    assert.ok(SHARE_DAY_CHOICES.some((c) => c.value === DEFAULT_SHARE_DAYS))
  })

  it('says when a link stops: until a date, never, or expired on a date', () => {
    assert.equal(shareExpiryText({ expiresAt: '2026-12-27 12:00:00', expired: false }), 'Works until 27 Dec 2026')
    assert.equal(shareExpiryText({ expiresAt: '2026-12-27T12:00:00+05:30', expired: false }), 'Works until 27 Dec 2026')
    assert.equal(shareExpiryText({ expiresAt: null, expired: false }), 'Never expires')
    assert.equal(shareExpiryText({ expiresAt: '2026-11-01 08:00:00', expired: true }), 'Expired on 1 Nov 2026')
    assert.equal(shareExpiryText({ expiresAt: 'soon', expired: false }), 'Works for a limited time', 'a date the browser cannot read is not invented')
    assert.equal(shareExpiryText({ expiresAt: 'soon', expired: true }), 'Expired')
  })

  it('trusts the server\'s word that a link has expired, not the clock of the person\'s computer', () => {
    assert.equal(shareExpiryText({ expiresAt: '2020-01-01 00:00:00', expired: false }), 'Works until 1 Jan 2020', 'a past date with expired=false is still reported as the server says')
    assert.equal(isLiveShare({ share: fakeShare(1, 30) }), true)
    assert.equal(isLiveShare({ share: fakeShare(1, 30, { expired: true }) }), false)
    assert.equal(isLiveShare({ share: null }), false)
    assert.equal(isLiveShare({}), false, 'a server with no share link says nothing')
  })

  it('can be had by a file, an address on the web and the interactive deck, and by no other page inside the app', () => {
    assert.equal(canShare(kitItem({ fileName: 'a.pdf' })), true)
    assert.equal(canShare(link({ url: 'https://example.com/video' })), true)
    assert.equal(canShare(deck()), true)
    assert.equal(canShare(link({ url: '/module/lms/learning/courses/7' })), false, 'a page that needs a sign-in')
    assert.equal(canShare(link({ url: '/signals/portfolio' })), false)
    assert.equal(canShare(link({ url: '/signals/portfolio/deck/' })), false, 'a deck with no key')
    assert.equal(canShare(link({ url: '/signals/portfolio/deck/a/b' })), false)
    assert.equal(canShare(link({ url: 'javascript:alert(1)' })), false)
    assert.equal(canShare(link({ url: 'http://example.com' })), false)
    assert.equal(canShare(link({ url: null })), false)
    assert.equal(canShare(kitItem({ missing: true, fileName: null })), false, 'a file that is gone has nothing to share')
  })

  it('reads the deck key out of the deck path and nothing else', () => {
    assert.equal(deckKeyOf('/signals/portfolio/deck/scholarclone'), 'scholarclone')
    assert.equal(deckKeyOf('/signals/portfolio/deck/scholar-clone/'), 'scholar-clone')
    for (const bad of ['/module/lms/learning/client-presentation/scholarclone', '/signals/portfolio/deck/Up', '/signals/portfolio/deck/a.b', 'https://x.test/signals/portfolio/deck/scholarclone', '', null, undefined]) assert.equal(deckKeyOf(bad), null, String(bad))
  })

  it('marks a card Shared, or Link expired, or nothing', () => {
    assert.equal(shareMark({ share: fakeShare(1, 30) }), 'Shared')
    assert.equal(shareMark({ share: fakeShare(1, 30, { expired: true }) }), 'Link expired')
    assert.equal(shareMark({ share: null }), null)
    assert.equal(shareMark({}), null)
  })

  it('lets a manager make, renew and stop a link, and a viewer only copy a live one', () => {
    assert.equal(shareMode({ share: null }, true), 'create')
    assert.equal(shareMode({ share: fakeShare(1, 30) }, true), 'manage')
    assert.equal(shareMode({ share: fakeShare(1, 30, { expired: true }) }, true), 'manage')
    assert.equal(shareMode({ share: fakeShare(1, 30) }, false), 'copy')
    assert.equal(shareMode({ share: fakeShare(1, 30, { expired: true }) }, false), 'expired')
    assert.equal(shareMode({ share: null }, false), 'none', 'a viewer with no link is offered nothing')
  })

  it('draws "Share link" for a manager on anything that can be shared, and for a viewer only where a link exists', () => {
    const file = kitItem({ fileName: 'a.pdf' })
    const shared = kitItem({ fileName: 'a.pdf', share: fakeShare(1, 30) })
    assert.equal(showShareLink(file, true), true)
    assert.equal(showShareLink(file, false), false)
    assert.equal(showShareLink(shared, false), true)
    assert.equal(showShareLink(shared, true), true)
    assert.equal(showShareLink(link({ url: '/module/crm/x' }), true), false, 'an unshareable page has none, for anyone')
    assert.equal(showShareLink(kitItem({ missing: true, fileName: null, share: fakeShare(1, 30) }), false), false)
  })
})
