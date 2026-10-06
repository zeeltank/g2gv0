'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileSearch,
  FileText,
  FolderPlus,
  Grid2x2,
  List,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/settings/sections/section-primitives'
import { DocumentViewer } from '@/components/shared/business/document-viewer'
import { useAuth } from '@/hooks/use-auth'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { isHrAdmin, isRole } from '@/types/role'
import {
  accountService,
  type AccountDocument,
  type DocumentFolderNode,
  type DocumentSearchHit,
  type DocumentTypeChoices,
  type TrashedDocument,
} from '@/services/account'
import { myHrService } from '@/services/hrms/my-hr'
import { DocumentCardGrid } from './document-card-grid'
import { DocumentDetailDialog } from './document-detail-dialog'
import { DocumentFolderTree } from './document-folder-tree'
import { assignFolderIds, type DiscoveredFile } from './document-folder-upload'
import { DocumentProcessingProgress } from './document-processing-progress'
import { DocumentBatchUploadProgress, type BatchFileState } from './document-batch-upload-progress'
import { DocumentUploadDropzone } from './document-upload-dropzone'
import { DocumentsPage, Notice, SectionHeader, Surface } from './documents-ui'

type ViewMode = 'grid' | 'list'
type Scope = 'mine' | 'visible' | 'trash'

const PER_PAGE = 24
/** Mirrors config('documents.trash.purge_days') — cosmetic copy only, the server's own `purge_at` per row is authoritative. */
const TRASH_PURGE_DAYS = 30

/** Depth-first search over the server-built tree — no client-side tree-construction needed, see document-folder-tree.tsx's docblock. */
function findFolderNode(nodes: DocumentFolderNode[], id: number): DocumentFolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findFolderNode(node.children, id)
    if (found) return found
  }
  return null
}

/** Root-to-target path, for the breadcrumb bar. */
function findFolderPath(nodes: DocumentFolderNode[], id: number, path: DocumentFolderNode[] = []): DocumentFolderNode[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node]
    if (node.id === id) return nextPath
    const found = findFolderPath(node.children, id, nextPath)
    if (found) return found
  }
  return null
}

/** Every folder, indented by depth, for the move-to-folder picker. */
function flattenFolders(nodes: DocumentFolderNode[], depth = 0): Array<{ id: number; name: string; depth: number }> {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenFolders(node.children, depth + 1),
  ])
}

/**
 * THE DOCUMENT LIBRARY — upload, browse, organise into folders, and search
 * by content.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE SCREEN, TWO AUDIENCES, BY CONSTRUCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This does not branch on role. `GET /api/documents` already scopes its
 * results per caller - `DocumentAccess` on the server gives an ordinary
 * employee their own documents plus whatever is organisation-visible, and
 * gives HR/admin the whole tenant, through the exact same query. So "my
 * documents" and "the org-wide admin browser" are the same screen with the
 * "Only mine" toggle flipped - there is no second page to keep in step, and
 * no client-side role check that could disagree with what the server
 * actually returns.
 *
 * Delete is still owner-only here, matching `DELETE /account/documents/{id}`
 * exactly (`canDelete` below just mirrors that - it is not a privilege
 * grant, the server enforces its own copy of this rule regardless).
 *
 * ── FOLDERS ARE ALWAYS ON, NOT AN OPT-IN MODE ───────────────────────────────
 *
 * Every existing document has `folder_id = NULL` (the column is brand new),
 * and `folder_id=0` is this screen's own sentinel for "root" - so "Home" in
 * the tree shows exactly what the flat list showed before folders existed.
 * There is no separate "flat search" vs "folder browsing" mode to keep in
 * sync; the folder is just one more filter dimension, always applied.
 */
