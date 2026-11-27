'use client'

import { useRef, useState, type MutableRefObject } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileTypeIcon } from '@/components/ui/file-icon'
import {
  acceptedExtensionsText, checkFile, defaultKindForFile, entryFormErrors, KIND_WORD, kindChoicesForFile, sizeText, titleFromFileName, uploadLimitText,
} from '@/lib/portfolio/sales-kit-model'
import type { SalesKitApi } from '@/services/product-master/kit-service'
import type { KitKind, KitLimits } from '@/services/product-master/kit-types'
import { kitErrorText, KitSelectField, KitTextField } from './product-sales-kit-parts'

/** One file of the batch, and where it is: waiting, being sent, added, or refused with the reason. */
interface Row {
  id: number
  file: File
  title: string
  description: string
  kind: KitKind
  /** Why the file cannot be sent at all (its type, its size), found before anything is sent. */
  problem: string | null
  status: 'ready' | 'uploading' | 'done' | 'failed'
  /** The server's sentence for a failed one. */
  message: string
  /** How far the file has gone, 0 to 1, when the transport can say; null when it cannot. */
  fraction: number | null
}

const rowsOf = (files: readonly File[], limits: KitLimits): Row[] => files.map((file, id) => ({
  id, file, title: titleFromFileName(file.name), description: '', kind: defaultKindForFile(file.name), problem: checkFile(file, limits), status: 'ready', message: '', fraction: null,
}))

/**
 * Adds the files a person chose or dropped. Each file gets its title (its name without the extension, to change), a short line on what it is for, and, for a PDF or a PowerPoint, the
 * choice between a demo presentation and a document. The files are sent one after another, so the screen can say which one it is on and keep what was added when one is refused.
 * A file the server would refuse (its type, its size) says so before anything is sent. Closing is blocked while a file is on its way.
 */
