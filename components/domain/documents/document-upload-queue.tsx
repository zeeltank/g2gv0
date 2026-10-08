'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, FolderUp, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLaravelContext } from '@/hooks/use-agentic'
import { ApiError } from '@/services/core/api-client'
import { accountService } from '@/services/account'
import {
  collectFromDrop,
  collectFromInput,
  expandForUpload,
  formatBytes,
  type ExpandedFile,
} from '@/app/documents/_lib/expand-upload'

const ACCEPT = '.zip,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.csv,.jpg,.jpeg,.png,.webp'
/** The server needs a known type; "other" always exists and the AI pipeline reclassifies from content. */
const DEFAULT_TYPE = 'other'
const POLL_MS = 2000
const POLL_GIVE_UP_MS = 60_000

type ItemStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'failed'

interface QueueItem {
  key: string
  file: File
  path: string
  status: ItemStatus
  docId?: number
  error?: string
  notice?: string
  uploadStartedAt?: number
  uploadedAt?: number
  analyzeEndedAt?: number
}

export interface DocumentUploadQueueProps {
  /** Called whenever at least one file finished uploading, so the parent can reload its list. */
  onUploaded: () => void
}

function failureText(path: string, stage: string, cause: unknown, fallback: string): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  const reason = (raw || fallback).trim().replace(/[.\s]+$/, '')
  return `${path}: ${stage} failed because ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`
}

/** Prefer the server's own message; otherwise explain the status code in plain words. */
function uploadReason(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.message && !/^API Error:/i.test(err.message)) return err.message
    switch (err.status) {
      case 401: return 'your session expired. Sign in again and retry'
      case 403: return 'you do not have permission to upload here'
      case 413: return 'the file is larger than the server allows'
      case 415: return 'the server does not accept this file type'
      case 422: return 'the server rejected the file'
      case 500: return 'the server hit an error while saving it'
      case 502:
      case 503: return 'the server is temporarily unavailable. Try again in a moment'
      default: return `the server refused the upload (code ${err.status})`
    }
  }
  if (err instanceof TypeError) return 'the server could not be reached. Check your connection and try again'
  return err instanceof Error && err.message ? err.message : 'the upload did not complete'
}

function clock(ts?: number): string {
  return ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : ''
}

