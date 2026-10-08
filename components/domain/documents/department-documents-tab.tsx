'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, FileSearch, FolderPlus, Grid2x2, List, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/settings/sections/section-primitives'
import { DocumentViewer } from '@/components/shared/business/document-viewer'
import { cn } from '@/lib/utils'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import {
  accountService,
  type AccountDocument,
  type DocumentFolderNode,
  type DocumentSearchHit,
  type DocumentTypeChoices,
} from '@/services/account'
import { DocumentCardGrid } from '@/domain/documents/document-card-grid'
import { DocumentTableView } from '@/domain/documents/document-table-view'
import { DocumentDetailDialog } from '@/domain/documents/document-detail-dialog'
import { DocumentFolderTree } from '@/domain/documents/document-folder-tree'
import { assignFolderIds, type DiscoveredFile } from '@/domain/documents/document-folder-upload'
import { DocumentProcessingProgress } from '@/domain/documents/document-processing-progress'
import { DocumentBatchUploadProgress, type BatchFileState } from '@/domain/documents/document-batch-upload-progress'
import { DocumentUploadDropzone } from '@/domain/documents/document-upload-dropzone'
import { Notice, Surface } from '@/domain/documents/documents-ui'

type ViewMode = 'grid' | 'list'
const PER_PAGE = 24

/** Depth-first search over the server-built tree — same helper document-library-view.tsx already has, duplicated rather than exported/shared: these are five-line pure functions over a type both files already import, not worth a new shared module for. */
function findFolderNode(nodes: DocumentFolderNode[], id: number): DocumentFolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findFolderNode(node.children, id)
    if (found) return found
  }
  return null
}

function findFolderPath(nodes: DocumentFolderNode[], id: number, path: DocumentFolderNode[] = []): DocumentFolderNode[] | null {
  for (const node of nodes) {
    const nextPath = [...path, node]
    if (node.id === id) return nextPath
    const found = findFolderPath(node.children, id, nextPath)
    if (found) return found
  }
  return null
}

function flattenFolders(nodes: DocumentFolderNode[], depth = 0): Array<{ id: number; name: string; depth: number }> {
  return nodes.flatMap((node) => [{ id: node.id, name: node.name, depth }, ...flattenFolders(node.children, depth + 1)])
}

/**
 * The "Documents" tab on a department's admin detail page
 * (department-detail-page.tsx) — that department's own shared document
 * space, with full folder browsing (create/move/recursive+zip upload),
 * reusing the exact same presentational pieces the main Document Library
 * page does (DocumentCardGrid, DocumentTableView, DocumentFolderTree,
 * DocumentUploadDropzone/DocumentBatchUploadProgress/
 * DocumentProcessingProgress) so the two never visually drift apart.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SEPARATE, SMALLER ORCHESTRATOR — NOT A MODE BOLTED ONTO THE MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `document-library-view.tsx` is ~1100 lines of tightly-coupled state (My/
 * Everyone/Trash scope, grid-size presets, pagination, nine dialogs). This
 * component is independent of it on purpose: zero lines of that file change
 * to ship this tab, so the highest-traffic page in the product carries zero
 * regression risk from this feature. What's reused is only the already-
 * generic, plain-props presentational layer — the same components a THIRD
 * context (my-department-documents.tsx, the employee self-service screen)
 * also mounts independently.
 *
 * Deliberately narrower than the main page: no trash (cross-cutting by "who
 * deleted it," not department-shaped — the main library's own trash stays
 * the path for that), no My/Everyone toggle (this tab IS the "this
 * department" scope, always), no grid-size presets (one sensible default).
 *
 * ── UPLOADS ALWAYS TAG `visibility: 'department'` ───────────────────────────
 *
 * Unlike the main page (which defaults an unset visibility to 'private'
 * server-side), every upload and folder-create from here explicitly sends
 * `visibility: 'department'` — a department's own shared space whose
 * default upload is invisible to the department it was filed under would
 * defeat the entire point of this tab existing.
 *
 * ── WHOSE DEPARTMENT A FILE LANDS UNDER ─────────────────────────────────────
 *
 * `canManage` (passed down from department-detail-page.tsx, the same
 * `department-list` role check every sibling tab already uses) picks which
 * backend route gets called: the elevated `*ForDepartment` family when true
 * (tags to `department.id` regardless of the caller's own department — HR-
 * elevated-only on the server, see `storeForDepartment()`'s own docblock),
 * or the plain self-service routes otherwise, which only ever work
 * correctly here when the viewer's own department already matches the one
 * being viewed (true for department_head/reporting_manager viewing their
 * own department, the only one `scopeDepartments()` lets them reach).
 */