export function KitUploadDialog({ batch, limits, productId, service, onOpenChange, onUploaded }: {
  /** The files to add; null closes the dialog. `key` changes with every batch so each starts from its own files. */
  batch: { key: number; files: File[] } | null
  limits: KitLimits
  productId: number
  service: SalesKitApi
  onOpenChange: (open: boolean) => void
  /** Called once the batch has run, with how many files were added, so the shelf can be read again. */
  onUploaded: (added: number) => void
}) {
  // True while a file is on its way: the dialog does not close then (not by Escape, not by a click outside, not by the X), so what is being sent is never cut off from its screen.
  const sendingRef = useRef(false)

  return (
    <Dialog open={batch !== null} onOpenChange={(open) => { if (!open && sendingRef.current) return; onOpenChange(open) }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        {batch && <UploadForm key={batch.key} files={batch.files} limits={limits} productId={productId} service={service} sendingRef={sendingRef} onClose={() => onOpenChange(false)} onUploaded={onUploaded} />}
      </DialogContent>
    </Dialog>
  )
}

function UploadForm({ files, limits, productId, service, sendingRef, onClose, onUploaded }: {
  files: File[]
  limits: KitLimits
  productId: number
  service: SalesKitApi
  sendingRef: MutableRefObject<boolean>
  onClose: () => void
  onUploaded: (added: number) => void
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsOf(files, limits))
  const [running, setRunning] = useState(false)
  const [attempted, setAttempted] = useState(false)

  const patch = (id: number, change: Partial<Row>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const waiting = rows.filter((row) => row.status !== 'done' && row.problem === null)
  const titleError = (row: Row) => (attempted && row.status !== 'done' && row.problem === null ? entryFormErrors({ title: row.title }).title : undefined)

  const send = async () => {
    setAttempted(true)
    if (running || waiting.length === 0 || waiting.some((row) => entryFormErrors({ title: row.title }).title)) return
    setRunning(true)
    sendingRef.current = true
    let added = 0
    let failed = 0
    for (const row of waiting) {
      patch(row.id, { status: 'uploading', message: '', fraction: null })
      try {
        await service.uploadFile(
          productId,
          row.file,
          { title: row.title.trim(), description: row.description.trim() || undefined, kind: kindChoicesForFile(row.file.name).length > 1 ? row.kind : undefined },
          (fraction) => patch(row.id, { fraction }),
        )
        patch(row.id, { status: 'done' })
        added += 1
      } catch (cause) {
        patch(row.id, { status: 'failed', message: kitErrorText(cause, 'It could not be uploaded.') })
        failed += 1
      }
    }
    sendingRef.current = false
    setRunning(false)
    if (added > 0) onUploaded(added)
    if (failed === 0) onClose()
  }

  const button = waiting.length > 1 ? `Upload ${waiting.length} files` : 'Upload'

  return (
    <>
      <DialogHeader>
        <DialogTitle>Upload files</DialogTitle>
        <DialogDescription>
          Accepted: {acceptedExtensionsText(limits.extensions)}. Up to {uploadLimitText(limits.maxUploadKb)} each. Everyone who may open this Sales Kit can open them.
        </DialogDescription>
      </DialogHeader>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {rows.map((row) => <UploadRow key={row.id} row={row} locked={running || row.status === 'done'} error={titleError(row)} onChange={(change) => patch(row.id, change)} />)}
      </ul>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={running}>{rows.some((row) => row.status === 'done') ? 'Close' : 'Cancel'}</Button>
        <Button type="button" onClick={() => void send()} disabled={running || waiting.length === 0}>
          {running && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {running ? 'Uploading' : button}
        </Button>
      </DialogFooter>
    </>
  )
}

function UploadRow({ row, locked, error, onChange }: { row: Row; locked: boolean; error?: string; onChange: (change: Partial<Row>) => void }) {
  const choices = kindChoicesForFile(row.file.name)
  const size = sizeText(row.file.size)

  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <span className="size-9 shrink-0" aria-hidden="true"><FileTypeIcon mimeType={row.file.type || null} fileName={row.file.name} className="h-full w-full" /></span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-foreground">{row.file.name}</p>
          {size && <p className="text-xs text-muted-foreground">{size}</p>}
        </div>
        <RowState row={row} />
      </div>
      {row.problem && <p role="alert" className="text-sm text-foreground">{row.problem}</p>}
      {row.status === 'failed' && <p role="alert" className="text-sm text-foreground">{row.message}</p>}
      {row.problem === null && row.status !== 'done' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <KitTextField label="Title" value={row.title} onChange={(title) => onChange({ title })} error={error} disabled={locked} required />
          {choices.length > 1
            ? <KitSelectField label="Kind" value={row.kind} onChange={(kind) => onChange({ kind: kind as KitKind })} options={choices.map((kind) => ({ value: kind, label: KIND_WORD[kind] }))} disabled={locked} />
            : <div className="hidden sm:block" />}
          <div className="sm:col-span-2">
            <KitTextField label="What it is for" value={row.description} onChange={(description) => onChange({ description })} disabled={locked} hint="Optional. One line a salesperson reads before opening it." />
          </div>
        </div>
      )}
    </li>
  )
}

/** The state of a row in words and an icon, never colour alone. */
function RowState({ row }: { row: Row }) {
  if (row.status === 'uploading') {
    return (
      <span role="status" className="flex items-center gap-1.5 text-xs text-foreground">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {row.fraction === null ? 'Uploading' : `Uploading ${Math.round(row.fraction * 100)}%`}
      </span>
    )
  }
  if (row.status === 'done') return <span className="flex items-center gap-1.5 text-xs text-foreground"><CheckCircle2 className="size-3.5" aria-hidden="true" />Added</span>
  if (row.status === 'failed') return <span className="text-xs text-foreground">Not added</span>
  if (row.problem) return <span className="text-xs text-foreground">Cannot be added</span>

  return null
}
