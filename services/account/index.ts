import { apiClient, buildApiUrl } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { getDeviceId } from '@/lib/device-id'

/**
 * Your own account — the first self-service surface in this product.
 *
 * ── NOTHING HERE TAKES A USER ID ────────────────────────────────────────────
 *
 * Every endpoint resolves the subject from the token's owner. There is no
 * parameter that could name somebody else, which is why these are safe to call
 * from any role without a further guard: an employee and an administrator both
 * reach their own record and only their own.
 */

/** The employment facts a person may see about themselves but not change. */
export type AccountWork = {
  /** From `s_user_jobrole` via `jobtitle_id` - NOT `s_jobrole`; see the server. */
  job_title: string | null
  department: string | null
  /** Null for every live user today: nothing populates `reporting_manager_id` yet. */
  reporting_manager: string | null
  employee_no: string | null
  /** Sparse - 14 of 299 live people have one. Omit it when null, do not print a dash. */
  joined_date: string | null
}

export type AccountProfile = {
  id: number
  email: string | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  name_suffix: string | null
  mobile: string | null
  gender: string | null
  birthdate: string | null
  address: string | null
  address_2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  image: string | null
  /** Built server-side from the object store — the frontend must not know the CDN host. */
  image_url: string | null
  employee_no: string | null
  last_login: string | null

  /**
   * WHO THIS PERSON IS AT WORK. READ-ONLY.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY THIS IS A SEPARATE OBJECT AND NOT MORE FIELDS ALONGSIDE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Everything above is editable by its owner. Nothing in here is - it belongs to
   * HR, and `AccountController::updateProfile` discards a write to any of it the
   * same way it discards an invented field.
   *
   * Nesting it says that in the type rather than in a comment somebody has to
   * find: a screen cannot accidentally drop `work.job_title` into a form and
   * wonder why saving does nothing, because it is not shaped like the fields that
   * save.
   *
   * It exists because this product had TWO profile screens. `/profile` fetched the
   * HRMS endpoints separately just to show a job title, while `/settings?s=profile`
   * was the only place anything could be changed - two sources of truth for one
   * person, with no reason to agree. This is the one source.
   */
  work: AccountWork | null
}

export type Theme = 'system' | 'light' | 'dark'

/**
 * Who may see a personal field, narrowest last.
 *
 * `everyone` is the default deliberately: changing what existing organisations
 * already see, silently, on the day of a deploy would break directories people
 * rely on. The honest move is to offer the choice, not to make it for them.
 */
export type Visibility = 'everyone' | 'department' | 'private'

export type AccountPreferences = {
  theme: Theme
  sidebar_collapsed: boolean
  density: 'comfortable' | 'compact'
  locale: string
  timezone: string
  date_format: string
  landing_page: 'dashboard' | 'last-visited'
  notify_email: boolean

  /*
   * How somebody presents themselves. Stored as preferences rather than as
   * columns on a 99-column `tbluser` - see UserPreferences::DEFAULTS.
   */
  display_name: string
  pronouns: string
  about: string

  /* Who may see the parts of a person that are not work. */
  visible_mobile: Visibility
  visible_birthdate: Visibility
  visible_address: Visibility
  /** One switch per event the dispatcher can send. */
  notify_events: Record<string, boolean>
}

/** What enrolment hands back so an app can be set up. */
export type TwoFactorEnrolment = {
  secret: string
  /** In groups of four, because this gets typed in by hand. */
  secret_grouped: string
  /**
   * `otpauth://…` — on a phone, tapping this opens the authenticator and enrols.
   *
   * There is no QR image: no encoder exists in either repository, and writing one
   * means Reed-Solomon error correction with no published vectors to check it
   * against. Tap-to-enrol and manual entry cover both devices without one.
   */
  uri: string
  digits: number
  period: number
}

/** One line of a person's security history. */
export type AccountActivityEntry = {
  /** `sign_in` comes from a token; `event` from the event store. */
  kind: 'sign_in' | 'event'
  type: string
  at: string | null
  /** The device label, on sign-ins only. */
  device: string | null
  detail: string | null
}

export type AccountSession = {
  id: number
  name: string
  last_used_at: string | null
  created_at: string | null
  expires_at: string | null
  /** The session making this request. It cannot be ended by id. */
  current: boolean
}

/** Which of this person's settings are pinned to the browser they are using. */
export type DeviceScope = {
  device_id: string
  /** False when the browser could not keep an id — private window, storage blocked. */
  is_device: boolean
  device_scoped_keys: string[]
}