export function DocumentLibraryView() {
  const resolveContext = useLaravelContext()
  const { user } = useAuth()
  const myId = user?.id ? Number(user.id) : null

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [scope, setScope] = useState<Scope>('mine')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)

  const [results, setResults] = useState<DocumentSearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [types, setTypes] = useState<DocumentTypeChoices>({ personnel: {}, organization: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [processingDoc, setProcessingDoc] = useState<{ id: number; fileName: string; title: string } | null>(null)
  const [batchFiles, setBatchFiles] = useState<BatchFileState[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generatingForm16, setGeneratingForm16] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const [viewing, setViewing] = useState<AccountDocument | null>(null)
  const [detailDoc, setDetailDoc] = useState<DocumentSearchHit | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentSearchHit | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [trashResults, setTrashResults] = useState<TrashedDocument[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [trashError, setTrashError] = useState<string | null>(null)
  const [trashEveryone, setTrashEveryone] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [folderTree, setFolderTree] = useState<DocumentFolderNode[]>([])
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<DocumentFolderNode | null>(null)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [movingDoc, setMovingDoc] = useState<DocumentSearchHit | null>(null)
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('')
  const [moving, setMoving] = useState(false)

  /** Cosmetic only — hides the "everyone's trash" toggle (and widens folder-manage) for a caller who almost certainly can't use the elevated path. The server's own gates are the real control. */
  const isElevated = isRole(user?.role) && isHrAdmin(user.role)

  // Debounced so every keystroke doesn't fire a request - same inline
  // pattern this codebase already uses (see ingestion-view.tsx).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category, documentType, scope, currentFolderId])

  const load = useCallback(async () => {
    if (scope === 'trash') return

    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await accountService.searchDocuments(context, {
        q: debouncedQuery || undefined,
        category: (category as 'personnel' | 'organization') || undefined,
        document_type: documentType || undefined,
        owner_id: scope === 'mine' && myId ? myId : undefined,
        folder_id: currentFolderId ?? 0,
        page,
        per_page: PER_PAGE,
      })
      setResults(response.data ?? [])
      setTotal(response.meta?.total ?? 0)
      setTypes(response.document_types ?? { personnel: {}, organization: {} })
    } catch (caught) {
      setResults([])
      setError(caught instanceof Error ? caught.message : 'Documents could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [resolveContext, debouncedQuery, category, documentType, scope, myId, currentFolderId, page])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const loadFolderTree = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    try {
      const response = await accountService.getFolderTree(context)
      setFolderTree(response.data ?? [])
    } catch {
      // The folder rail is supplementary to the document list - a failure
      // here should not block browsing documents at all; it just stays empty.
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void loadFolderTree()
    })
  }, [loadFolderTree])

  const currentSubfolders = useMemo(
    () => (currentFolderId === null ? folderTree : (findFolderNode(folderTree, currentFolderId)?.children ?? [])),
    [folderTree, currentFolderId],
  )
  const breadcrumbPath = useMemo(
    () => (currentFolderId === null ? [] : (findFolderPath(folderTree, currentFolderId) ?? [])),
    [folderTree, currentFolderId],
  )
  const folderOptions: SearchableOption[] = useMemo(
    () => [
      { value: '', label: 'Home (no folder)' },
      ...flattenFolders(folderTree).map((f) => ({ value: String(f.id), label: `${'— '.repeat(f.depth)}${f.name}` })),
    ],
    [folderTree],
  )
  const canManageFolderClient = useCallback(
    (folder: DocumentFolderNode) => isElevated || (myId !== null && folder.owner_id === myId),
    [isElevated, myId],
  )

  const loadTrash = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setTrashLoading(false)
      return
    }

    setTrashLoading(true)
    setTrashError(null)

    try {
      const response = trashEveryone
        ? await accountService.getTrashVisible(context)
        : await accountService.getTrash(context)
      setTrashResults(response.data ?? [])
    } catch (caught) {
      setTrashResults([])
      setTrashError(caught instanceof Error ? caught.message : 'Trash could not be loaded.')
    } finally {
      setTrashLoading(false)
    }
  }, [resolveContext, trashEveryone])

  useEffect(() => {
    if (scope !== 'trash') return
    queueMicrotask(() => {
      void loadTrash()
    })
  }, [scope, loadTrash])

  async function restoreFromTrash(doc: TrashedDocument) {
    setRestoringId(doc.id)
    try {
      const response = myId !== null && doc.owner_id !== myId
        ? await accountService.restoreEmployeeDocument(resolveContext(), doc.owner_id, doc.id)
        : await accountService.restoreDocument(resolveContext(), doc.id)

      if (response.status === 1) {
        setNotice({ tone: 'info', text: `"${doc.title ?? 'Document'}" was restored.` })
        await loadTrash()
      } else {
        setNotice({ tone: 'error', text: response.message ?? 'That document could not be restored.' })
      }
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That document could not be restored.' })
    } finally {
      setRestoringId(null)
    }
  }

  function daysUntil(dateString: string): number {
    const ms = new Date(dateString.replace(' ', 'T')).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / 86_400_000))
  }

  const typeLabel = useCallback(
    (key: string | null) => (key ? (types.personnel[key] ?? types.organization[key] ?? key) : null),
    [types],
  )

  const typeOptions = useMemo(
    () => [
      { value: '', label: 'All types' },
      ...Object.entries(types.personnel).map(([value, label]) => ({ value, label })),
      ...Object.entries(types.organization).map(([value, label]) => ({ value, label: `${label} (org)` })),
    ],
    [types],
  )

  /**
   * One call for the whole batch - a single file with no folder structure
   * gets the existing polished single-document experience
   * (`DocumentProcessingProgress`, real `processing_step` polling); anything
   * else (multiple files, or a folder) gets the simpler upload-level batch
   * list (`DocumentBatchUploadProgress` - see its own docblock for why it
   * deliberately doesn't poll per-file classification).
   */
  async function upload(files: DiscoveredFile[], docType: string, directoryPaths: string[]) {
    const context = resolveContext()
    setNotice(null)

    if (files.length === 1 && directoryPaths.length === 0) {
      setUploading(true)
      const file = files[0].file
      const title = file.name.replace(/\.[^.]+$/, '')

      try {
        const response = await accountService.uploadDocument(context, file, title, docType, {
          category: 'personnel',
          folderId: currentFolderId,
        })
        const id = response.data?.id

        if (id) {
          setProcessingDoc({ id, fileName: file.name, title })
        } else {
          setUploadOpen(false)
          setNotice({ tone: 'info', text: `“${title}” was uploaded. It will appear in search shortly.` })
          setPage(1)
          await load()
        }
      } catch (caught) {
        setNotice({
          tone: 'error',
          text: caught instanceof Error ? caught.message : 'That document could not be uploaded.',
        })
      } finally {
        setUploading(false)
      }
      return
    }

    setUploading(true)
    setBatchFiles(files.map((f) => ({ key: f.relativePath, fileName: f.relativePath, status: 'pending' })))

    try {
      let pathToFolderId: Record<string, number> = {}

      if (directoryPaths.length > 0) {
        const resolved = await accountService.resolveFolderPaths(context, directoryPaths, currentFolderId)
        pathToFolderId = resolved.data
      }

      const withFolders = assignFolderIds(files, pathToFolderId, currentFolderId)

      // Sequential, not parallel - a large folder upload must not stampede
      // N one-shot queue-worker spawns at once (ensureQueueWorkerRunning()
      // self-spawns per upload; see DocumentLibraryController's docblock),
      // and this keeps per-file error isolation simple.
      for (const entry of withFolders) {
        setBatchFiles((current) =>
          current?.map((f) => (f.key === entry.relativePath ? { ...f, status: 'uploading' } : f)) ?? current,
        )

        const title = entry.file.name.replace(/\.[^.]+$/, '')

        try {
          await accountService.uploadDocument(context, entry.file, title, docType, {
            category: 'personnel',
            folderId: entry.folderId,
          })
          setBatchFiles((current) =>
            current?.map((f) => (f.key === entry.relativePath ? { ...f, status: 'done' } : f)) ?? current,
          )
        } catch (caught) {
          setBatchFiles((current) =>
            current?.map((f) =>
              f.key === entry.relativePath
                ? { ...f, status: 'error', errorMessage: caught instanceof Error ? caught.message : 'Upload failed.' }
                : f,
            ) ?? current,
          )
        }
      }

      setPage(1)
      await load()
      if (directoryPaths.length > 0) await loadFolderTree()
    } finally {
      setUploading(false)
    }
  }

  function finishProcessing(outcome: { timedOut: boolean; failed: boolean }) {
    const title = processingDoc?.title ?? 'Document'
    setProcessingDoc(null)
    setUploadOpen(false)
    setNotice({
      tone: outcome.failed ? 'error' : 'info',
      text: outcome.failed
        ? `“${title}” is filed and searchable by title, but automatic classification hit a snag.`
        : outcome.timedOut
          ? `“${title}” is filed and searchable. Classification is taking a little longer than usual and will finish in the background.`
          : `“${title}” is filed, read, and classified — fully searchable now.`,
    })
    setPage(1)
    void load()
  }

  /** April-March, matching the server's own convention (MyHrController::leaveYear()). */
  function currentFinancialYear(): number {
    const now = new Date()
    return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
  }

  async function generateForm16() {
    if (generatingForm16) return
    const year = currentFinancialYear()

    setGeneratingForm16(true)
    setNotice(null)

    try {
      await myHrService.generateForm16(resolveContext(), year)
      setNotice({ tone: 'info', text: `Form 16 for ${year}-${String(year + 1).slice(-2)} is ready — find it under "My documents".` })
      setScope('mine')
      setCurrentFolderId(null)
      setPage(1)
      await load()
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Your Form 16 could not be generated.',
      })
    } finally {
      setGeneratingForm16(false)
    }
  }

  async function download(doc: DocumentSearchHit) {
    setDownloadingId(doc.id)
    try {
      const blob = await accountService.fetchDocument(doc.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.original_file_name || doc.title || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'That document could not be downloaded.',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)

    try {
      await accountService.deleteDocument(resolveContext(), pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'That document could not be removed.',
      })
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function createFolderHandler() {
    const name = newFolderName.trim()
    if (!name || creatingFolder) return

    setCreatingFolder(true)
    try {
      await accountService.createFolder(resolveContext(), name, currentFolderId)
      setNewFolderOpen(false)
      setNewFolderName('')
      await loadFolderTree()
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That folder could not be created.' })
    } finally {
      setCreatingFolder(false)
    }
  }

  async function confirmDeleteFolder() {
    if (!pendingDeleteFolder || deletingFolder) return
    setDeletingFolder(true)

    try {
      const response = await accountService.deleteFolder(resolveContext(), pendingDeleteFolder.id)
      setPendingDeleteFolder(null)
      if (response.status === 1) {
        await loadFolderTree()
      } else {
        setNotice({ tone: 'error', text: response.message ?? 'That folder could not be removed.' })
      }
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That folder could not be removed.' })
      setPendingDeleteFolder(null)
    } finally {
      setDeletingFolder(false)
    }
  }

  async function moveDocumentHandler() {
    if (!movingDoc || moving) return
    setMoving(true)

    try {
      const targetId = moveTargetFolderId ? Number(moveTargetFolderId) : null
      await accountService.moveDocument(resolveContext(), movingDoc.id, targetId)
      setMovingDoc(null)
      setNotice({ tone: 'info', text: `"${movingDoc.title ?? 'Document'}" was moved.` })
      await load()
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That document could not be moved.' })
    } finally {
      setMoving(false)
    }
  }

  const canDelete = useCallback((doc: DocumentSearchHit) => myId !== null && doc.owner_id === myId, [myId])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <DocumentsPage>
      <SectionHeader
        title="Document Library"
        description="Upload anything, and find it later by what's written inside it — not just its name."
        actions={
          <>
            <Button variant="outline" onClick={() => void generateForm16()} disabled={generatingForm16}>
              {generatingForm16 ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="mr-2 size-4" aria-hidden="true" />
              )}
              {generatingForm16 ? 'Generating…' : 'Generate Form 16'}
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Upload
            </Button>
          </>
        }
      />

      {notice && (
        <Notice tone={notice.tone} action={<button onClick={() => setNotice(null)} className="text-xs underline">Dismiss</button>}>
          {notice.text}
        </Notice>
      )}

      <Surface className="p-4">
        {/*
          One row, deliberately - every control here narrows the same list,
          so they read as one instrument rather than a stack of unrelated
          fields. `Select`'s own root wrapper is hardcoded `w-full` (its
          `className` prop only reaches the inner trigger button, not the
          sizing wrapper around it), so each select is wrapped in its own
          width-constrained `div` here rather than relying on a width passed
          to `Select` itself - otherwise each one claims the full row width
          and pushes every sibling onto its own line, which is the bug this
          replaces.
        */}
        <div className="flex flex-wrap items-center gap-3">
          {scope === 'trash' ? (
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Deleted documents stay here for {TRASH_PURGE_DAYS} days, then they're gone for good.
              </p>
              {isElevated && (
                <div className="mt-2 flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setTrashEveryone(false)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${!trashEveryone ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    My trash
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrashEveryone(true)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${trashEveryone ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Everyone's trash
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="relative min-w-[14rem] flex-1 basis-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, or a word inside a document…"
                  aria-label="Search documents"
                  className="h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                />
              </div>

              <div className="w-40 shrink-0">
                <Select
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: '', label: 'All categories' },
                    { value: 'personnel', label: 'Personal' },
                    { value: 'organization', label: 'Organisation' },
                  ]}
                />
              </div>

              <div className="w-48 shrink-0">
                <Select value={documentType} onChange={setDocumentType} options={typeOptions} />
              </div>
            </>
          )}

          {/* Only mine / everything I may see — see this component's docblock. */}
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${scope === 'mine' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              My documents
            </button>
            <button
              type="button"
              onClick={() => setScope('visible')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${scope === 'visible' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Everything I can see
            </button>
            <button
              type="button"
              onClick={() => setScope('trash')}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${scope === 'trash' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Trash
            </button>
          </div>

          <div className={`ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 ${scope === 'trash' ? 'invisible' : ''}`}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Grid2x2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Surface>

      <div className="flex min-w-0 items-start gap-4">
        {scope !== 'trash' && (
          <Surface className="hidden w-56 shrink-0 p-2 @3xl/docs:block md:block">
            <DocumentFolderTree nodes={folderTree} selectedId={currentFolderId} onSelect={setCurrentFolderId} />
          </Surface>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          {scope !== 'trash' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Folder path">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(null)}
                  className={cn('rounded px-1.5 py-0.5 hover:text-foreground', currentFolderId === null && 'font-medium text-foreground')}
                >
                  Home
                </button>
                {breadcrumbPath.map((node) => (
                  <span key={node.id} className="flex items-center gap-1">
                    <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(node.id)}
                      className={cn('rounded px-1.5 py-0.5 hover:text-foreground', node.id === currentFolderId && 'font-medium text-foreground')}
                    >
                      {node.name}
                    </button>
                  </span>
                ))}
              </nav>
              <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus className="mr-1.5 size-3.5" aria-hidden="true" />
                New folder
              </Button>
            </div>
          )}

          {scope === 'trash' ? (
        trashLoading ? (
          <Surface className="p-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          </Surface>
        ) : trashError ? (
          <Surface className="p-10 text-center">
            <p className="text-sm text-destructive">{trashError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadTrash()}>
              Retry
            </Button>
          </Surface>
        ) : trashResults.length === 0 ? (
          <Surface>
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Trash2 className="size-10 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-foreground">Trash is empty</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                {trashEveryone
                  ? "Nothing deleted in the tenant right now."
                  : "Documents you remove stay here until they're restored or purged."}
              </p>
            </div>
          </Surface>
        ) : (
          <Surface className="overflow-hidden">
            <ul className="divide-y divide-border">
              {trashResults.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{doc.title || 'Untitled'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[typeLabel(doc.document_type), `deleted ${new Date(doc.deleted_at.replace(' ', 'T')).toLocaleDateString()}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge variant="warning" className="shrink-0 text-[10px] uppercase tracking-wide">
                    Purges in {daysUntil(doc.purge_at)}d
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-xs"
                    disabled={restoringId !== null}
                    onClick={() => void restoreFromTrash(doc)}
                  >
                    {restoringId === doc.id ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                    )}
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </Surface>
        )
      ) : loading ? (
        <div className="@container/docs">
          <div className="grid grid-cols-1 gap-4 @lg/docs:grid-cols-2 @3xl/docs:grid-cols-3 @6xl/docs:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Surface className="p-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </Surface>
      ) : results.length === 0 && currentSubfolders.length === 0 ? (
        <Surface>
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <FileSearch className="size-10 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              {debouncedQuery ? `Nothing matches “${debouncedQuery}”` : 'Nothing here yet'}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              {debouncedQuery
                ? 'Try a different word, or check the filters above.'
                : 'Upload your first document — a resume, a certificate, anything — and it becomes searchable by its contents, not just its name.'}
            </p>
            {!debouncedQuery && (
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                Upload a document
              </Button>
            )}
          </div>
        </Surface>
      ) : viewMode === 'grid' ? (
        <DocumentCardGrid
          documents={results}
          typeLabel={typeLabel}
          downloadingId={downloadingId}
          onOpen={(doc) => setViewing(doc)}
          onOpenDetails={(doc) => setDetailDoc(doc)}
          onDownload={(doc) => void download(doc)}
          onDelete={(doc) => setPendingDelete(doc)}
          onMove={(doc) => {
            setMoveTargetFolderId(currentFolderId ? String(currentFolderId) : '')
            setMovingDoc(doc)
          }}
          canDelete={canDelete}
          folders={currentSubfolders}
          onOpenFolder={(folder) => setCurrentFolderId(folder.id)}
          onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
          canManageFolder={canManageFolderClient}
        />
      ) : (
        <Surface className="overflow-hidden">
          <ul className="divide-y divide-border">
            {currentSubfolders.map((folder) => (
              <li key={`folder-${folder.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FolderPlus className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-foreground">{folder.name}</span>
                </button>
                {canManageFolderClient(folder) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDeleteFolder(folder)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
            {results.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <button
                  type="button"
                  onClick={() => setDetailDoc(doc)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-foreground">{doc.title || 'Untitled'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[typeLabel(doc.document_type), doc.source_system ? `from ${doc.source_system}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => void download(doc)} disabled={downloadingId !== null}>
                  Download
                </Button>
                {canDelete(doc) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDelete(doc)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Surface>
      )}

          {scope !== 'trash' && !loading && !error && total > PER_PAGE && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) {
            setProcessingDoc(null)
            setBatchFiles(null)
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {processingDoc ? 'Reading your document' : batchFiles ? 'Uploading your files' : 'Upload documents'}
            </DialogTitle>
            <DialogDescription>
              {processingDoc
                ? 'This only takes a moment — you can close this and keep working, it finishes in the background.'
                : batchFiles
                  ? 'Each file finishes reading and classification in the background — you can close this and keep working.'
                  : 'PDF, Office, an image, or a whole folder. Content becomes searchable automatically.'}
            </DialogDescription>
          </DialogHeader>
          {processingDoc ? (
            <DocumentProcessingProgress
              documentId={processingDoc.id}
              fileName={processingDoc.fileName}
              onFinished={finishProcessing}
            />
          ) : batchFiles ? (
            <DocumentBatchUploadProgress files={batchFiles} />
          ) : (
            <DocumentUploadDropzone types={types} uploading={uploading} onUpload={upload} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Created inside {currentFolderId === null ? 'Home' : (breadcrumbPath.at(-1)?.name ?? 'this folder')}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            maxLength={191}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createFolderHandler()
            }}
          />
          <Button onClick={() => void createFolderHandler()} disabled={!newFolderName.trim() || creatingFolder}>
            {creatingFolder ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : <FolderPlus className="mr-2 size-4" aria-hidden="true" />}
            Create
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={movingDoc !== null} onOpenChange={(open) => !open && setMovingDoc(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Move "{movingDoc?.title ?? 'document'}"</DialogTitle>
            <DialogDescription>Choose where it should live.</DialogDescription>
          </DialogHeader>
          <SearchableSelect
            options={folderOptions}
            value={moveTargetFolderId}
            onChange={setMoveTargetFolderId}
            placeholder="Choose a folder"
            aria-label="Destination folder"
          />
          <Button onClick={() => void moveDocumentHandler()} disabled={moving}>
            {moving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            Move
          </Button>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        open={viewing !== null}
        onOpenChange={(next) => {
          if (!next) setViewing(null)
        }}
        documentId={viewing?.id ?? null}
        title={viewing?.title ?? ''}
        mimeType={viewing?.mime_type}
        fileName={viewing?.original_file_name}
      />

      <DocumentDetailDialog
        documentId={detailDoc?.id ?? null}
        typeLabel={typeLabel}
        types={types}
        downloading={downloadingId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailDoc(null)
        }}
        onPreview={() => {
          if (detailDoc) setViewing(detailDoc)
        }}
        onDownload={() => {
          if (detailDoc) void download(detailDoc)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Remove "${pendingDelete?.title ?? 'this document'}"?`}
        description="It is taken off your personnel record. An administrator can restore it, but you will not see it here again."
        confirmLabel="Remove it"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={pendingDeleteFolder !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFolder(null)
        }}
        title={`Remove folder "${pendingDeleteFolder?.name ?? ''}"?`}
        description="Empty it first — move or remove everything inside, then this folder can be deleted."
        confirmLabel="Remove it"
        busy={deletingFolder}
        onConfirm={() => void confirmDeleteFolder()}
      />
    </DocumentsPage>
  )
}
