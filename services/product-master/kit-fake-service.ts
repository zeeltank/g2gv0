import { ApiError } from '@/services/core'
import type { SalesKitApi } from './kit-service'
import type { KitCan, KitCounts, KitData, KitFileMeta, KitFromLibraryBody, KitItem, KitKind, KitLibraryHit, KitLimits, KitLinkBody, KitShare, KitUpdateBody } from './kit-types'

/*
 * A stand-in for the Sales Kit API for the tests of the tab: the kit is held in memory, so an add, an edit and a remove show up in the next read, and every call is recorded exactly as the
 * screen made it. Nothing here touches the network. `overrides` replace what a method answers (or throws), for a refusal or a slow answer.
 */

export const KIT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov']

export const ALL_RIGHTS: KitCan = { view: true, add: true, edit: true, delete: true }
export const VIEW_ONLY: KitCan = { view: true, add: false, edit: false, delete: false }

let nextId = 100

/** The moment the fake treats as now, so an expiry a test reads is the same every day. */
export const FAKE_NOW = '2026-11-27 12:00:00'

/** A 48-character token of letters and digits, as the server makes them. `n` makes each different. */
export const fakeToken = (n: number): string => `T${String(n).padStart(47, 'a')}`

/** The share a fake link gets: `days` after `FAKE_NOW`, or never when 0. */
export function fakeShare(n: number, days: number, over: Partial<KitShare> = {}): KitShare {
  const end = new Date(`${FAKE_NOW.replace(' ', 'T')}Z`)
  end.setUTCDate(end.getUTCDate() + days)
  return { token: fakeToken(n), expiresAt: days === 0 ? null : end.toISOString().slice(0, 19).replace('T', ' '), sharedAt: FAKE_NOW, expired: false, ...over }
}

/** One entry of a kit, a file by default, with the fields a test cares about changed. */
export function kitItem(over: Partial<KitItem> = {}): KitItem {
  const id = over.id ?? nextId++
  const link = over.source === 'link' || (over.url ?? null) !== null
  return {
    id,
    kind: 'document',
    title: `Entry ${id}`,
    description: null,
    source: link ? 'link' : 'file',
    documentId: link ? null : 500 + id,
    fileName: link ? null : `entry-${id}.pdf`,
    mimeType: link ? null : 'application/pdf',
    size: link ? null : 2_400_000,
    url: link ? 'https://example.com/page' : null,
    sortOrder: 0,
    createdBy: 7,
    createdByName: 'Asha Rao',
    createdAt: '2026-11-20 10:00:00',
    updatedAt: '2026-11-20 10:00:00',
    missing: false,
    share: null,
    ...over,
  }
}

export function countsOf(items: readonly KitItem[]): KitCounts {
  const counts: KitCounts = { all: items.length, presentation: 0, document: 0, video: 0, image: 0 }
  for (const item of items) counts[item.kind] += 1
  return counts
}

export function kitData(items: KitItem[] = [], over: Partial<KitData> = {}): KitData {
  return {
    product: { id: 1, name: 'ScholarClone' },
    items,
    counts: countsOf(items),
    can: ALL_RIGHTS,
    limits: { maxUploadKb: 102400, extensions: KIT_EXTENSIONS },
    ...over,
  }
}

