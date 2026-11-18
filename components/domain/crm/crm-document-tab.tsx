'use client'

import { useRef, useState } from 'react'
import { Download, FileUp, Loader2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FileTypeIcon } from '@/components/ui/file-icon'
import { SectionCard } from '@/components/shared/business/shared'
import { formatFileDate, formatFileSize } from '@/components/domain/documents/documents-ui'
import { accountService } from '@/services/account'
import type { CrmLinkedDocument } from '@/types/crm'

const MAX_UPLOAD_MB = 50

export interface CrmDocumentTabProps {
  documents: CrmLinkedDocument[]
  loading: boolean
  /** The wrapping detail-page owns state/loading and the actual crmService call - this tab only hands it the picked file and reloads its own list once the promise resolves. */
  onUpload: (file: File) => Promise<void>
}

/**
 * Lets Lead/Contact/Organization/Opportunity/Ticket show files attached via
 * the generic Document Library (`document_library` + the new
 * `document_library_links` join table - see `HasCrmDocuments`'s own
 * docblock), without a parallel attachment system per entity.
 *
 * Deliberately NOT a straight reuse of `DocumentCardGrid` /
 * `DocumentShareDialog`: both are built around `DocumentSearchHit` /
 * `DocumentFolderNode` - folders, starring, cut/copy/paste, per-document
 * sharing, processing-status badges - none of which apply to a flat list of
 * files attached to one CRM record. What genuinely carries over, and is
 * reused here rather than rebuilt: `FileTypeIcon` (the same file-type
 * glyph/color every other document surface in this app uses),
 * `formatFileSize`/`formatFileDate` (`documents-ui.tsx`), the `EmptyState`
 * convention, and - for download - the exact same already-shipped
 * `accountService.fetchDocument()` blob-download dance every other document
 * list in this codebase already uses (document-library-view.tsx,
 * department-documents-tab.tsx, my-department-documents.tsx): it works
 * unmodified here because `HasCrmDocuments::attachDocument()` writes
 * `visibility = 'organization'` on every CRM-attached document, which
 * `DocumentAccess::canView()` already honors for any caller in the same
 * tenant - no new download route needed for this phase.
 *
 * Single-file picker, not the full recursive-folder/zip-aware
 * `DocumentUploadDropzone` - `onUpload`'s own signature is one file at a
 * time (see this component's own props), matching `attachDocument()`'s
 * single `document` field.
 */
export function CrmDocumentTab({ documents, loading, onUpload }: CrmDocumentTabProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = async (file: File | null | undefined) => {
    if (!file || uploading) return
    setError('')
    setUploading(true)
    try {
      await onUpload(file)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload that file.')
    } finally {
      setUploading(false)
    }
  }

  const download = async (doc: CrmLinkedDocument) => {
    setDownloadingId(doc.id)
    setError('')
    try {
      const blob = await accountService.fetchDocument(Number(doc.id))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.originalFileName || doc.title || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to download that file.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <SectionCard
      title="Documents"
      description="Files attached to this record - shared with anyone else in your organisation working on it."
      actions={(
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <FileUp className="mr-1.5 size-3.5" aria-hidden="true" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label="Choose a file to attach"
        disabled={uploading}
        onChange={(e) => {
          void pickFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <label
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void pickFile(e.dataTransfer.files?.[0])
        }}
        onClick={(e) => { e.preventDefault(); inputRef.current?.click() }}
        className={`mb-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <FileUp className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">Drop a file here, or click to browse</span>
        <span className="text-xs text-muted-foreground">Up to {MAX_UPLOAD_MB} MB</span>
      </label>

      {error && <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading documents…
        </div>
      )}
      {!loading && documents.length === 0 && (
        <EmptyState icon={<Paperclip className="size-8" aria-hidden="true" />} title="No documents yet" description="Attach a file above to get started." />
      )}
      {!loading && documents.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center">
                <FileTypeIcon mimeType={doc.mimeType} fileName={doc.originalFileName} className="h-full w-full" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.title || doc.originalFileName || 'Untitled'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[formatFileSize(doc.size), doc.uploadedByName, formatFileDate(doc.createdAt)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${doc.title || 'document'}`}
                disabled={downloadingId === doc.id}
                onClick={() => void download(doc)}
              >
                {downloadingId === doc.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