export type AccountMe = {
  status: boolean
  data: {
    profile: AccountProfile
    preferences: AccountPreferences
    device_scope: DeviceScope
    /** Decides which SECTIONS are shown. Presentation only — every endpoint is guarded. */
    role: string | null
    notifiable_events: string[]
    /**
     * The subset of `notifiable_events` an email can actually be BUILT for.
     *
     * Three of the ten have an in-app template and no email one, so they can
     * never be emailed. The screen marks them rather than offering a switch
     * that changes nothing.
     */
    emailable_events: string[]
    /**
     * Whether two-step verification is on, and how much fallback is left.
     *
     * Read from here rather than from a call of its own: this payload is already
     * fetched once per session and held in `PreferencesProvider`, so the badge is
     * right the moment Sign-in & security opens. `recovery_codes_left` is a COUNT
     * and never the codes — those exist in readable form exactly once, in the
     * response that issues them.
     */
    two_factor: {
      enabled: boolean
      recovery_codes_left: number
      /**
       * Whether the ORGANISATION obliges this person to have it on.
       *
       * True with `enabled: false` means every other endpoint is returning 403 —
       * `RequireTwoFactorEnrolment` refuses everything but this payload and the two
       * enrolment calls. It is what lets the screen explain a product that has
       * apparently stopped working, instead of leaving somebody to conclude it is
       * broken.
       */
      required: boolean
    }
    choices: {
      theme: Theme[]
      landing_page: string[]
      date_format: string[]
    }
  }
}

/**
 * Auth plus this browser's identity.
 *
 * `device_id` rides on every account call, read and write. The server decides
 * which keys it applies to (`UserPreferences::DEVICE_SCOPED` — theme, sidebar,
 * density) and stores everything else against the account, so no caller here has
 * to know or remember the distinction.
 */
function params(context: LaravelContext) {
  return {
    ...(context.token ? { type: 'api', token: context.token } : {}),
    ...(getDeviceId() ? { device_id: getDeviceId() } : {}),
  }
}

/** One row in the Document Library — personal, generated, or org-wide. */
export interface AccountDocument {
  id: number
  title: string | null
  /** An open key from `document_types` below (e.g. "resume", "payslip") — look up its label there. */
  document_type: string | null
  category: 'personnel' | 'organization' | null
  original_file_name: string | null
  mime_type: string | null
  size: number | null
  visibility: 'private' | 'department' | 'organization' | null
  /** 'done' is searchable/browsable. Earlier states only ever appear on the uploader's own list. */
  processing_status: 'pending' | 'processing' | 'ready_for_review' | 'done' | 'failed' | null
  /** Set when this row indexes a document that still lives in another feature's own table (see DocumentLibraryController). */
  source_system: string | null
  document_date: string | null
  created_at: string | null
}

/** key -> display label, grouped the way config/documents.php defines them. */
export type DocumentTypeChoices = {
  personnel: Record<string, string>
  organization: Record<string, string>
}

/**
 * The same shape for your own documents and for an employee's.
 *
 * Named and shared deliberately: the two lists used to come from two different
 * queries with different joins, which is how the employee and HR ended up
 * seeing different documents for the same person. One type, one endpoint
 * family, one answer.
 */
export interface AccountDocumentsResponse {
  status: number
  data: AccountDocument[]
  document_types: DocumentTypeChoices
}

/** One search hit — AccountDocument plus a highlighted content excerpt when a query matched inside the file. */
export interface DocumentSearchHit extends AccountDocument {
  owner_id: number | null
  department_id: number | null
  tags: string | null
  /** HTML with `<mark>` around the match — from the document's own content, not just its title. */
  snippet: string | null
  /** Has the CALLING user starred this one — per-viewer, not a fact about the document itself (see the stars migration's own docblock). */
  starred: boolean
}

/** One row from `/documents/recent` — a DocumentSearchHit plus when THIS caller last actually opened it. */
export interface RecentDocumentHit extends DocumentSearchHit {
  last_viewed_at: string
}

export interface DocumentSearchResponse {
  status: number
  data: DocumentSearchHit[]
  meta: { total: number; page: number; per_page: number }
  document_types: DocumentTypeChoices
}

/** One row in Trash — a soft-deleted document, still restorable until `purge_at`. */
export interface TrashedDocument extends AccountDocument {
  owner_id: number
  deleted_at: string
  /** Computed server-side from deleted_at + the retention window — not a stored column. */
  purge_at: string
}

