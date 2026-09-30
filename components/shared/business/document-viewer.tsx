'use client'

import * as React from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { accountService } from '@/services/account'

/**
 * Preview a personnel document without leaving the screen.
 *
 * ── WHY THE FILE IS FETCHED RATHER THAN LINKED ──────────────────────────────
 *
 * These objects are stored PRIVATE. A link straight to the bucket answers
 * AccessDenied — which is exactly the bug this component exists because of —
 * and an `<iframe src="/api/…/download">` fares no better, because an iframe
 * sends no Authorization header.
 *
 * So the bytes are fetched with the token in a header, turned into a blob URL,
 * and handed to the viewer. That is the only way to preview an authenticated
 * file at all, and it keeps the credential out of the URL.
 *
 * ── WHY NOT THE OFFICE VIEWER ───────────────────────────────────────────────
 *
 * The LMS workspace renders Word and Excel through
 * `view.officeapps.live.com/op/embed.aspx?src=…`, and its own comment notes
 * that this REQUIRES a publicly reachable URL — Microsoft's servers fetch the
 * file themselves. That is precisely what we are removing here, so those
 * formats say so and offer the download instead of showing an empty frame.
 */
export interface DocumentViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** staff_document.id. Null closes the viewer down; nothing is fetched. */
  documentId: number | null
  title: string
  /** Used to pick the viewer. Null falls back to the filename's extension. */
  mimeType?: string | null
  fileName?: string | null
}

type Kind = 'pdf' | 'image' | 'other'

function kindOf(mimeType?: string | null, fileName?: string | null): Kind {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'

  // Rows filed before 2026-09-24 carry no mime_type, so fall back to the
  // extension rather than refusing to preview anything older.
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'

  return 'other'
}

export function DocumentViewer({
  open,
  onOpenChange,
  documentId,
  title,
  mimeType,
  fileName,
}: DocumentViewerProps) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const kind = kindOf(mimeType, fileName)

  React.useEffect(() => {
    if (!open || documentId === null) return

    let cancelled = false
    let created: string | null = null

    setLoading(true)
    setError(null)

    accountService
      .fetchDocument(documentId)
      .then((fetched) => {
        if (cancelled) return
        setBlob(fetched)
        // Only PDFs and images are rendered, so only they need an object URL.
        if (kind !== 'other') {
          created = URL.createObjectURL(fetched)
          setObjectUrl(created)
        }
      })
      .catch((caught) => {
        if (cancelled) return
        // The server's own sentence — "its file is missing", "you may not read
        // this" — rather than a blank frame the reader has to interpret.
        setError(
          caught instanceof Error ? caught.message : 'That document could not be opened.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      // Revoked on close, not left to the tab's lifetime: a blob URL holds the
      // whole file in memory, and these are personnel records.
      if (created) URL.revokeObjectURL(created)
      setObjectUrl(null)
      setBlob(null)
    }
  }, [open, documentId, kind])

  const save = () => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || `${title || 'document'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="truncate">{title || 'Document'}</DialogTitle>
          <DialogDescription>
            {fileName ? fileName : 'Filed on this employee’s personnel record.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
          {loading ? (
            <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Opening…
            </div>
          ) : error ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 px-6 text-center">
              <FileText className="size-10 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : kind === 'pdf' && objectUrl ? (
            <iframe src={objectUrl} title={title || 'Document'} className="h-[65vh] w-full" />
          ) : kind === 'image' && objectUrl ? (
            <div className="flex justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={objectUrl} alt={title || 'Document'} className="max-h-[65vh] max-w-full" />
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 px-6 text-center">
              <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                This file type cannot be shown here. Download it to open it.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={!blob}>
            <Download className="mr-2 size-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
