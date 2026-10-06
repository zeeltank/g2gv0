'use client'

import { useRef, useState } from 'react'
import { FolderUp, Loader2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { DocumentTypeChoices } from '@/services/account'
import { FieldLabel } from './documents-ui'
import { distinctDirectoryPaths, filesFromDataTransfer, filesFromFileList, type DiscoveredFile } from './document-folder-upload'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv,.jpg,.jpeg,.png,.webp'
const FORMATS = ['PDF', 'Word', 'Excel', 'Image', 'Text']

export interface DocumentUploadDropzoneProps {
  types: DocumentTypeChoices
  uploading: boolean
  /** One call for the whole batch — a single file is just a batch of one; the caller decides whether that gets the full single-document progress view or the batch list. `directoryPaths` is empty for a flat multi-file pick, non-empty for a folder (what the caller resolves via `resolveFolderPaths` before uploading). */
  onUpload: (files: DiscoveredFile[], documentType: string, directoryPaths: string[]) => Promise<void>
}

/**
 * Hand-rolled drag-and-drop (matches `ingestion-view.tsx`'s convention, not
 * `react-dropzone` — not a dependency here), now multi-file AND
 * recursive-folder aware.
 *
 * A single `<input>` cannot offer both "pick several files" and "pick a
 * whole folder" at once — `webkitdirectory` fixes an input to folder-only
 * selection — so there are two pickers (two buttons, two hidden inputs)
 * alongside one drop zone that auto-detects which it was handed via
 * `filesFromDataTransfer()` (walks `FileSystemEntry` for a dropped folder,
 * falls back to flat files otherwise).
 *
 * Title is no longer a field here: with potentially many files of different
 * names, one shared title made no sense - each file defaults to its own
 * filename (same fallback the single-file version already used), exactly
 * how `fileDocument()` already treats an absent title. Document type stays
 * one shared required choice for the whole batch (Phase 5 relaxes this to
 * optional + AI-filled; until then every upload still needs one).
 */
export function DocumentUploadDropzone({ types, uploading, onUpload }: DocumentUploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<DiscoveredFile[]>([])
  const [directoryPaths, setDirectoryPaths] = useState<string[]>([])
  const [documentType, setDocumentType] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)

  const typeOptions = [
    ...Object.entries(types.personnel).map(([value, label]) => ({ value, label })),
    ...Object.entries(types.organization).map(([value, label]) => ({ value, label: `${label} (org)` })),
  ]

  function setDiscovered(discovered: DiscoveredFile[]) {
    setFiles(discovered)
    setDirectoryPaths(distinctDirectoryPaths(discovered))
  }

  async function submit() {
    if (files.length === 0 || !documentType || uploading) return

    await onUpload(files, documentType, directoryPaths)
    setFiles([])
    setDirectoryPaths([])
    setDocumentType('')
  }

  const summary =
    files.length === 0
      ? 'Drop files or a folder here, or click to browse'
      : directoryPaths.length > 0
        ? `${files.length} file${files.length === 1 ? '' : 's'} across ${directoryPaths.length} folder${directoryPaths.length === 1 ? '' : 's'}`
        : `${files.length} file${files.length === 1 ? '' : 's'} selected`

  return (
    <div className="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          if (!uploading) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void filesFromDataTransfer(e.dataTransfer).then(setDiscovered)
        }}
        className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          type="file"
          multiple
          accept={ACCEPT}
          aria-label="Choose files to upload"
          className="sr-only"
          onChange={(e) => e.target.files && setDiscovered(filesFromFileList(e.target.files))}
          disabled={uploading}
        />
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{summary}</span>
          <span className="mt-1 block text-sm text-muted-foreground">PDF, Office, or an image</span>
        </span>
        <span className="flex flex-wrap justify-center gap-1.5">
          {FORMATS.map((f) => (
            <Badge key={f} variant="muted">
              {f}
            </Badge>
          ))}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={(e) => {
            e.preventDefault()
            folderInputRef.current?.click()
          }}
        >
          <FolderUp className="mr-1.5 size-3.5" aria-hidden="true" />
          Choose a folder
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error — webkitdirectory has no TS DOM typing, but every Chromium/Firefox browser honours it.
          webkitdirectory=""
          multiple
          aria-label="Choose a folder to upload"
          className="sr-only"
          onChange={(e) => e.target.files && setDiscovered(filesFromFileList(e.target.files))}
          disabled={uploading}
        />
        <span className="text-xs text-muted-foreground">Up to 50 MB per file.</span>
      </label>

      <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-card p-4">
        <FieldLabel label="Type">
          <Select
            value={documentType}
            onChange={setDocumentType}
            placeholder={typeOptions.length === 0 ? 'No document types configured' : 'Choose a type for all of these'}
            options={typeOptions}
            disabled={uploading || typeOptions.length === 0}
          />
        </FieldLabel>
        <p className="text-xs text-muted-foreground">
          Each file keeps its own name as its title. Applies to every file in this batch.
        </p>

        <Button type="button" onClick={() => void submit()} disabled={files.length === 0 || !documentType || uploading}>
          {uploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="mr-2 size-4" aria-hidden="true" />
          )}
          {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} files` : 'Upload'}
        </Button>
      </div>
    </div>
  )
}
