'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { DocumentTypeChoices } from '@/services/account'
import { FieldLabel } from './documents-ui'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv,.jpg,.jpeg,.png,.webp'
const FORMATS = ['PDF', 'Word', 'Excel', 'Image', 'Text']

export interface DocumentUploadDropzoneProps {
  types: DocumentTypeChoices
  uploading: boolean
  onUpload: (file: File, title: string, documentType: string) => Promise<void>
}

/**
 * Hand-rolled drag-and-drop, matching `ingestion-view.tsx`'s convention
 * (a `<label>` wrapping a hidden file input, manual drag state) rather than
 * reaching for `react-dropzone` — not a dependency of this project.
 */
export function DocumentUploadDropzone({ types, uploading, onUpload }: DocumentUploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('')

  const typeOptions = [
    ...Object.entries(types.personnel).map(([value, label]) => ({ value, label })),
    ...Object.entries(types.organization).map(([value, label]) => ({ value, label: `${label} (org)` })),
  ]

  function pick(selected: File | null | undefined) {
    if (!selected) return
    setFile(selected)
    // A sensible default so uploading isn't blocked on retyping the obvious -
    // somebody can still rename it before submitting.
    if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ''))
  }

  async function submit() {
    if (!file || !title.trim() || !documentType || uploading) return

    await onUpload(file, title.trim(), documentType)
    setFile(null)
    setTitle('')
    setDocumentType('')
  }

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
          pick(e.dataTransfer.files?.[0])
        }}
        className={`flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          type="file"
          accept={ACCEPT}
          aria-label="Choose a file to upload"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
          disabled={uploading}
        />
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">
            {file ? file.name : 'Drop a file here, or click to browse'}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            {file ? (formatSize(file.size) ?? '') : 'PDF, Office, or an image'}
          </span>
        </span>
        <span className="flex flex-wrap justify-center gap-1.5">
          {FORMATS.map((f) => (
            <Badge key={f} variant="muted">
              {f}
            </Badge>
          ))}
        </span>
        <span className="text-xs text-muted-foreground">Up to 50 MB.</span>
      </label>

      <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-card p-4">
        <FieldLabel label="What is it">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Degree certificate"
            maxLength={191}
            disabled={uploading}
          />
        </FieldLabel>

        <FieldLabel label="Type">
          <Select
            value={documentType}
            onChange={setDocumentType}
            placeholder={typeOptions.length === 0 ? 'No document types configured' : 'Choose a type'}
            options={typeOptions}
            disabled={uploading || typeOptions.length === 0}
          />
        </FieldLabel>

        <Button
          type="button"
          onClick={() => void submit()}
          disabled={!file || !title.trim() || !documentType || uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="mr-2 size-4" aria-hidden="true" />
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
