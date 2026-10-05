'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSearch, FileText, Grid2x2, List, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
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
import {
  accountService,
  type AccountDocument,
  type DocumentSearchHit,
  type DocumentTypeChoices,
} from '@/services/account'
import { myHrService } from '@/services/hrms/my-hr'
import { DocumentCardGrid } from './document-card-grid'
import { DocumentUploadDropzone } from './document-upload-dropzone'
import { DocumentsPage, Notice, SectionHeader, Surface } from './documents-ui'

type ViewMode = 'grid' | 'list'
type Scope = 'mine' | 'visible'

const PER_PAGE = 24

/**
 * THE DOCUMENT LIBRARY — upload, browse, and search by content.
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
  const [uploading, setUploading] = useState(false)
  const [generatingForm16, setGeneratingForm16] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const [viewing, setViewing] = useState<AccountDocument | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentSearchHit | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounced so every keystroke doesn't fire a request - same inline
  // pattern this codebase already uses (see ingestion-view.tsx).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category, documentType, scope])

  const load = useCallback(async () => {
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
  }, [resolveContext, debouncedQuery, category, documentType, scope, myId, page])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

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

  async function upload(file: File, title: string, docType: string) {
    const context = resolveContext()
    setUploading(true)
    setNotice(null)

    try {
      await accountService.uploadDocument(context, file, title, docType, { category: 'personnel' })
      setUploadOpen(false)
      setNotice({ tone: 'info', text: `“${title}” was uploaded. It will appear in search shortly.` })
      setPage(1)
      await load()
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'That document could not be uploaded.',
      })
    } finally {
      setUploading(false)
    }
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
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
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

      {loading ? (
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
      ) : results.length === 0 ? (
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
          onDownload={(doc) => void download(doc)}
          onDelete={(doc) => setPendingDelete(doc)}
          canDelete={canDelete}
        />
      ) : (
        <Surface className="overflow-hidden">
          <ul className="divide-y divide-border">
            {results.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <button
                  type="button"
                  onClick={() => setViewing(doc)}
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

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>
              PDF, Office, or an image. Its content becomes searchable automatically.
            </DialogDescription>
          </DialogHeader>
          <DocumentUploadDropzone types={types} uploading={uploading} onUpload={upload} />
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
    </DocumentsPage>
  )
}
