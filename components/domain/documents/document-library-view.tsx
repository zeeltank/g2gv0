'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Clock,
  FileSearch,
  FileText,
  FolderPlus,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Square,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  type RecentDocumentHit,
  type TrashedDocument,
} from '@/services/account'
import { myHrService } from '@/services/hrms/my-hr'
import { organizationService } from '@/services/organization'
import { useDocumentClipboard } from '@/hooks/use-document-clipboard'
import { DocumentCardGrid, type GridCardSize } from './document-card-grid'
import { DocumentDetailDialog } from './document-detail-dialog'
import { DocumentFolderTree } from './document-folder-tree'
import { assignFolderIds, type DiscoveredFile } from './document-folder-upload'
import { DocumentProcessingProgress } from './document-processing-progress'
import { DocumentBatchUploadProgress, type BatchFileState } from './document-batch-upload-progress'
import { DocumentTableView } from './document-table-view'
import { DocumentUploadDropzone } from './document-upload-dropzone'
import { DocumentsPage, Notice, SectionHeader, Surface } from './documents-ui'

type ViewMode = 'grid' | 'list'
type Scope = 'mine' | 'visible' | 'trash' | 'recent' | 'starred'

/** The "View" menu's options — a File-Explorer-style icon-size ladder down to the table, each a real, wired mode (no Details pane / Content / Tiles entries carried over from that reference, since none of those have anything behind them here). */
const VIEW_OPTIONS: Array<{ value: GridCardSize | 'list'; label: string; icon: typeof Grid2x2 }> = [
  { value: 'xlarge', label: 'Extra large icons', icon: Square },
  { value: 'large', label: 'Large icons', icon: Grid2x2 },
  { value: 'medium', label: 'Medium icons', icon: Grid3x3 },
  { value: 'small', label: 'Small icons', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
]

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

/** Every id under (not including) this node — client-side mirror of the server's own cycle guard, for filtering the move-folder picker's options, not a substitute for it. */
function collectDescendantIds(node: DocumentFolderNode): number[] {
  return node.children.flatMap((child) => [child.id, ...collectDescendantIds(child)])
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

  // Search power-up: date range, an elevated-only department filter, and a
  // "search everywhere" escape hatch from the current folder - all only
  // shown once a query is actually typed (see the filter row below), since
  // none of them mean anything on a bare folder browse.
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchDepartmentId, setSearchDepartmentId] = useState('')
  const [searchEverywhere, setSearchEverywhere] = useState(false)
  const [departmentOptions, setDepartmentOptions] = useState<SearchableOption[]>([])

  const [recentResults, setRecentResults] = useState<RecentDocumentHit[]>([])
  const [starredResults, setStarredResults] = useState<DocumentSearchHit[]>([])

  const clipboard = useDocumentClipboard()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [gridSize, setGridSize] = useState<GridCardSize>('large')
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
  const [movingFolder, setMovingFolder] = useState<DocumentFolderNode | null>(null)
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
  }, [debouncedQuery, category, documentType, scope, currentFolderId, dateFrom, dateTo, searchDepartmentId, searchEverywhere])

  // The department filter is elevated-only - a non-elevated caller's
  // visible set never crosses departments anyway (DocumentAccess already
  // scopes it to their own), so the control would just be misleading noise
  // for them. Loaded once, not per keystroke - this is a short, stable list.
  useEffect(() => {
    if (!isElevated) return
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    organizationService
      .getDepartmentsManagement(context)
      .then((response) => {
        const list = response.departments ?? response.main_departments ?? []
        setDepartmentOptions([
          { value: '', label: 'All departments' },
          ...list.map((d) => ({ value: String(d.id), label: d.department })),
        ])
      })
      .catch(() => {
        // The filter is a narrowing convenience, not load-bearing - it just stays empty on failure.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElevated])

  const load = useCallback(async () => {
    if (scope === 'trash') return

    if (scope === 'recent') {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await accountService.getRecentDocuments(context)
        setRecentResults(response.data ?? [])
      } catch (caught) {
        setRecentResults([])
        setError(caught instanceof Error ? caught.message : 'Recent documents could not be loaded.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (scope === 'starred') {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await accountService.getStarredDocuments(context)
        setStarredResults(response.data ?? [])
      } catch (caught) {
        setStarredResults([])
        setError(caught instanceof Error ? caught.message : 'Starred documents could not be loaded.')
      } finally {
        setLoading(false)
      }
      return
    }

    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // "Search everywhere" only means anything once a term is typed (same
    // reasoning the filter row below hides it otherwise) - folder_id is
    // omitted entirely (not set to 0) to search unfiltered by folder,
    // per DocumentSearchService::applyFilters()'s own presence-not-
    // truthiness convention for this field.
    const everywhere = searchEverywhere && debouncedQuery !== ''

    try {
      const response = await accountService.searchDocuments(context, {
        q: debouncedQuery || undefined,
        category: (category as 'personnel' | 'organization') || undefined,
        document_type: documentType || undefined,
        owner_id: scope === 'mine' && myId ? myId : undefined,
        folder_id: everywhere ? undefined : (currentFolderId ?? 0),
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        department_id: isElevated && searchDepartmentId ? Number(searchDepartmentId) : undefined,
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
  }, [
    resolveContext,
    debouncedQuery,
    category,
    documentType,
    scope,
    myId,
    currentFolderId,
    page,
    dateFrom,
    dateTo,
    searchDepartmentId,
    searchEverywhere,
    isElevated,
  ])

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
  /** For moving a FOLDER: excludes the folder itself and its own descendants — picking one would be rejected by the server's cycle guard anyway, but filtering it out here means the picker never offers an obviously-invalid destination. */
  const folderMoveOptions: SearchableOption[] = useMemo(() => {
    if (!movingFolder) return []
    const excluded = new Set(collectDescendantIds(movingFolder))
    excluded.add(movingFolder.id)

    return [
      { value: '', label: 'Home (no folder)' },
      ...flattenFolders(folderTree)
        .filter((f) => !excluded.has(f.id))
        .map((f) => ({ value: String(f.id), label: `${'— '.repeat(f.depth)}${f.name}` })),
    ]
  }, [folderTree, movingFolder])

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
      // Display-only - the filename stem shown while this uploads/processes.
      // The server gets an EMPTY title (not this), so it can record
      // title_source='filename' and let AI improve it later; sending this
      // string as the real title would wrongly mark it title_source='user'
      // and block that improvement forever (see fileDocument()'s docblock).
      const displayTitle = file.name.replace(/\.[^.]+$/, '')

      try {
        const response = await accountService.uploadDocument(context, file, '', docType, {
          category: 'personnel',
          folderId: currentFolderId,
        })
        const id = response.data?.id

        if (id) {
          setProcessingDoc({ id, fileName: file.name, title: displayTitle })
        } else {
          setUploadOpen(false)
          setNotice({ tone: 'info', text: `“${displayTitle}” was uploaded. It will appear in search shortly.` })
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

        try {
          // Empty title - same reasoning as the single-file branch above:
          // the server's own filename fallback records title_source='filename',
          // not 'user', so AI can still improve it afterward.
          await accountService.uploadDocument(context, entry.file, '', docType, {
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

  /** The server's move() endpoint has the real cycle guard (walks the proposed new parent's ancestor chain) - this is a convenience call, not a second implementation of that check. */
  async function moveFolderHandler() {
    if (!movingFolder || moving) return
    setMoving(true)

    try {
      const targetId = moveTargetFolderId ? Number(moveTargetFolderId) : null
      const response = await accountService.moveFolder(resolveContext(), movingFolder.id, targetId)
      if (response.status === 1) {
        setMovingFolder(null)
        setNotice({ tone: 'info', text: `"${movingFolder.name}" was moved.` })
        await loadFolderTree()
      } else {
        setNotice({ tone: 'error', text: response.message ?? 'That folder could not be moved.' })
      }
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That folder could not be moved.' })
    } finally {
      setMoving(false)
    }
  }

  /** Double-click-to-rename on a document's name — same owner-only gate as move/delete (`updateDocument` is "Owner-only, same as delete" server-side). */
  async function renameDocumentHandler(doc: DocumentSearchHit, title: string) {
    const trimmed = title.trim()
    if (!trimmed || trimmed === doc.title) return

    try {
      await accountService.updateDocument(resolveContext(), doc.id, { title: trimmed })
      await load()
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That document could not be renamed.' })
    }
  }

  /** Double-click-to-rename on a folder's name — gated the same as move/delete (`canManageFolderClient`). */
  async function renameFolderHandler(folder: DocumentFolderNode, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === folder.name) return

    try {
      const response = await accountService.renameFolder(resolveContext(), folder.id, trimmed)
      if (response.status === 1) {
        await loadFolderTree()
      } else {
        setNotice({ tone: 'error', text: response.message ?? 'That folder could not be renamed.' })
      }
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That folder could not be renamed.' })
    }
  }

  /** Optimistic — flips the flag everywhere this document might currently be shown, then confirms with the server; reverts (and shows a notice) only if that call actually fails. */
  async function toggleStar(doc: DocumentSearchHit) {
    const next = !doc.starred
    const applyFlag = (flag: boolean) => (list: DocumentSearchHit[]) =>
      list.map((d) => (d.id === doc.id ? { ...d, starred: flag } : d))

    setResults(applyFlag(next))
    setRecentResults((list) => applyFlag(next)(list) as RecentDocumentHit[])
    setStarredResults((list) => (next ? list : list.filter((d) => d.id !== doc.id)))

    try {
      if (next) {
        await accountService.starDocument(resolveContext(), doc.id)
      } else {
        await accountService.unstarDocument(resolveContext(), doc.id)
      }
    } catch (caught) {
      setResults(applyFlag(doc.starred))
      setRecentResults((list) => applyFlag(doc.starred)(list) as RecentDocumentHit[])
      if (doc.starred) setStarredResults((list) => (list.some((d) => d.id === doc.id) ? list : [...list, doc]))
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That could not be updated.' })
    }
  }

  /**
   * Paste = move (cut) or duplicate (copy) into `destinationFolderId`
   * (null = Home/root) — see `useDocumentClipboard`'s own docblock for why
   * the clipboard itself is local to this one screen. Cleared after every
   * paste, including a copy: unlike a desktop OS clipboard, this keeps the
   * mental model simple (one paste per cut-or-copy) rather than quietly
   * letting a stale copy get pasted again somewhere unexpected later.
   */
  async function pasteInto(destinationFolderId: number | null) {
    const entry = clipboard.entry
    if (!entry) return

    try {
      if (entry.kind === 'document') {
        if (entry.mode === 'cut') {
          await accountService.moveDocument(resolveContext(), entry.id, destinationFolderId)
        } else {
          await accountService.duplicateDocument(resolveContext(), entry.id, destinationFolderId)
        }
      } else if (entry.mode === 'cut') {
        const response = await accountService.moveFolder(resolveContext(), entry.id, destinationFolderId)
        if (response.status !== 1) {
          setNotice({ tone: 'error', text: response.message ?? 'That folder could not be moved.' })
          return
        }
      } else {
        const response = await accountService.duplicateFolder(resolveContext(), entry.id, destinationFolderId)
        if (response.status !== 1) {
          setNotice({ tone: 'error', text: response.message ?? 'That folder could not be copied.' })
          return
        }
      }

      clipboard.clear()
      setNotice({ tone: 'info', text: `"${entry.name}" was ${entry.mode === 'cut' ? 'moved' : 'copied'}.` })
      await load()
      await loadFolderTree()
    } catch (caught) {
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That could not be pasted.' })
    }
  }

  // Global Ctrl+V - the one clipboard action a keyboard shortcut can mean
  // unambiguously here. Cut/Copy stay mouse-driven (via each tile's own
  // context menu): this screen has no multi-select model, so there is no
  // well-defined "the selected item" for a keyboard shortcut to act on -
  // but "paste into wherever I'm currently browsing" is always well-defined.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'v') return
      if (!clipboard.entry) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (scope !== 'mine') return

      e.preventDefault()
      void pasteInto(currentFolderId)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboard.entry, scope, currentFolderId])

  const canDelete = useCallback((doc: DocumentSearchHit) => myId !== null && doc.owner_id === myId, [myId])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Recent/Starred are flat, caller-centric lists with no folder dimension
  // (see the plan's own reasoning: same as Trash, a department filter or
  // folder browse makes no sense on either) - so both the folders shown and
  // the pagination controls below are skipped entirely for these two scopes.
  const displayedResults = scope === 'recent' ? recentResults : scope === 'starred' ? starredResults : results
  const displayedFolders = scope === 'recent' || scope === 'starred' ? [] : currentSubfolders

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
          ) : scope === 'recent' || scope === 'starred' ? (
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {scope === 'recent'
                  ? 'Documents you have actually opened, newest first.'
                  : 'Documents you have starred, newest-starred first.'}
              </p>
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

          {/* Scope (My Drive / Shared with me / Bin) now lives in the left rail, Drive-style — see the sidebar below. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`ml-auto shrink-0 gap-1.5 ${scope === 'trash' ? 'invisible' : ''}`}>
                {(() => {
                  const ActiveIcon = VIEW_OPTIONS.find((o) => o.value === (viewMode === 'list' ? 'list' : gridSize))?.icon ?? Grid2x2
                  return <ActiveIcon className="size-4" aria-hidden="true" />
                })()}
                View
                <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup
                value={viewMode === 'list' ? 'list' : gridSize}
                onValueChange={(value) => {
                  if (value === 'list') {
                    setViewMode('list')
                  } else {
                    setViewMode('grid')
                    setGridSize(value as GridCardSize)
                  }
                }}
              >
                {VIEW_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
                  <DropdownMenuRadioItem key={value} value={value} className="gap-2">
                    <OptionIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/*
          The search power-up — date range, an elevated-only department
          filter, and a "this folder / everywhere" toggle — only once a term
          is actually typed, matching the automatic relevance-vs-newest sort
          below (DocumentSearchService::search()'s own docblock): none of
          these mean anything on a bare folder browse.
        */}
        {scope !== 'trash' && scope !== 'recent' && scope !== 'starred' && debouncedQuery !== '' && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Document date from"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Document date to"
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>

            {isElevated && departmentOptions.length > 0 && (
              <div className="w-48 shrink-0">
                <Select value={searchDepartmentId} onChange={setSearchDepartmentId} options={departmentOptions} />
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setSearchEverywhere(false)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${!searchEverywhere ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                This folder
              </button>
              <button
                type="button"
                onClick={() => setSearchEverywhere(true)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${searchEverywhere ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Everywhere
              </button>
            </div>
          </div>
        )}
      </Surface>

      <div className="flex min-w-0 items-start gap-4">
        {/*
          `sticky` + a viewport-relative `max-h`, not `self-stretch` to the
          document list's own height — the list can run to many rows, and
          stretching the rail to match it was pushing "Shared with me"/"Bin"
          far down the page, off the first screen. Bounding this to the
          viewport instead means the whole rail (tree AND its pinned footer)
          is on-screen immediately, and stays put while the list scrolls.
        */}
        <Surface className="sticky top-4 hidden max-h-[calc(100vh-2rem)] w-64 shrink-0 flex-col p-2 @3xl/docs:flex md:flex">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocumentFolderTree
              nodes={folderTree}
              selectedId={scope === 'mine' ? currentFolderId : -1}
              onSelect={(id) => {
                setScope('mine')
                setCurrentFolderId(id)
              }}
            />
          </div>

          {/* Pinned to the bottom of the rail, Explorer/Drive-style — a quick-nav footer, not part of the scrolling tree above. */}
          <div className="mt-auto shrink-0 pt-2">
            <div className="mb-2 border-t border-border" />
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setScope('recent')}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
                    scope === 'recent' ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Clock className={cn('size-4 shrink-0', scope === 'recent' ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  Recent
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScope('starred')}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
                    scope === 'starred' ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Star className={cn('size-4 shrink-0', scope === 'starred' ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  Starred
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setScope('visible')
                    setCurrentFolderId(null)
                  }}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
                    scope === 'visible' ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Users className={cn('size-4 shrink-0', scope === 'visible' ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  Shared with me
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setScope('trash')}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
                    scope === 'trash' ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <Trash2 className={cn('size-4 shrink-0', scope === 'trash' ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  Bin
                </button>
              </li>
            </ul>
          </div>
        </Surface>

        <div className="min-w-0 flex-1 space-y-4">
          {scope !== 'trash' && scope !== 'recent' && scope !== 'starred' && (
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
              <div className="flex items-center gap-2">
                {scope === 'mine' && clipboard.entry && (
                  <Button variant="outline" size="sm" onClick={() => void pasteInto(currentFolderId)}>
                    <ClipboardPaste className="mr-1.5 size-3.5" aria-hidden="true" />
                    Paste &quot;{clipboard.entry.name}&quot;
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
                  <FolderPlus className="mr-1.5 size-3.5" aria-hidden="true" />
                  New folder
                </Button>
              </div>
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
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
      ) : displayedResults.length === 0 && displayedFolders.length === 0 ? (
        <Surface>
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            {scope === 'recent' ? (
              <Clock className="size-10 text-muted-foreground" aria-hidden="true" />
            ) : scope === 'starred' ? (
              <Star className="size-10 text-muted-foreground" aria-hidden="true" />
            ) : (
              <FileSearch className="size-10 text-muted-foreground" aria-hidden="true" />
            )}
            <h3 className="text-lg font-semibold text-foreground">
              {scope === 'recent'
                ? "You haven't opened anything yet"
                : scope === 'starred'
                  ? 'Nothing starred yet'
                  : debouncedQuery
                    ? `Nothing matches “${debouncedQuery}”`
                    : 'Nothing here yet'}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              {scope === 'recent'
                ? 'Documents you preview or download will show up here.'
                : scope === 'starred'
                  ? 'Star a document from its card or row to find it here quickly later.'
                  : debouncedQuery
                    ? 'Try a different word, or check the filters above.'
                    : 'Upload your first document — a resume, a certificate, anything — and it becomes searchable by its contents, not just its name.'}
            </p>
            {scope !== 'recent' && scope !== 'starred' && !debouncedQuery && (
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                Upload a document
              </Button>
            )}
          </div>
        </Surface>
      ) : viewMode === 'grid' ? (
        <DocumentCardGrid
          documents={displayedResults}
          typeLabel={typeLabel}
          downloadingId={downloadingId}
          size={gridSize}
          onOpen={(doc) => setViewing(doc)}
          onOpenDetails={(doc) => setDetailDoc(doc)}
          onDownload={(doc) => void download(doc)}
          onDelete={(doc) => setPendingDelete(doc)}
          onMove={(doc) => {
            setMoveTargetFolderId(currentFolderId ? String(currentFolderId) : '')
            setMovingDoc(doc)
          }}
          onRename={(doc, title) => void renameDocumentHandler(doc, title)}
          canDelete={canDelete}
          folders={displayedFolders}
          onOpenFolder={(folder) => setCurrentFolderId(folder.id)}
          onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
          onMoveFolder={(folder) => {
            setMoveTargetFolderId(folder.parent_id ? String(folder.parent_id) : '')
            setMovingFolder(folder)
          }}
          onRenameFolder={(folder, name) => void renameFolderHandler(folder, name)}
          canManageFolder={canManageFolderClient}
          onToggleStar={(doc) => void toggleStar(doc)}
          onCut={(doc) => clipboard.cut('document', doc.id, doc.title ?? 'Document')}
          onCopy={(doc) => clipboard.copy('document', doc.id, doc.title ?? 'Document')}
          onCutFolder={(folder) => clipboard.cut('folder', folder.id, folder.name)}
          onCopyFolder={(folder) => clipboard.copy('folder', folder.id, folder.name)}
          hasClipboard={clipboard.entry !== null}
          onPasteIntoFolder={(folder) => void pasteInto(folder.id)}
        />
      ) : (
        <DocumentTableView
          documents={displayedResults}
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
          folders={displayedFolders}
          onOpenFolder={(folder) => setCurrentFolderId(folder.id)}
          onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
          onMoveFolder={(folder) => {
            setMoveTargetFolderId(folder.parent_id ? String(folder.parent_id) : '')
            setMovingFolder(folder)
          }}
          canManageFolder={canManageFolderClient}
          onToggleStar={(doc) => void toggleStar(doc)}
          onCut={(doc) => clipboard.cut('document', doc.id, doc.title ?? 'Document')}
          onCopy={(doc) => clipboard.copy('document', doc.id, doc.title ?? 'Document')}
          onCutFolder={(folder) => clipboard.cut('folder', folder.id, folder.name)}
          onCopyFolder={(folder) => clipboard.copy('folder', folder.id, folder.name)}
          hasClipboard={clipboard.entry !== null}
          onPasteIntoFolder={(folder) => void pasteInto(folder.id)}
        />
      )}

          {scope !== 'trash' && scope !== 'recent' && scope !== 'starred' && !loading && !error && total > PER_PAGE && (
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

      <Dialog
        open={movingDoc !== null || movingFolder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMovingDoc(null)
            setMovingFolder(null)
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Move "{movingFolder?.name ?? movingDoc?.title ?? 'item'}"</DialogTitle>
            <DialogDescription>Choose where it should live.</DialogDescription>
          </DialogHeader>
          <SearchableSelect
            options={movingFolder ? folderMoveOptions : folderOptions}
            value={moveTargetFolderId}
            onChange={setMoveTargetFolderId}
            placeholder="Choose a folder"
            aria-label="Destination folder"
          />
          <Button onClick={() => void (movingFolder ? moveFolderHandler() : moveDocumentHandler())} disabled={moving}>
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
