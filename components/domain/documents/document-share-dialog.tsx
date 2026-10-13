'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { accountService, type DocumentShare } from '@/services/account'
import { taskService } from '@/services/task'

/**
 * Just the fields this dialog actually reads - both `DocumentSearchHit`
 * (grid/table rows) and `DocumentDetail` (the detail dialog's own fetch)
 * already satisfy this shape structurally, so either can be passed straight
 * through with no conversion at the call site.
 */
export interface ShareableDocument {
  id: number
  title: string | null
  visibility: 'private' | 'department' | 'organization' | null
  department_id: number | null
  owner_name?: string | null
}

const ROLE_OPTIONS: SearchableOption[] = [
  { value: 'view', label: 'Viewer' },
  { value: 'edit', label: 'Editor' },
]

const GENERAL_ACCESS_OPTIONS: SearchableOption[] = [
  { value: 'private', label: 'Private — only you and people you add below' },
  { value: 'department', label: 'Department — anyone in a chosen department' },
  { value: 'organization', label: 'Organisation — anyone in the company' },
]

export interface DocumentShareDialogProps {
  document: ShareableDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reuses document-library-view.tsx's own already-fetched list — no reason to fetch departments twice. */
  departmentOptions: SearchableOption[]
  /** The document's visibility/department just changed — let the caller refresh its list so the new audience is reflected. */
  onVisibilityChanged: () => void
}

/**
 * Google Drive's own Share dialog, same two halves: a "People with access"
 * list (per-person Viewer/Editor grants — DocumentShareController, the write
 * side of `view_principals`, see that migration's own docblock) and a
 * "General access" control underneath it (the document's existing coarse
 * visibility, just finally editable after creation instead of only at
 * upload time). Both write through the one `canManage()` gate the backend
 * already enforces — this dialog is only ever opened for a document the
 * viewer can manage, same `canDelete`-named owner check every other
 * dialog-opening action in this domain already uses.
 *
 * Mounted fresh per document - the caller keys this on `document?.id` (see
 * document-library-view.tsx's render call), so every piece of state below
 * can read its own starting value straight from the `document` prop via a
 * lazy initializer instead of a reset effect: a genuinely different
 * document means a genuinely new mount, not the same instance being told to
 * forget what it knew. The share/people fetch below rides the same mount -
 * NOT the Dialog's own onOpenChange, which only fires for interactions the
 * Dialog itself initiates (Escape, overlay click, its own trigger). This is
 * opened from a context-menu action outside the Dialog entirely, which just
 * flips the `open` prop from the parent - Radix never calls onOpenChange
 * for that, so a fetch hung off it would silently never run.
 */