export interface DocumentSearchFilters {
  q?: string
  category?: 'personnel' | 'organization'
  document_type?: string
  department_id?: number
  source_system?: string
  date_from?: string
  date_to?: string
  owner_id?: number
  /** Narrows to one folder's direct contents. 0 = root (folder_id IS NULL). Omit entirely to search unfiltered by folder, as before. */
  folder_id?: number
  page?: number
  per_page?: number
}

/** One folder, flat (as returned by `listFolders`). */
export interface DocumentFolder {
  id: number
  name: string
  parent_id: number | null
  owner_id: number | null
  department_id: number | null
  visibility: 'private' | 'department' | 'organization'
  sort_order: number
  created_at: string
}

/** One folder, nested (as returned by `getFolderTree` — the server already builds the tree, no client-side parent_id-walking needed). */
export interface DocumentFolderNode {
  id: number
  name: string
  parent_id: number | null
  owner_id: number | null
  department_id: number | null
  visibility: 'private' | 'department' | 'organization'
  children: DocumentFolderNode[]
}

/**
 * The step `ProcessDocumentPipelineJob` is actually running right now, for a
 * REAL (not simulated) staged progress indicator — see that job's own
 * docblock. `null` before the job has started (or for a document that never
 * needed it); `'done'`/`'failed'` are terminal.
 */
export type DocumentProcessingStep =
  | 'ocr'
  | 'checking_duplicates'
  | 'classifying'
  | 'done'
  | 'failed'
  | null

/** The full row — everything the list/search views omit for weight (extracted_text itself is never sent). */
export interface DocumentDetail extends AccountDocument {
  owner_id: number | null
  department_id: number | null
  current_version: number | null
  subject: string | null
  summary: string | null
  confidence: string | null
  keywords: string | null
  tags: string | null
  warnings: string | null
  processing_step: DocumentProcessingStep
  processing_error: string | null
  period_label: string | null
}

/** One row from `document_library_history` — a version or an audit entry, told apart by `entry_type`. */
export interface DocumentHistoryEntry {
  id: number
  entry_type: 'version' | 'audit'
  version_number: number | null
  storage_path: string | null
  size: number | null
  mime_type: string | null
  original_file_name: string | null
  change_note: string | null
  action: string | null
  details: string | null
  ip_address: string | null
  created_at: string | null
  /** Null means SYSTEM — the pipeline did this, not a person. */
  actor_name: string | null
}

/** One row from the global activity feed — `DocumentHistoryEntry`'s audit shape plus which document it was on. */
export interface DocumentActivityEntry {
  id: number
  action: string | null
  details: string | null
  created_at: string | null
  document_id: number
  document_title: string | null
  actor_name: string | null
}

export interface RelatedDocument {
  id: number
  title: string | null
  original_file_name: string | null
  document_type: string | null
  tags: string | null
  created_at: string | null
}