function elapsed(from?: number, to?: number, now?: number): string {
  if (!from) return ''
  const s = Math.max(0, Math.round(((to ?? now ?? Date.now()) - from) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export function DocumentUploadQueue({ onUploaded }: DocumentUploadQueueProps) {
  const resolveContext = useLaravelContext()
  const [items, setItems] = useState<QueueItem[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [started, setStarted] = useState(false)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const startedKeys = useRef(new Set<string>())
  const mounted = useRef(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const patch = useCallback((key: string, change: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...change } : i)))
  }, [])

  const addFiles = useCallback(
    async (input: ExpandedFile[], readNotes: string[] = []) => {
      setReading(true)
      try {
        const { files, skipped: skippedNow } = await expandForUpload(input)
        if (!mounted.current) return

        const notes = [...readNotes, ...skippedNow]
        setItems((prev) => {
          const seen = new Set(prev.map((i) => `${i.path}:${i.file.size}`))
          const added: QueueItem[] = []
          for (const f of files) {
            const id = `${f.path}:${f.file.size}`
            if (seen.has(id)) {
              notes.push(`${f.path}: could not be added because it is already in the list.`)
              continue
            }
            seen.add(id)
            added.push({ key: `${id}:${Math.random().toString(36).slice(2, 8)}`, file: f.file, path: f.path, status: 'queued' })
          }
          return [...prev, ...added]
        })
        if (notes.length) setSkipped((prev) => [...prev, ...notes])
      } finally {
        if (mounted.current) setReading(false)
      }
    },
    [],
  )

  // Upload one file at a time, in order.
  useEffect(() => {
    if (!started) return
    if (items.some((i) => i.status === 'uploading')) return
    const next = items.find((i) => i.status === 'queued')
    if (!next || startedKeys.current.has(next.key)) return
    startedKeys.current.add(next.key) // strict mode runs effects twice

    patch(next.key, { status: 'uploading', uploadStartedAt: Date.now() })
    const title = next.file.name.replace(/\.[^.]+$/, '').slice(0, 191)

    void accountService
      .uploadDocument(resolveContext(), next.file, title, DEFAULT_TYPE, { category: 'personnel' })
      .then((response) => {
        if (!mounted.current) return
        const id = response.data?.id
        if (response.status !== 1 || !id) {
          patch(next.key, {
            status: 'failed',
            error: failureText(next.path, 'Upload', response.message, 'the server did not accept the file'),
          })
          return
        }
        patch(next.key, { status: 'processing', docId: id, uploadedAt: Date.now() })
        onUploaded()
      })
      .catch((err) => {
        if (!mounted.current) return
        patch(next.key, { status: 'failed', error: failureText(next.path, 'Upload', uploadReason(err), 'the upload did not complete') })
      })
  }, [started, items, patch, resolveContext, onUploaded])

  // Poll every processing item in parallel.
  const processing = items.filter((i) => i.status === 'processing')
  const processingIds = processing.map((i) => i.key).join('|')
  useEffect(() => {
    if (!processingIds) return
    const timer = setInterval(() => {
      for (const item of items.filter((i) => i.status === 'processing' && i.docId)) {
        void accountService
          .getDocument(resolveContext(), item.docId as number)
          .then((response) => {
            if (!mounted.current) return
            const step = response.data.processing_step
            if (step === 'done') {
              patch(item.key, { status: 'done', analyzeEndedAt: Date.now() })
            } else if (step === 'failed') {
              // Enrichment failing never blocks the document - it is filed and searchable by title.
              patch(item.key, {
                status: 'done',
                analyzeEndedAt: Date.now(),
                notice: failureText(item.path, 'Analysis', response.data.processing_error, 'the analysis pipeline reported an error without details') +
                  ' The document is still filed and searchable by title.',
              })
            } else if (item.uploadedAt && Date.now() - item.uploadedAt > POLL_GIVE_UP_MS) {
              patch(item.key, {
                status: 'done',
                analyzeEndedAt: Date.now(),
                notice: `${item.path}: analysis is taking longer than usual and will finish in the background. Suggestions may be incomplete for now.`,
              })
            }
          })
          .catch(() => {
            // A missed poll is not fatal; the give-up timer below still ends the wait.
            if (item.uploadedAt && Date.now() - item.uploadedAt > POLL_GIVE_UP_MS && mounted.current) {
              patch(item.key, {
                status: 'done',
                analyzeEndedAt: Date.now(),
                notice: `${item.path}: analysis status could not be checked, so it will finish in the background.`,
              })
            }
          })
      }
    }, POLL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingIds])

  // Live durations tick while anything is busy.
  const busy = items.some((i) => i.status === 'uploading' || i.status === 'processing')
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [busy])

  const queued = items.filter((i) => i.status === 'queued')
  const finished = items.filter((i) => i.status === 'done' || i.status === 'failed').length
  const notices = items.flatMap((i) => [i.error, i.notice].filter((x): x is string => !!x))
  const allSettled = started && items.length > 0 && finished === items.length

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (reading) return
    setReading(true) // block re-entry before the first await; collectFromDrop reads the DataTransfer synchronously
    const { files, skipped: notes } = await collectFromDrop(e.dataTransfer)
    await addFiles(files, notes)
  }

  function reset() {
    startedKeys.current.clear()
    setItems([])
    setSkipped([])
    setStarted(false)
  }

  return (
    <div className="space-y-4">
      {!started && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => void onDrop(e)}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {reading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {reading ? 'Reading files and opening zips…' : 'Drag and drop files, a folder or a zip here, or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">PDF, Office, text, CSV or images. Up to 50 MB each, 200 files per batch.</p>

          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Choose files to upload"
            className="sr-only"
            onChange={(e) => {
              const list = e.target.files
              if (list) void addFiles(collectFromInput(list))
              e.target.value = ''
            }}
          />
          <input
            ref={folderInput}
            type="file"
            aria-label="Choose a folder to upload"
            className="sr-only"
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={(e) => {
              const list = e.target.files
              if (list) void addFiles(collectFromInput(list))
              e.target.value = ''
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={reading} onClick={() => fileInput.current?.click()}>
              Browse Device
            </Button>
            <Button type="button" variant="outline" disabled={reading} onClick={() => folderInput.current?.click()}>
              <FolderUp className="mr-2 size-4" aria-hidden="true" />
              Choose folder
            </Button>
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
            {skipped.length} {skipped.length === 1 ? 'file' : 'files'} could not be added
          </p>
          <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted-foreground">
            {skipped.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <>
          {started && (
            <p className="text-sm text-muted-foreground">
              {finished} of {items.length} finished
            </p>
          )}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {items.map((item) => (
              <li key={item.key} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground" title={item.path}>
                    {item.path}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
                  {item.status === 'queued' && !started && (
                    <button
                      type="button"
                      aria-label={`Remove ${item.path}`}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {started && <Stages item={item} now={now} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {notices.length > 0 && (
        <ul className="space-y-1 text-xs text-destructive" role="alert">
          {notices.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {allSettled ? (
          <Button type="button" onClick={reset}>
            Upload more
          </Button>
        ) : (
          !started && (
            <Button type="button" disabled={queued.length === 0 || reading} onClick={() => setStarted(true)}>
              <Upload className="mr-2 size-4" aria-hidden="true" />
              {queued.length > 1 ? `Upload & Process ${queued.length} files` : 'Upload & Process'}
            </Button>
          )
        )}
      </div>
    </div>
  )
}

/**
 * Per-file stages with a start clock time and live duration. The backend runs
 * analysis as ONE job and reports a single status, so analysis is one stage -
 * no invented per-step timings. There is no review/publish step on this
 * backend: a document is filed and searchable as soon as it is uploaded.
 */
function Stages({ item, now }: { item: QueueItem; now: number }) {
  const uploadDone = !!item.uploadedAt
  const uploadFailed = item.status === 'failed' && !uploadDone
  const analyzing = item.status === 'processing'
  const analyzeDone = !!item.analyzeEndedAt

  const rows: Array<{ label: string; state: 'idle' | 'busy' | 'done' | 'error'; detail: string }> = [
    {
      label: 'Upload',
      state: uploadFailed ? 'error' : uploadDone ? 'done' : item.status === 'uploading' ? 'busy' : 'idle',
      detail: item.uploadStartedAt
        ? `${clock(item.uploadStartedAt)} · ${elapsed(item.uploadStartedAt, item.uploadedAt, now)}`
        : 'Waiting',
    },
    {
      label: 'Analyze (read, OCR, classify, tag)',
      state: analyzeDone ? 'done' : analyzing ? 'busy' : 'idle',
      detail: item.uploadedAt ? `${clock(item.uploadedAt)} · ${elapsed(item.uploadedAt, item.analyzeEndedAt, now)}` : '',
    },
    {
      label: 'Filed',
      state: analyzeDone ? 'done' : 'idle',
      detail: item.analyzeEndedAt ? `Ready at ${clock(item.analyzeEndedAt)}` : '',
    },
  ]

  return (
    <ol className="mt-1.5 grid gap-1 sm:grid-cols-3">
      {rows.map((r) => (
        <li key={r.label} className="flex items-start gap-1.5 text-xs">
          <span
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
              r.state === 'done'
                ? 'border-primary bg-primary text-primary-foreground'
                : r.state === 'error'
                  ? 'border-destructive text-destructive'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {r.state === 'done' ? (
              <Check className="size-3" aria-hidden="true" />
            ) : r.state === 'busy' ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : r.state === 'error' ? (
              <X className="size-3" aria-hidden="true" />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block text-foreground">{r.label}</span>
            <span className="block text-muted-foreground">{r.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
