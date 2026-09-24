'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useLaravelContext } from '@/hooks/use-agentic'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { accountService } from '@/services/account'
import { ConfirmDialog, Field, SectionBlock, SectionEmpty, SectionSkeleton } from './section-primitives'

/**
 * YOUR OWN DOCUMENTS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THERE WAS NO WAY FOR SOMEBODY TO FILE THEIR OWN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Documents could only be added from the Employee Directory, by HR, about
 * somebody else. A person looking at their own profile had nowhere to put a
 * certificate or an ID proof.
 *
 * And the one path that did exist silently lost every file: the form sent it as
 * `file`, the server checked for `document`, so nothing was ever written to
 * storage while a row was created and the screen reported success.
 *
 * ── UPLOADS COMMIT IMMEDIATELY, UNLIKE THE PHOTO ────────────────────────────
 *
 * The photo above is STAGED and saved with the rest of the form, because it is
 * one field of a record that should save as a unit. A document is not — it is
 * its own thing, and holding it until somebody presses Save on an unrelated form
 * is how a file gets lost by navigating away. So this block sits outside the
 * form's dirty/Save flow entirely.
 */
export function ProfileDocumentsBlock() {
  const resolveContext = useLaravelContext()

  type Row = Awaited<ReturnType<typeof accountService.documents>>['data'][number]
  type DocType = { id: number; document_type: string }

  const [rows, setRows] = useState<Row[]>([])
  const [types, setTypes] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [uploading, setUploading] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await accountService.documents(context)
      setRows(response.data ?? [])
      setTypes(response.document_types ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your documents could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function upload() {
    if (!file || !title.trim() || !typeId || uploading) return

    setUploading(true)
    setError(null)

    try {
      await accountService.uploadDocument(resolveContext(), file, title.trim(), Number(typeId))
      setFile(null)
      setTitle('')
      setTypeId('')
      await load()
    } catch (caught) {
      /*
       * The server's own sentence. A refused file type and an oversized file each
       * say exactly what was wrong, and replacing that with "upload failed" throws
       * away the only part somebody can act on.
       */
      setError(caught instanceof Error ? caught.message : 'That document could not be uploaded.')
    } finally {
      setUploading(false)
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
      setError(caught instanceof Error ? caught.message : 'That document could not be removed.')
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  /** Bytes as something a person reads. Blank when the size was never recorded. */
  const size = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const canUpload = Boolean(file && title.trim() && typeId) && !uploading

  return (
    <SectionBlock
      title="Your documents"
      description="Certificates, ID proofs and anything else HR has asked you for. Only you, HR and administrators can see them."
    >
      {loading && <SectionSkeleton rows={2} />}

      {!loading && (
        <>
          {/* ── the upload form ─────────────────────────────────────────── */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3">
            <Field label="Type">
              <Select
                value={typeId}
                onChange={setTypeId}
                placeholder="Choose"
                options={types.map((type) => ({
                  value: String(type.id),
                  label: type.document_type,
                }))}
              />
            </Field>

            <Field label="What is it">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Degree certificate"
                maxLength={191}
              />
            </Field>

            <Field label="File" hint="PDF, Office, or an image. Up to 20 MB.">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv,.jpg,.jpeg,.png,.webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>

            <div className="sm:col-span-3">
              <Button type="button" onClick={() => void upload()} disabled={!canUpload}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="size-4" aria-hidden="true" />
                )}
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </p>
          )}

          {/* ── what is already filed ───────────────────────────────────── */}
          {rows.length === 0 ? (
            <div className="mt-4">
              <SectionEmpty
                icon={<FileText className="size-5" aria-hidden="true" />}
                title="Nothing filed yet"
                description="Anything you upload here stays on your personnel record."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.document_title || 'Untitled'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.document_type, size(row.file_size)].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  {/*
                    A plain link, not a fetch. The endpoint streams the file through
                    this application, so the permission check applies to reading the
                    BYTES and not only to listing them — the old scheme built a
                    bucket URL in the browser, which anybody could guess.
                  */}
                  <a
                    href={accountService.documentDownloadUrl(resolveContext(), row.id)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Download
                  </a>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDelete(row)}
                    aria-label={`Remove ${row.document_title ?? 'document'}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Remove "${pendingDelete?.document_title ?? 'this document'}"?`}
        description="It is taken off your personnel record. An administrator can restore it, but you will not see it here again."
        confirmLabel="Remove it"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </SectionBlock>
  )
}