export function DocumentShareDialog({ document, open, onOpenChange, departmentOptions, onVisibilityChanged }: DocumentShareDialogProps) {
  const [shares, setShares] = useState<DocumentShare[]>([])
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [sharesLoading, setSharesLoading] = useState(false)
  const [error, setError] = useState('')
  const [people, setPeople] = useState<SearchableOption[]>([])
  const [pickerUserId, setPickerUserId] = useState('')
  const [pickerRole, setPickerRole] = useState<'view' | 'edit'>('view')
  const [sharing, setSharing] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const [visibility, setVisibility] = useState<'private' | 'department' | 'organization'>(
    () => (document?.visibility as 'private' | 'department' | 'organization' | null) ?? 'private',
  )
  const [departmentId, setDepartmentId] = useState(() => (document?.department_id ? String(document.department_id) : ''))
  // The last value actually saved - starts equal to the prop's own value,
  // then tracks the dialog's own successful saves from there. Comparing
  // against this instead of the `document` prop directly matters because
  // the prop is a snapshot from whenever this dialog was opened: the parent
  // list refetches after a save (onVisibilityChanged), but THIS dialog
  // instance's own `document` prop never gets handed a fresher object, so
  // comparing straight against it would leave "Save" looking clickable
  // forever even right after a save that genuinely succeeded.
  const [savedVisibility, setSavedVisibility] = useState(visibility)
  const [savedDepartmentId, setSavedDepartmentId] = useState(departmentId)
  const [savingAccess, setSavingAccess] = useState(false)

  const loadShares = () => {
    if (!document || sharesLoaded || sharesLoading) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setSharesLoading(true); setError('')
    Promise.all([
      accountService.getDocumentShares(context, document.id),
      taskService.getAssignmentUsers(context),
    ]).then(([sharesResponse, users]) => {
      setShares(sharesResponse.data.shares)
      setPeople(users.map((user) => ({
        value: String(user.id),
        label: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
      })))
      setSharesLoaded(true)
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Unable to load sharing for this document.')
    }).finally(() => {
      setSharesLoading(false)
    })
  }

  // Runs once per mount - which, thanks to the key-based remount above, is
  // once per genuinely different document, regardless of how `open` got
  // flipped to true.
  useEffect(() => {
    loadShares()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshShares = async () => {
    if (!document) return
    try {
      const response = await accountService.getDocumentShares(getLaravelContext(), document.id)
      setShares(response.data.shares)
    } catch { /* the action that just ran still succeeded; the list just won't reflect it until reopened */ }
  }

  const addShare = async () => {
    if (!document || !pickerUserId) return
    setSharing(true); setError('')
    try {
      await accountService.shareDocument(getLaravelContext(), document.id, Number(pickerUserId), pickerRole === 'edit')
      setPickerUserId(''); setPickerRole('view')
      await refreshShares()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to share this document.')
    } finally {
      setSharing(false)
    }
  }

  /** Changing a row's role is just sharing again - share() is an upsert keyed on (document, viewer). */
  const changeRole = async (share: DocumentShare, canEdit: boolean) => {
    if (!document) return
    setError('')
    try {
      await accountService.shareDocument(getLaravelContext(), document.id, share.viewer_user_id, canEdit)
      await refreshShares()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change that role.')
    }
  }

  const removeShare = async (share: DocumentShare) => {
    if (!document) return
    setRemovingId(share.id); setError('')
    try {
      await accountService.unshareDocument(getLaravelContext(), document.id, share.id)
      await refreshShares()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove that share.')
    } finally {
      setRemovingId(null)
    }
  }

  const saveGeneralAccess = async () => {
    if (!document) return
    setSavingAccess(true); setError('')
    try {
      await accountService.updateDocument(getLaravelContext(), document.id, {
        visibility,
        department_id: visibility === 'department' && departmentId ? Number(departmentId) : null,
      })
      setSavedVisibility(visibility)
      setSavedDepartmentId(visibility === 'department' ? departmentId : '')
      onVisibilityChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update general access.')
    } finally {
      setSavingAccess(false)
    }
  }

  // Already-shared people drop out of the picker - sharing with the same
  // person twice would just update their existing row (share() is an
  // upsert), and hiding them here is the honest way to show that instead of
  // a confusing duplicate pick. Row has its own role selector for changing
  // an existing grant instead.
  const alreadySharedIds = new Set(shares.map((share) => share.viewer_user_id))
  const pickerOptions = people.filter((person) => !alreadySharedIds.has(Number(person.value)))

  const accessChanged = visibility !== savedVisibility
    || (visibility === 'department' && departmentId !== savedDepartmentId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        {/* min-w-0 is load-bearing, not decorative: DialogHeader is a flex
            column, and a flex item's default min-width is its own content's
            full size - `truncate`'s overflow-hidden/ellipsis never get a
            chance to apply without this, so a long title (a real case here -
            legal filings, audit reports) just overflows the dialog's own
            edge instead of clipping, running straight through the close
            button and the page behind it. pr-6 then reserves that button's
            own width so the ellipsis always lands clear of it, never under it. */}
        <DialogHeader className="min-w-0">
          <DialogTitle className="truncate pr-6">Share &quot;{document?.title ?? 'document'}&quot;</DialogTitle>
          <DialogDescription>Choose who can open this document, and what they can do.</DialogDescription>
        </DialogHeader>

        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchableSelect
              value={pickerUserId}
              onChange={setPickerUserId}
              options={pickerOptions}
              placeholder="Add a person…"
              searchPlaceholder="Search people…"
              disabled={sharing}
            />
          </div>
          <div className="w-28 shrink-0">
            <Select value={pickerRole} onChange={(value) => setPickerRole(value as 'view' | 'edit')} options={ROLE_OPTIONS} disabled={sharing} />
          </div>
          <Button size="sm" disabled={!pickerUserId || sharing} onClick={() => void addShare()}>
            {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Add'}
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">People with access</p>
          {document?.owner_name && (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{document.owner_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">Owner</span>
            </div>
          )}
          {sharesLoading && <p className="px-2 text-sm text-muted-foreground">Loading…</p>}
          {!sharesLoading && sharesLoaded && shares.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">Not shared with anyone else yet.</p>
          )}
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="min-w-0 flex-1 truncate text-sm">{share.viewer_name}</span>
                <div className="w-24 shrink-0">
                  <Select
                    value={share.can_edit ? 'edit' : 'view'}
                    onChange={(value) => void changeRole(share, value === 'edit')}
                    options={ROLE_OPTIONS}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Stop sharing with ${share.viewer_name}`}
                  onClick={() => void removeShare(share)}
                  disabled={removingId === share.id}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">General access</p>
          <Select
            value={visibility}
            onChange={(value) => setVisibility(value as 'private' | 'department' | 'organization')}
            options={GENERAL_ACCESS_OPTIONS}
          />
          {visibility === 'department' && (
            <SearchableSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={departmentOptions}
              placeholder="Choose a department"
              aria-label="Department"
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!accessChanged || savingAccess || (visibility === 'department' && !departmentId)}
            onClick={() => void saveGeneralAccess()}
          >
            {savingAccess ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            Save general access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
