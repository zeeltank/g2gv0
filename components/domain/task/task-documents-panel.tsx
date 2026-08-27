'use client'

/**
 * Reference documents on a task.
 *
 * One component, two audiences. HR/admin get the upload control; the employee
 * gets the same list, read-only, with download. Which one you are is decided by
 * the server (`can_upload`), not by the caller — a screen that guessed would
 * eventually render a button the server refuses.
 *
 * ── THE EMPTY STATE IS A SENTENCE, NOT A COMPONENT ──────────────────────────
 *
 * Most tasks will have no documents. A full `<EmptyState>` with an icon inside a
 * form section is too heavy for that; the house pattern for an empty
 * association is one line of muted text, and that is what this uses.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { formatFileSize, taskDocumentsService } from '@/services/task/documents'
import type { TaskDocument } from '@/services/task/documents'

export function TaskDocumentsPanel({
  taskId,
  compact = false,
}: {
  /** The assigned work item's id. Null before the task exists (create mode). */
  taskId: number | null
  /** The employee drawer renders tighter than the assign form. */
  compact?: boolean
}) {
  const [documents, setDocuments] = useState<TaskDocument[] | null>(null)
  const [types, setTypes] = useState<Record<string, string>>({})
  const [canUpload, setCanUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('reference')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!taskId) return
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setError(null)
    try {
      const response = await taskDocumentsService.list(context, taskId)
      setDocuments(response.data ?? [])
      setTypes(response.types ?? {})
      setCanUpload(Boolean(response.can_upload))
    } catch (loadError) {
      // Stays null, never []. An empty array here would render "no documents"
      // over a failed fetch — this codebase calls that the dead-bell lie.
      setError(loadError instanceof Error ? loadError.message : 'Could not load the documents.')
    }
  }, [taskId])

  useEffect(() => {
    queueMicrotask(() => { load() })
  }, [load])

  /* ── The task does not exist yet ──────────────────────────────────────── */
  if (!taskId) {
    return (
      <p className="text-xs text-muted-foreground">
        Documents can be attached once the task is created. Save it first, then reopen it
        to add reference material.
      </p>
    )
  }

  const upload = async (file: File) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setBusy(true)
    setError(null)
    try {
      await taskDocumentsService.upload(context, taskId, file, {
        title: title.trim() || undefined,
        document_type: docType,
      })
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'That file could not be attached.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) return

    setBusy(true)
    setError(null)
    try {
      await taskDocumentsService.remove(context, taskId, id)
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'That document could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const href = (id: number) => {
    const context = getLaravelContext()
    return isLaravelContextReady(context)
      ? taskDocumentsService.downloadUrl(context, taskId, id)
      : '#'
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      {documents === null && !error ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      ) : documents && documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canUpload
            ? 'No documents attached yet. Add anything the person doing this task will need.'
            : 'No documents have been attached to this task.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {(documents ?? []).map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{doc.title}</span>
                {/* Every detail the uploader recorded, joined the house way. */}
                <span className="block truncate text-xs tabular-nums text-muted-foreground">
                  {[
                    doc.document_type_label,
                    doc.file_name,
                    formatFileSize(doc.file_size),
                    doc.uploaded_by_name ? `by ${doc.uploaded_by_name}` : null,
                    doc.created_at ? new Date(doc.created_at).toLocaleDateString() : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>

              <a
                href={href(doc.id)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Download ${doc.title}`}
                title="Download"
              >
                <Download className="size-4" />
              </a>

              {canUpload && (
                <button
                  type="button"
                  onClick={() => void remove(doc.id)}
                  disabled={busy}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  aria-label={`Remove ${doc.title}`}
                  title="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Upload, admin/HR only ─────────────────────────────────────────
          `can_upload` comes from the server. An employee never sees this,
          rather than seeing it and being refused. */}
      {canUpload && !compact && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">
              What is it? <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Site safety checklist"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">Type</span>
            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            >
              {Object.entries(types).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label
            className={cn(
              'flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-semibold transition-colors hover:bg-accent',
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <Upload className="size-3.5" />
            {busy ? 'Uploading…' : 'Choose file'}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
          </label>

          <p className="w-full text-[11px] text-muted-foreground">
            PDF, Office, text or image, up to 20 MB. Everyone assigned to this task can open it.
          </p>
        </div>
      )}

      {/* The employee's own hint about where these came from. */}
      {!canUpload && documents && documents.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Paperclip className="size-3" aria-hidden="true" />
          Attached by whoever assigned this task.
        </p>
      )}
    </div>
  )
}
