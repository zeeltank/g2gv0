/**
 * The Sales Kit API of a Product (hp_erp `/api/product-master/{id}/kit`, contract Docs/agentic-crm/briefs/SALES-KIT-CONTRACT.md). The shelf a salesperson opens before a call:
 * demo presentations, documents, videos and images for one Product. A file lives in the Document Library (the row points at it); a link is a web address, such as the interactive deck.
 * The organisation and the person come from the bearer token the shared client sends, never from a parameter.
 */

export type KitKind = 'presentation' | 'document' | 'video' | 'image'
export type KitSource = 'file' | 'link'

export interface KitItem {
  id: number
  kind: KitKind
  title: string
  /** What it is for, in a line. */
  description: string | null
  /** `file` has a Document Library document behind it, `link` has an address. */
  source: KitSource
  documentId: number | null
  fileName: string | null
  mimeType: string | null
  /** Bytes. */
  size: number | null
  /** An `https://` address, or an app path that starts with `/` (the web deck). Null for a file. */
  url: string | null
  sortOrder: number
  createdBy: number | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
  /** The document was deleted from the Document Library: the row stays, `fileName` is null, and only a manager can remove it. */
  missing: boolean
}

export interface KitCounts {
  all: number
  presentation: number
  document: number
  video: number
  image: number
}

/** What the caller may do with this Product's kit (the server works it out from the Sales Kit row of Role & Permissions). */
export interface KitCan {
  view: boolean
  add: boolean
  edit: boolean
  delete: boolean
}

export interface KitLimits {
  maxUploadKb: number
  /** Lower-case, without the dot: `pdf`, `pptx`, `mp4`, ... */
  extensions: string[]
}

export interface KitData {
  product: { id: number; name: string }
  items: KitItem[]
  counts: KitCounts
  can: KitCan
  limits: KitLimits
}

export interface KitEnvelope<T> {
  status: number
  data: T
}

/** What a person may say about a file when it is added; `kind` may override only a PDF or a PowerPoint (presentation or document). */
export interface KitFileMeta {
  title?: string
  description?: string
  kind?: KitKind
}

export interface KitLinkBody {
  title: string
  url: string
  kind: KitKind
  description?: string
}

export interface KitFromLibraryBody {
  documentId: number
  title?: string
  description?: string
  kind?: KitKind
  /** Only for a document its caller owns that is not yet shared with the organisation: makes it so, because a colleague who cannot open it would see "no access". */
  makeShared?: boolean
}

export interface KitUpdateBody {
  title?: string
  description?: string | null
  kind?: KitKind
  sortOrder?: number
  /** Link entries only. */
  url?: string
}

/** One document of the Document Library the caller may add to this kit. */
export interface KitLibraryHit {
  id: number
  title: string
  fileName: string | null
  mimeType: string | null
  size: number | null
  /** `organization` is the only value every colleague can open. */
  visibility: string
  ownedByMe: boolean
}