export function DepartmentDocumentsTab({
  department,
  context,
  canManage,
}: {
  department: Department
  context: LaravelContext
  canManage: boolean
}) {
  const departmentId = Number(department.id)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
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
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const [viewing, setViewing] = useState<AccountDocument | null>(null)
  const [detailDoc, setDetailDoc] = useState<DocumentSearchHit | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [folderTree, setFolderTree] = useState<DocumentFolderNode[]>([])
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<DocumentFolderNode | null>(null)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [movingFolder, setMovingFolder] = useState<DocumentFolderNode | null>(null)
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, currentFolderId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await accountService.searchDocuments(context, {
        q: debouncedQuery || undefined,
        department_id: departmentId,
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
  }, [context, debouncedQuery, departmentId, currentFolderId, page])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const loadFolderTree = useCallback(async () => {
    try {
      const response = await accountService.getFolderTree(context, departmentId)
      setFolderTree(response.data ?? [])
    } catch {
      // Supplementary to the document list - a failure here should not
      // block browsing documents at all; it just stays empty.
    }
  }, [context, departmentId])

  useEffect(() => {
    queueMicrotask(() => void loadFolderTree())
  }, [loadFolderTree])

  const currentSubfolders = useMemo(
    () => (currentFolderId === null ? folderTree : (findFolderNode(folderTree, currentFolderId)?.children ?? [])),
    [folderTree, currentFolderId],
  )
  const breadcrumbPath = useMemo(
    () => (currentFolderId === null ? [] : (findFolderPath(folderTree, currentFolderId) ?? [])),
    [folderTree, currentFolderId],
  )

  function collectDescendantIds(node: DocumentFolderNode): number[] {
    return node.children.flatMap((child) => [child.id, ...collectDescendantIds(child)])
  }

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

  const typeLabel = useCallback(
    (key: string | null) => (key ? (types.personnel[key] ?? types.organization[key] ?? key) : null),
    [types],
  )

  async function upload(files: DiscoveredFile[], docType: string, directoryPaths: string[]) {
    setNotice(null)

    if (files.length === 1 && directoryPaths.length === 0) {
      setUploading(true)
      const file = files[0].file
      const displayTitle = file.name.replace(/\.[^.]+$/, '')

      try {
        const response = canManage
          ? await accountService.uploadDocumentForDepartment(context, departmentId, file, '', docType, {
              category: 'organization',
              visibility: 'department',
              folderId: currentFolderId,
            })
          : await accountService.uploadDocument(context, file, '', docType, {
              category: 'organization',
              visibility: 'department',
              folderId: currentFolderId,
            })
        const id = response.data?.id

        if (id) {
          setProcessingDoc({ id, fileName: file.name, title: displayTitle })
        } else {
          setUploadOpen(false)
          setNotice({ tone: 'info', text: `"${displayTitle}" was uploaded. It will appear in search shortly.` })
          setPage(1)
          await load()
        }
      } catch (caught) {
        setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That document could not be uploaded.' })
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
        const resolved = canManage
          ? await accountService.resolveFolderPathsForDepartment(context, departmentId, directoryPaths, currentFolderId, 'department')
          : await accountService.resolveFolderPaths(context, directoryPaths, currentFolderId)
        pathToFolderId = resolved.data
      }

      const withFolders = assignFolderIds(files, pathToFolderId, currentFolderId)

      for (const entry of withFolders) {
        setBatchFiles((current) => current?.map((f) => (f.key === entry.relativePath ? { ...f, status: 'uploading' } : f)) ?? current)

        try {
          if (canManage) {
            await accountService.uploadDocumentForDepartment(context, departmentId, entry.file, '', docType, {
              category: 'organization',
              visibility: 'department',
              folderId: entry.folderId,
            })
          } else {
            await accountService.uploadDocument(context, entry.file, '', docType, {
              category: 'organization',
              visibility: 'department',
              folderId: entry.folderId,
            })
          }
          setBatchFiles((current) => current?.map((f) => (f.key === entry.relativePath ? { ...f, status: 'done' } : f)) ?? current)
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
        ? `"${title}" is filed and searchable by title, but automatic classification hit a snag.`
        : outcome.timedOut
          ? `"${title}" is filed and searchable. Classification is taking a little longer than usual and will finish in the background.`
          : `"${title}" is filed, read, and classified — fully searchable now.`,
    })
    setPage(1)
    void load()
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
      setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'That document could not be downloaded.' })
    } finally {
      setDownloadingId(null)
    }
  }

  async function createFolderHandler() {
    const name = newFolderName.trim()
    if (!name || creatingFolder) return

    setCreatingFolder(true)
    try {
      if (canManage) {
        await accountService.createFolderForDepartment(context, departmentId, name, currentFolderId, 'department')
      } else {
        await accountService.createFolder(context, name, currentFolderId, 'department')
      }
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
      const response = await accountService.deleteFolder(context, pendingDeleteFolder.id)
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

  async function moveFolderHandler() {
    if (!movingFolder || moving) return
    setMoving(true)

    try {
      const targetId = moveTargetFolderId ? Number(moveTargetFolderId) : null
      const response = await accountService.moveFolder(context, movingFolder.id, targetId)
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

  const canDelete = useCallback(() => canManage, [canManage])
  const canManageFolderClient = useCallback(() => canManage, [canManage])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="space-y-4">
      {notice && (
        <Notice tone={notice.tone} action={<button onClick={() => setNotice(null)} className="text-xs underline">Dismiss</button>}>
          {notice.text}
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[14rem] max-w-sm flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${department.name}'s documents…`}
            aria-label="Search this department's documents"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={cn('rounded-md p-1.5 transition-colors', viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Grid2x2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={cn('rounded-md p-1.5 transition-colors', viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="size-4" aria-hidden="true" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="mr-1.5 size-3.5" aria-hidden="true" />
            New folder
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
            Upload
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Folder path">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={cn('rounded px-1.5 py-0.5 hover:text-foreground', currentFolderId === null && 'font-medium text-foreground')}
        >
          {department.name}
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

      <div className="flex min-w-0 items-stretch gap-4">
        <Surface className="hidden w-56 shrink-0 self-stretch @3xl/docs:flex md:flex min-h-[420px] flex-col p-2">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocumentFolderTree nodes={folderTree} selectedId={currentFolderId} onSelect={setCurrentFolderId} />
          </div>
        </Surface>

        <div className="min-w-0 flex-1 space-y-4">
          {loading ? (
            <div className="@container/docs">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
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
          ) : results.length === 0 && currentSubfolders.length === 0 ? (
            <Surface>
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <FileSearch className="size-10 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">
                  {debouncedQuery ? `Nothing matches "${debouncedQuery}"` : 'No documents here yet'}
                </h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {debouncedQuery
                    ? 'Try a different word.'
                    : `Upload the first document for ${department.name} and it becomes searchable by what's written inside it.`}
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
              canDelete={canDelete}
              folders={currentSubfolders}
              onOpenFolder={(folder) => setCurrentFolderId(folder.id)}
              onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
              onMoveFolder={(folder) => {
                setMoveTargetFolderId(folder.parent_id ? String(folder.parent_id) : '')
                setMovingFolder(folder)
              }}
              canManageFolder={canManageFolderClient}
            />
          ) : (
            <DocumentTableView
              documents={results}
              typeLabel={typeLabel}
              downloadingId={downloadingId}
              onOpen={(doc) => setViewing(doc)}
              onOpenDetails={(doc) => setDetailDoc(doc)}
              onDownload={(doc) => void download(doc)}
              canDelete={canDelete}
              folders={currentSubfolders}
              onOpenFolder={(folder) => setCurrentFolderId(folder.id)}
              onDeleteFolder={(folder) => setPendingDeleteFolder(folder)}
              onMoveFolder={(folder) => {
                setMoveTargetFolderId(folder.parent_id ? String(folder.parent_id) : '')
                setMovingFolder(folder)
              }}
              canManageFolder={canManageFolderClient}
            />
          )}

          {!loading && !error && total > PER_PAGE && (
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
            <DialogTitle>{processingDoc ? 'Reading your document' : batchFiles ? 'Uploading your files' : `Upload to ${department.name}`}</DialogTitle>
            <DialogDescription>
              {processingDoc
                ? 'This only takes a moment — you can close this and keep working, it finishes in the background.'
                : batchFiles
                  ? 'Each file finishes reading and classification in the background — you can close this and keep working.'
                  : `Visible to everyone in ${department.name}. PDF, Office, an image, or a whole folder.`}
            </DialogDescription>
          </DialogHeader>
          {processingDoc ? (
            <DocumentProcessingProgress documentId={processingDoc.id} fileName={processingDoc.fileName} onFinished={finishProcessing} />
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
              Created inside {currentFolderId === null ? department.name : (breadcrumbPath.at(-1)?.name ?? 'this folder')}.
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

      <Dialog open={movingFolder !== null} onOpenChange={(open) => { if (!open) setMovingFolder(null) }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Move "{movingFolder?.name ?? 'folder'}"</DialogTitle>
            <DialogDescription>Choose where it should live.</DialogDescription>
          </DialogHeader>
          <SearchableSelect
            options={folderMoveOptions}
            value={moveTargetFolderId}
            onChange={setMoveTargetFolderId}
            placeholder="Choose a folder"
            aria-label="Destination folder"
          />
          <Button onClick={() => void moveFolderHandler()} disabled={moving}>
            {moving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            Move
          </Button>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        open={viewing !== null}
        onOpenChange={(next) => { if (!next) setViewing(null) }}
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
        onOpenChange={(open) => { if (!open) setDetailDoc(null) }}
        onPreview={() => { if (detailDoc) setViewing(detailDoc) }}
        onDownload={() => { if (detailDoc) void download(detailDoc) }}
      />

      <ConfirmDialog
        open={pendingDeleteFolder !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteFolder(null) }}
        title={`Remove folder "${pendingDeleteFolder?.name ?? ''}"?`}
        description="Empty it first — move or remove everything inside, then this folder can be deleted."
        confirmLabel="Remove it"
        busy={deletingFolder}
        onConfirm={() => void confirmDeleteFolder()}
      />
    </div>
  )
}