/** The ScholarClone shelf: the interactive deck (a link), the PowerPoint, a PDF, a video and a picture. */
export function scholarcloneItems(): KitItem[] {
  return [
    kitItem({ id: 1, sortOrder: 1, kind: 'presentation', title: 'What is your school not seeing?', description: 'The 28-slide interactive deck to present on a call.', source: 'link', documentId: null, fileName: null, mimeType: null, size: null, url: '/signals/portfolio/deck/scholarclone' }),
    kitItem({ id: 2, sortOrder: 2, kind: 'presentation', title: 'ScholarClone client presentation', description: 'The same story as a PowerPoint, with the demo videos inside.', fileName: 'ScholarClone-Client-Presentation.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 57_400_000 }),
    kitItem({ id: 3, sortOrder: 3, kind: 'document', title: 'Fee collection one-pager', description: 'What it does and who it is for, on one page.', fileName: 'fee-collection.pdf', mimeType: 'application/pdf', size: 480_000 }),
    kitItem({ id: 4, sortOrder: 4, kind: 'video', title: 'Admissions walkthrough', description: 'Four minutes, from enquiry to seat.', fileName: 'admissions.mp4', mimeType: 'video/mp4', size: 38_000_000 }),
    kitItem({ id: 5, sortOrder: 5, kind: 'image', title: 'Dashboard screenshot', description: null, fileName: 'dashboard.png', mimeType: 'image/png', size: 910_000 }),
  ]
}

export interface KitFakeCalls {
  get: number[]
  uploadFile: Array<{ productId: number; name: string; size: number; meta?: KitFileMeta }>
  addLink: Array<{ productId: number; body: KitLinkBody }>
  fromLibrary: Array<{ productId: number; body: KitFromLibraryBody }>
  searchLibrary: Array<{ productId: number; q: string }>
  update: Array<{ productId: number; itemId: number; patch: KitUpdateBody }>
  remove: Array<{ productId: number; itemId: number }>
  share: Array<{ productId: number; itemId: number; days?: number }>
  stopSharing: Array<{ productId: number; itemId: number }>
  fetchFile: Array<{ productId: number; itemId: number; inline: boolean }>
}

export interface KitFakeOptions {
  items?: KitItem[]
  can?: KitCan
  limits?: KitLimits
  product?: { id: number; name: string }
  /** What a library search answers (default: none). */
  library?: KitLibraryHit[]
  /** The bytes a download answers with, by entry id (default: a few bytes typed from the entry's mime type). */
  blobs?: Record<number, Blob>
  overrides?: Partial<SalesKitApi>
}

const kindOfFile = (name: string): KitKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ppt' || ext === 'pptx') return 'presentation'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  return 'document'
}

export function fakeSalesKitService(options: KitFakeOptions = {}) {
  const items: KitItem[] = [...(options.items ?? scholarcloneItems())]
  const calls: KitFakeCalls = { get: [], uploadFile: [], addLink: [], fromLibrary: [], searchLibrary: [], update: [], remove: [], share: [], stopSharing: [], fetchFile: [] }
  const overrides = options.overrides ?? {}
  const state = { items }
  let tokens = 0
  const snapshot = (): KitData => kitData(
    [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id),
    { product: options.product ?? { id: 1, name: 'ScholarClone' }, can: options.can ?? ALL_RIGHTS, ...(options.limits ? { limits: options.limits } : {}) },
  )
  const find = (itemId: number): KitItem => {
    const found = items.find((i) => i.id === itemId)
    if (!found) throw new ApiError('That entry is not in this Product\'s Sales Kit.', 404)
    return found
  }

  const service: SalesKitApi = {
    get: async (productId) => { calls.get.push(productId); return overrides.get ? overrides.get(productId) : { status: 1, data: snapshot() } },
    uploadFile: async (productId, file, meta, onProgress) => {
      calls.uploadFile.push({ productId, name: file.name, size: file.size, meta })
      if (overrides.uploadFile) return overrides.uploadFile(productId, file, meta, onProgress)
      onProgress?.(0.5)
      onProgress?.(1)
      const item = kitItem({ kind: meta?.kind ?? kindOfFile(file.name), title: meta?.title || file.name.replace(/\.[^.]+$/, ''), description: meta?.description || null, fileName: file.name, mimeType: file.type || null, size: file.size })
      items.push(item)
      return { status: 1, data: item }
    },
    addLink: async (productId, body) => {
      calls.addLink.push({ productId, body })
      if (overrides.addLink) return overrides.addLink(productId, body)
      const item = kitItem({ kind: body.kind, title: body.title, description: body.description ?? null, source: 'link', documentId: null, fileName: null, mimeType: null, size: null, url: body.url })
      items.push(item)
      return { status: 1, data: item }
    },
    fromLibrary: async (productId, body) => {
      calls.fromLibrary.push({ productId, body })
      if (overrides.fromLibrary) return overrides.fromLibrary(productId, body)
      const hit = (options.library ?? []).find((h) => h.id === body.documentId)
      const item = kitItem({ kind: body.kind ?? kindOfFile(hit?.fileName ?? ''), title: body.title || hit?.title || 'Document', description: body.description ?? null, documentId: body.documentId, fileName: hit?.fileName ?? null, mimeType: hit?.mimeType ?? null, size: hit?.size ?? null })
      items.push(item)
      return { status: 1, data: item }
    },
    searchLibrary: async (productId, q) => {
      calls.searchLibrary.push({ productId, q })
      if (overrides.searchLibrary) return overrides.searchLibrary(productId, q)
      const needle = q.trim().toLowerCase()
      return { status: 1, data: (options.library ?? []).filter((h) => h.title.toLowerCase().includes(needle) || (h.fileName ?? '').toLowerCase().includes(needle)) }
    },
    update: async (productId, itemId, patch) => {
      calls.update.push({ productId, itemId, patch })
      if (overrides.update) return overrides.update(productId, itemId, patch)
      const item = find(itemId)
      Object.assign(item, patch)
      return { status: 1, data: item }
    },
    remove: async (productId, itemId) => {
      calls.remove.push({ productId, itemId })
      if (overrides.remove) return overrides.remove(productId, itemId)
      find(itemId)
      items.splice(items.findIndex((i) => i.id === itemId), 1)
      return { status: 1, data: { id: itemId } }
    },
    share: async (productId, itemId, body = {}) => {
      calls.share.push({ productId, itemId, days: body.days })
      if (overrides.share) return overrides.share(productId, itemId, body)
      if (options.can && !options.can.edit) throw new ApiError('You are not allowed to do this.', 403)
      const item = find(itemId)
      // The server's own rules: a page inside the app cannot be public (the interactive deck is the one exception), and a file that is gone has nothing to share.
      if (item.missing) throw new ApiError('Its file is no longer in the Document Library, so it cannot be shared.', 422)
      if (item.source === 'link' && (item.url ?? '').startsWith('/') && !/^\/signals\/portfolio\/deck\/[a-z0-9-]+$/.test(item.url ?? '')) throw new ApiError('A page inside the app cannot be shared publicly.', 422)
      item.share = fakeShare(++tokens, body.days ?? 30)
      return { status: 1, data: item }
    },
    stopSharing: async (productId, itemId) => {
      calls.stopSharing.push({ productId, itemId })
      if (overrides.stopSharing) return overrides.stopSharing(productId, itemId)
      if (options.can && !options.can.edit) throw new ApiError('You are not allowed to do this.', 403)
      const item = find(itemId)
      item.share = null
      return { status: 1, data: item }
    },
    fetchFile: async (productId, itemId, fetchOptions = {}) => {
      calls.fetchFile.push({ productId, itemId, inline: fetchOptions.inline === true })
      if (overrides.fetchFile) return overrides.fetchFile(productId, itemId, fetchOptions)
      const item = find(itemId)
      if (item.source === 'link') throw new ApiError('That entry is a link, not a file.', 404)
      return options.blobs?.[itemId] ?? new Blob(['bytes'], { type: item.mimeType ?? 'application/octet-stream' })
    },
  }

  return { service, calls, state }
}