export const accountService = {
  me: (context: LaravelContext) => apiClient.get<AccountMe>('/account/me', params(context)),

  updateProfile: (context: LaravelContext, changes: Partial<AccountProfile>) =>
    apiClient.put<AccountMe>('/account/profile', { ...params(context), ...changes }),

  /**
   * Replace the photo and nothing else.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * WHY THIS EXISTS ALONGSIDE `updateProfile`
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Settings sends the photo WITH the text fields, because there it is one field
   * of a form and a half-saved form is the thing to avoid. `/profile` has no form
   * at all, so the photo has to commit on its own the moment it is framed.
   *
   * Rather than let that screen hand-roll a second multipart call, both paths go
   * through one uploader. `putForm` adds `_method=PUT`, which Laravel's method
   * spoofing turns back into the PUT route - the SAME route and controller the
   * JSON path uses, so there is no second endpoint to keep in step.
   *
   * `image_error` comes back when the file reached the server and the object store
   * refused it. The profile row is still written in that case, so the caller has
   * to surface the message rather than treat a 200 as complete success.
   */
  updatePhoto: (context: LaravelContext, file: File) => {
    const body = new FormData()
    body.append('type', 'API')
    body.append('token', context.token)
    body.append('image', file)

    return apiClient.putForm<AccountMe & { image_error?: string }>('/account/profile', body)
  },

  updatePreferences: (context: LaravelContext, changes: Partial<AccountPreferences>) =>
    apiClient.put<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences',
      { ...params(context), ...changes },
    ),

  changePassword: (
    context: LaravelContext,
    currentPassword: string,
    password: string,
    confirmation: string,
  ) =>
    apiClient.post<{ status: boolean; message: string }>('/account/password', {
      ...params(context),
      current_password: currentPassword,
      password,
      password_confirmation: confirmation,
    }),

  /**
   * End this session on the server.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * SIGNING OUT USED TO BE PURELY LOCAL
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * There was no logout endpoint in the backend at all, so "Sign out" cleared
   * localStorage and nothing else. The Sanctum token stayed valid for its full
   * 30-day window: anybody who recovered it from a shared machine was still
   * authenticated as that person.
   *
   * Revokes only the calling token. Signing out of a laptop must not sign the same
   * person out of their phone - that is `endSessions`, a separate action somebody
   * chooses deliberately.
   *
   * ── THE CALLER MUST NOT WAIT ON THIS TO SUCCEED ─────────────────────────────
   *
   * A person clicking Sign out has to end up signed out even if the network is
   * down. So callers fire this and clear local state regardless; see `logout()` in
   * `gtg-auth.tsx`. Leaving somebody stuck in a session because a request failed
   * would be a worse outcome than a token that outlives the browser state.
   */
  logout: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; message: string }>('/account/logout', params(context)),

  /* ── your own documents ────────────────────────────────────────────────── */

  /**
   * The documents on your own personnel record.
   *
   * No id parameter, like every other call in this file: the server resolves the
   * subject from the token. The route this replaces took the user id from the URL
   * and the TENANT from the request body with no role gate, so any employee could
   * file a document against anybody in any organisation.
   */
  documents: (context: LaravelContext) =>
    apiClient.get<AccountDocumentsResponse>('/account/documents', params(context)),

  /**
   * Upload one. Multipart, because a file cannot go in a JSON body.
   *
   * The field is named `document` to match the server. That pairing is the whole
   * reason this product lost every file it was given for months: the old form
   * sent `file`, the old controller checked `document`, and the mismatch meant
   * nothing was ever written while the screen reported success.
   *
   * `documentType` is one of the keys in `document_types` (e.g. "resume",
   * "certificate") — an open vocabulary the server defines in
   * `config/documents.php`, not a foreign-key id a form has to look up first.
   */
  uploadDocument: (
    context: LaravelContext,
    file: File,
    title: string,
    documentType: string,
    options?: {
      category?: 'personnel' | 'organization'
      visibility?: 'private' | 'department' | 'organization'
      folderId?: number | null
    },
  ) => {
    const body = new FormData()
    const auth = params(context)

    Object.entries(auth).forEach(([key, value]) => body.append(key, String(value)))
    body.append('document', file)
    body.append('title', title)
    body.append('document_type', documentType)
    if (options?.category) body.append('category', options.category)
    if (options?.visibility) body.append('visibility', options.visibility)
    if (options?.folderId) body.append('folder_id', String(options.folderId))

    return apiClient.postForm<{ status: number; message?: string; data?: { id: number } }>(
      '/account/documents',
      body,
    )
  },

  /**
   * One search box over every document this caller may see — their own plus
   * whatever HR/admin scope they hold. Matches on content, not just title:
   * `extracted_text` is in the server's FULLTEXT index, so searching a word
   * that only appears INSIDE a file still finds it, with a highlighted
   * excerpt in `snippet`.
   */
  searchDocuments: (context: LaravelContext, filters: DocumentSearchFilters = {}) =>
    apiClient.get<DocumentSearchResponse>('/documents', {
      ...params(context),
      ...Object.fromEntries(
        Object.entries(filters)
          .filter(([, value]) => value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)]),
      ),
    }),

  /**
   * One document, in full — including `processing_step`. This is what the
   * upload-progress poller and the detail panel both read; unlike
   * `searchDocuments`, it does not require `processing_status === 'done'`,
   * so a caller polling right after upload sees 'processing' and the live
   * step rather than a 404 until the background job finishes.
   */
  getDocument: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: DocumentDetail }>(`/documents/${id}`, params(context)),

  /** This document's own version + audit trail, newest first. */
  getDocumentHistory: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: DocumentHistoryEntry[] }>(`/documents/${id}/history`, params(context)),

  /** Every action recorded against any document this caller may see, newest first. */
  getDocumentActivity: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: DocumentActivityEntry[] }>('/documents/activity', params(context)),

  /** Other documents of the same type, in the same department, this caller may also see. */
  getRelatedDocuments: (context: LaravelContext, id: number) =>
    apiClient.get<{ status: number; data: RelatedDocument[] }>(`/documents/${id}/related`, params(context)),

  /**
   * Documents THIS caller has actually opened (preview or download — both
   * route through the same download endpoint, see the server's own
   * docblock), newest-viewed first. Zero new schema on the server: it reads
   * back the existing `document_library_history` audit trail rather than
   * tracking "recent" separately.
   */
  getRecentDocuments: (context: LaravelContext, limit?: number) =>
    apiClient.get<{ status: number; data: RecentDocumentHit[] }>('/documents/recent', {
      ...params(context),
      ...(limit ? { limit: String(limit) } : {}),
    }),

  /** This caller's starred documents, newest-starred first — a Drive-style "Starred". */
  getStarredDocuments: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: DocumentSearchHit[] }>('/documents/starred', params(context)),

  /** Idempotent — starring an already-starred document is a no-op. You can star anything shared with you, same as Drive. */
  starDocument: (context: LaravelContext, id: number) =>
    apiClient.post<{ status: number; message?: string }>(`/documents/${id}/star`, params(context)),

  /** Idempotent the same way. */
  unstarDocument: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message?: string }>(`/documents/${id}/star`, params(context)),

  /** Remove one of yours. Soft, so an administrator can restore it. */
  deleteDocument: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message?: string }>(`/account/documents/${id}`, params(context)),

  /** My own trash — deleted but not yet purged. */
  getTrash: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: TrashedDocument[] }>('/account/documents/trash', params(context)),

  /** Every trashed document in the tenant — HR/admin only; a non-elevated caller gets a 403 from the route gate. */
  getTrashVisible: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: TrashedDocument[] }>('/documents/trash', params(context)),

  /** Undelete one of mine. */
  restoreDocument: (context: LaravelContext, id: number) =>
    apiClient.post<{ status: number; message?: string }>(`/account/documents/${id}/restore`, params(context)),

  /** Undelete one of an employee's — HR/admin only. */
  restoreEmployeeDocument: (context: LaravelContext, employeeId: number, id: number) =>
    apiClient.post<{ status: number; message?: string }>(
      `/employees-management/${employeeId}/documents/${id}/restore`,
      params(context),
    ),

  /**
   * One folder's direct contents — its subfolders and the documents inside
   * it. parentId null/0 = root. `departmentId` is an ADVISORY narrowing
   * filter, not a scope grant — the server's own ACL still governs what
   * comes back regardless; pass it from the admin Department tab to see
   * only that department's own folder space.
   */
  listFolders: (context: LaravelContext, parentId: number | null, departmentId?: number | null) =>
    apiClient.get<{ status: number; data: { folders: DocumentFolder[]; documents: DocumentSearchHit[] } }>(
      '/documents/folders',
      {
        ...params(context),
        ...(parentId ? { parent_id: String(parentId) } : {}),
        ...(departmentId ? { department_id: String(departmentId) } : {}),
      },
    ),

  /** The whole visible folder tree in one call, already nested server-side — for the left-rail browser. `departmentId` narrows the same way `listFolders` does. */
  getFolderTree: (context: LaravelContext, departmentId?: number | null) =>
    apiClient.get<{ status: number; data: DocumentFolderNode[] }>('/documents/folders/tree', {
      ...params(context),
      ...(departmentId ? { department_id: String(departmentId) } : {}),
    }),

  createFolder: (context: LaravelContext, name: string, parentId?: number | null, visibility?: 'private' | 'department' | 'organization') =>
    apiClient.post<{ status: number; message?: string; data?: { id: number } }>('/documents/folders', {
      ...params(context),
      name,
      ...(parentId ? { parent_id: parentId } : {}),
      ...(visibility ? { visibility } : {}),
    }),

  renameFolder: (context: LaravelContext, id: number, name: string) =>
    apiClient.patch<{ status: number; message?: string }>(`/documents/folders/${id}`, { ...params(context), name }),

  moveFolder: (context: LaravelContext, id: number, parentId: number | null) =>
    apiClient.post<{ status: number; message?: string }>(`/documents/folders/${id}/move`, {
      ...params(context),
      ...(parentId ? { parent_id: parentId } : {}),
    }),

  /**
   * Drive's "Make a copy" for a whole folder tree — recursive, independent
   * storage objects for every document inside (see `DocumentDuplicator`'s
   * own docblock on the server). Silently skips whatever the acting viewer
   * can't see, rather than erroring on it.
   */
  duplicateFolder: (context: LaravelContext, id: number, destinationParentId?: number | null) =>
    apiClient.post<{ status: number; message?: string; data?: { folder_id: number; folders_copied: number; documents_copied: number } }>(
      `/documents/folders/${id}/duplicate`,
      { ...params(context), ...(destinationParentId ? { destination_parent_id: destinationParentId } : {}) },
    ),

  deleteFolder: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: number; message?: string }>(`/documents/folders/${id}`, params(context)),

  /**
   * Find-or-create every segment of every relative path in one call —
   * what makes a recursive folder upload one round trip instead of N
   * sequential folder-creates. Returns {path -> folder_id}.
   */
  resolveFolderPaths: (context: LaravelContext, paths: string[], parentId?: number | null) =>
    apiClient.post<{ status: number; data: Record<string, number> }>('/documents/folders/resolve-path', {
      ...params(context),
      paths,
      ...(parentId ? { parent_id: parentId } : {}),
    }),

  /* ── my department's documents (self-service) ──────────────────────────── */

  /**
   * "My Department Documents" — one department's shared space, scoped to
   * the CALLER's own department, derived server-side only. There is no
   * `department_id` parameter here on purpose: this endpoint cannot be
   * pointed at a colleague's department by passing one, matching this
   * product's established self-service shape (see
   * `MyDepartmentDocumentsController`'s own docblock).
   */
  myDepartmentDocuments: (context: LaravelContext, filters: Omit<DocumentSearchFilters, 'department_id' | 'owner_id'> = {}) =>
    apiClient.get<DocumentSearchResponse & { department_id: number | null }>('/account/department-documents', {
      ...params(context),
      ...Object.fromEntries(
        Object.entries(filters)
          .filter(([, value]) => value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)]),
      ),
    }),

  /** One folder's direct contents, within the caller's own department only. */
  myDepartmentFolders: (context: LaravelContext, parentId: number | null) =>
    apiClient.get<{ status: number; data: { folders: DocumentFolder[]; documents: DocumentSearchHit[] }; department_id: number | null }>(
      '/account/department-documents/folders',
      { ...params(context), ...(parentId ? { parent_id: String(parentId) } : {}) },
    ),

  /** The caller's own department's whole folder tree, nested server-side. */
  myDepartmentFolderTree: (context: LaravelContext) =>
    apiClient.get<{ status: number; data: DocumentFolderNode[]; department_id: number | null }>(
      '/account/department-documents/folders/tree',
      params(context),
    ),

  /* ── a department's documents (admin, via the Department Management tab) ─ */

  /**
   * File a document AS the caller, tagged to department `departmentId`
   * regardless of the caller's own department — HR-elevated only on the
   * server (`storeForDepartment()`). Same shape as `uploadDocument`, with
   * the destination department fixed by the route rather than derived.
   */
  uploadDocumentForDepartment: (
    context: LaravelContext,
    departmentId: number,
    file: File,
    title: string,
    documentType: string,
    options?: { category?: 'personnel' | 'organization'; visibility?: 'private' | 'department' | 'organization'; folderId?: number | null },
  ) => {
    const body = new FormData()
    const auth = params(context)

    Object.entries(auth).forEach(([key, value]) => body.append(key, String(value)))
    body.append('document', file)
    body.append('title', title)
    body.append('document_type', documentType)
    if (options?.category) body.append('category', options.category)
    if (options?.visibility) body.append('visibility', options.visibility)
    if (options?.folderId) body.append('folder_id', String(options.folderId))

    return apiClient.postForm<{ status: number; message?: string; data?: { id: number } }>(
      `/departments-management/${departmentId}/documents`,
      body,
    )
  },

  /** Create a folder tagged to department `departmentId` regardless of the caller's own — the folder twin of `uploadDocumentForDepartment`. */
  createFolderForDepartment: (
    context: LaravelContext,
    departmentId: number,
    name: string,
    parentId?: number | null,
    visibility?: 'private' | 'department' | 'organization',
  ) =>
    apiClient.post<{ status: number; message?: string; data?: { id: number } }>(
      `/departments-management/${departmentId}/documents/folders`,
      { ...params(context), name, ...(parentId ? { parent_id: parentId } : {}), ...(visibility ? { visibility } : {}) },
    ),

  /** The resolve-path twin of `createFolderForDepartment` — for a recursive/zip folder upload from the admin Department tab. */
  resolveFolderPathsForDepartment: (
    context: LaravelContext,
    departmentId: number,
    paths: string[],
    parentId?: number | null,
    visibility?: 'private' | 'department' | 'organization',
  ) =>
    apiClient.post<{ status: number; data: Record<string, number> }>(
      `/departments-management/${departmentId}/documents/folders/resolve-path`,
      { ...params(context), paths, ...(parentId ? { parent_id: parentId } : {}), ...(visibility ? { visibility } : {}) },
    ),

  /** Move a document already filed into (or out of) a folder. */
  moveDocument: (context: LaravelContext, id: number, folderId: number | null) =>
    apiClient.patch<{ status: number; message?: string }>(`/account/documents/${id}`, {
      ...params(context),
      folder_id: folderId ?? '',
    }),

  /**
   * Drive's "Make a copy" — an independent storage object, not a reference
   * to the original. Gated on canView() server-side, not ownership: you can
   * copy anything shared with you, same as starring. Always lands private
   * regardless of the original's visibility (see `DocumentDuplicator`'s own
   * docblock).
   */
  duplicateDocument: (context: LaravelContext, id: number, destinationFolderId?: number | null) =>
    apiClient.post<{ status: number; message?: string; data?: { id: number } }>(`/account/documents/${id}/duplicate`, {
      ...params(context),
      ...(destinationFolderId ? { destination_folder_id: destinationFolderId } : {}),
    }),

  /**
   * Correct one of mine — title, type, category, subject. Owner-only, same
   * as delete. Send only the fields that actually changed; the server
   * no-ops (and skips the audit entry) on an empty diff.
   */
  updateDocument: (
    context: LaravelContext,
    id: number,
    changes: Partial<{ title: string; document_type: string; category: 'personnel' | 'organization'; subject: string | null }>,
  ) =>
    apiClient.patch<{ status: number; message?: string }>(`/account/documents/${id}`, { ...params(context), ...changes }),

  /**
   * Upload a new version of one of mine — same multipart shape as
   * `uploadDocument`, field named `document` for the same reason. The old
   * file is kept (see `document_library_history`'s docblock), not replaced.
   */
  uploadDocumentVersion: (context: LaravelContext, id: number, file: File, changeNote?: string) => {
    const body = new FormData()
    const auth = params(context)

    Object.entries(auth).forEach(([key, value]) => body.append(key, String(value)))
    body.append('document', file)
    if (changeNote) body.append('change_note', changeNote)

    return apiClient.postForm<{ status: number; message?: string }>(`/account/documents/${id}/versions`, body)
  },

  /** Make an older version of mine current again. Writes a new version row rather than rewriting history — see the endpoint's own docblock. */
  restoreDocumentVersion: (context: LaravelContext, id: number, historyId: number) =>
    apiClient.post<{ status: number; message?: string }>(
      `/account/documents/${id}/versions/${historyId}/restore`,
      params(context),
    ),

  /**
   * Where to fetch a document from.
   *
   * A URL rather than a fetch, because the browser downloads it. It goes through
   * this application rather than to the object store: the bytes are served only
   * after the same permission check the list uses, which is what stops a guessed
   * key reading somebody's ID proof.
   */
  documentDownloadUrl: (context: LaravelContext, id: number) =>
    buildApiUrl(`/account/documents/${id}/download`, params(context)),

  /**
   * The document's BYTES, fetched with the token in the Authorization header.
   *
   * `documentDownloadUrl` above puts the token in the query string, because a
   * browser following an `<a href>` sends no headers. That works, and it is why
   * it is still here - but a URL is not a private place: it is written to access
   * logs, browser history and proxy logs, and leaks through Referer on any
   * outbound link. A harvested Sanctum token is a working credential for the
   * whole API, not just the one document it was meant to fetch.
   *
   * Fetching gives three things the URL cannot: the credential stays in a
   * header, a refusal arrives as readable JSON instead of a blank tab, and the
   * bytes can be handed to an inline viewer as a blob - which is the only way to
   * preview an authenticated file at all, since an <iframe> sends no header
   * either.
   */
  fetchDocument: (id: number) => apiClient.getBlob(`/account/documents/${id}/download`),

  /* ── somebody else's documents: HR, for an employee ────────────────────── */

  /**
   * One employee's documents, for HR.
   *
   * This endpoint existed and nothing called it. The Employee Directory read a
   * different query instead - an INNER join with no soft-delete filter - so the
   * employee and HR could see different lists for the same person, and did:
   * payslips pointing at a type row that does not exist vanished for HR, and a
   * document the employee deleted stayed on the HR screen for ever.
   */
  employeeDocuments: (context: LaravelContext, employeeId: number) =>
    apiClient.get<AccountDocumentsResponse>(
      `/employees-management/${employeeId}/documents`,
      params(context),
    ),

  /** File a document FOR an employee. Recorded as filed by the HR user. */
  uploadEmployeeDocument: (employeeId: number, body: FormData) =>
    apiClient.postForm<{ status: number; message?: string; data?: { id: number } }>(
      `/employees-management/${employeeId}/documents`,
      body,
    ),

  /**
   * Remove an employee's document.
   *
   * Not `DELETE /account/documents/{id}` - that one is owner-only by design, and
   * widening it would have let any employee delete another's by guessing an id.
   * This route is gated by role AND by an employee-in-my-tenant check, because
   * an HR manager is HR for one organisation, not for all twelve.
   */
  deleteEmployeeDocument: (context: LaravelContext, employeeId: number, documentId: number) =>
    apiClient.delete<{ status: number; message?: string }>(
      `/employees-management/${employeeId}/documents/${documentId}`,
      params(context),
    ),

  /* ── two-step verification ─────────────────────────────────────────────── */

  /**
   * Begin enrolment. Returns a secret that does NOT yet protect the account.
   *
   * No password required, deliberately: asking for one to ADD protection only
   * discourages people from adding it. The two calls that WEAKEN it do ask.
   */
  twoFactorStart: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; data: TwoFactorEnrolment }>(
      '/account/2fa/start',
      params(context),
    ),

  /** Confirm with a code from the app. Returns the recovery codes, once. */
  twoFactorConfirm: (context: LaravelContext, code: string) =>
    apiClient.post<{ status: boolean; message: string; data: { recovery_codes: string[] } }>(
      '/account/2fa/confirm',
      { ...params(context), code },
    ),

  /** Fresh recovery codes. The old set stops working. */
  twoFactorRecoveryCodes: (context: LaravelContext, currentPassword: string) =>
    apiClient.post<{ status: boolean; message: string; data: { recovery_codes: string[] } }>(
      '/account/2fa/recovery-codes',
      { ...params(context), current_password: currentPassword },
    ),

  /**
   * Turn it off. Needs the password — it is a reduction in protection.
   *
   * POST, not DELETE, and that is about the password rather than about REST:
   * `apiClient.delete()` has no body and puts its parameters in the QUERY STRING.
   * `api-client.ts` already documents why that is unacceptable for a credential —
   * "a URL is not a private place: access logs, browser history, proxy and CDN
   * logs, and the Referer header". A password there is worse than the token that
   * note was written about, so no DELETE route is offered at all.
   */
  twoFactorDisable: (context: LaravelContext, currentPassword: string) =>
    apiClient.post<{ status: boolean; message: string }>('/account/2fa/disable', {
      ...params(context),
      current_password: currentPassword,
    }),

  /**
   * This person's own security history.
   *
   * No id parameter by design: the server resolves the subject from the token, so
   * there is nothing here that could be pointed at somebody else.
   */
  activity: (context: LaravelContext, limit = 25) =>
    apiClient.get<{
      status: boolean
      data: { entries: AccountActivityEntry[]; since: string | null }
    }>('/account/activity', { ...params(context), limit: String(limit) }),

  sessions: (context: LaravelContext) =>
    apiClient.get<{ status: boolean; data: { sessions: AccountSession[] } }>(
      '/account/sessions',
      params(context),
    ),

  // `delete` takes the params map directly, not an options object.
  endSession: (context: LaravelContext, id: number) =>
    apiClient.delete<{ status: boolean; message: string }>(
      `/account/sessions/${id}`,
      params(context) as Record<string, string>,
    ),

  /** "Use these on all my devices" — copy this browser's appearance to the account. */
  promotePreferences: (context: LaravelContext) =>
    apiClient.post<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences/promote',
      params(context),
    ),

  /** Forget this browser's overrides, so it follows the account default again. */
  forgetDevicePreferences: (context: LaravelContext) =>
    apiClient.delete<{ status: boolean; message: string; data: { preferences: AccountPreferences } }>(
      '/account/preferences/device',
      params(context) as Record<string, string>,
    ),

  /** Sign out everywhere except the device making the request. */
  endOtherSessions: (context: LaravelContext) =>
    apiClient.delete<{ status: boolean; message: string }>(
      '/account/sessions',
      params(context) as Record<string, string>,
    ),
}
