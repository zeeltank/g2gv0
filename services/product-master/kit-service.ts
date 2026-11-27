import { apiClient } from '@/services/core'
import type { KitData, KitEnvelope, KitFileMeta, KitFromLibraryBody, KitItem, KitLibraryHit, KitLinkBody, KitShareDays, KitUpdateBody } from './kit-types'

/** What the Sales Kit tab needs from the server. Components take this shape, so a test can hand them a fake. */
export interface SalesKitApi {
  /** The Product's kit: its entries in order, the counts, what the caller may do, and the upload limits. A host without the table answers 503 with a sentence that says so. */
  get(productId: number): Promise<KitEnvelope<KitData>>
  /**
   * One file. `onProgress` is given a fraction between 0 and 1 by a transport that can report it. The shared client sends a file with `fetch`, which cannot, so the real
   * service never calls it and the screen shows "Uploading" without a percentage.
   */
  uploadFile(productId: number, file: File, meta?: KitFileMeta, onProgress?: (fraction: number) => void): Promise<KitEnvelope<KitItem>>
  addLink(productId: number, body: KitLinkBody): Promise<KitEnvelope<KitItem>>
  fromLibrary(productId: number, body: KitFromLibraryBody): Promise<KitEnvelope<KitItem>>
  /** Documents the caller may add (at most 20, newest first, not already in this kit). The server needs at least two characters. */
  searchLibrary(productId: number, q: string): Promise<KitEnvelope<KitLibraryHit[]>>
  update(productId: number, itemId: number, patch: KitUpdateBody): Promise<KitEnvelope<KitItem>>
  remove(productId: number, itemId: number): Promise<KitEnvelope<{ id: number }>>
  /** The file's bytes (a 404 for a link). `inline` asks for the file to be shown rather than saved. */
  fetchFile(productId: number, itemId: number, options?: { inline?: boolean }): Promise<Blob>
  /**
   * Makes the public link of an entry, or renews it: a new token, and the old link stops at once. `days` is how long it works (the server's default is 30; 0 is no expiry). The entry comes
   * back with its `share`. A 422 says why it cannot be shared (a page inside the app, a file that is gone); a 503 says the server has no share link yet.
   */
  share(productId: number, itemId: number, body?: { days?: KitShareDays }): Promise<KitEnvelope<KitItem>>
  /** Stops sharing. The entry comes back with `share: null`. Stopping a link that is already stopped is fine. */
  stopSharing(productId: number, itemId: number): Promise<KitEnvelope<KitItem>>
}

const BASE = '/product-master'
const enc = (value: number) => encodeURIComponent(String(value))
const kitPath = (productId: number) => `${BASE}/${enc(productId)}/kit`

/** The Sales Kit API. A refusal arrives as an ApiError whose `status` is 401, 403, 404, 422 or 503 and whose `message` is the server's own sentence. */
export const salesKitService: SalesKitApi = {
  get: (productId) => apiClient.get(kitPath(productId)),

  uploadFile: (productId, file, meta = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (meta.title) form.append('title', meta.title)
    if (meta.description) form.append('description', meta.description)
    if (meta.kind) form.append('kind', meta.kind)
    return apiClient.postForm(`${kitPath(productId)}/files`, form)
  },

  addLink: (productId, body) => apiClient.post(`${kitPath(productId)}/links`, body),

  fromLibrary: (productId, body) => apiClient.post(`${kitPath(productId)}/from-library`, body),

  searchLibrary: (productId, q) => apiClient.get(`${kitPath(productId)}/library-search`, { q }),

  update: (productId, itemId, patch) => apiClient.patch(`${kitPath(productId)}/${enc(itemId)}`, patch),

  remove: (productId, itemId) => apiClient.delete(`${kitPath(productId)}/${enc(itemId)}`),

  fetchFile: (productId, itemId, options = {}) => apiClient.getBlob(`${kitPath(productId)}/${enc(itemId)}/download`, options.inline ? { inline: '1' } : undefined),

  share: (productId, itemId, body = {}) => apiClient.post(`${kitPath(productId)}/${enc(itemId)}/share`, body.days === undefined ? {} : { days: body.days }),

  stopSharing: (productId, itemId) => apiClient.delete(`${kitPath(productId)}/${enc(itemId)}/share`),
}
