'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { ChevronDown, FolderOpen, Link2, Plus, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirm } from '@/components/shared/scaffolds'
import { DocumentViewer } from '@/components/shared/business/document-viewer'
import { NOTICE_TONE } from '@/lib/org-accounts/tones'
import { acceptAttribute, downloadName, emptyText, kitChips, shelfOf, type KitFilter } from '@/lib/portfolio/sales-kit-model'
import { salesKitService, type SalesKitApi } from '@/services/product-master/kit-service'
import type { KitCan, KitItem } from '@/services/product-master/kit-types'
import type { KitState } from './product-sales-kit-data'
import type { KitRun } from './product-sales-kit-actions'
import { KitEditDialog, KitLinkDialog } from './product-sales-kit-forms'
import { KitLibraryDialog } from './product-sales-kit-library'
import { kitErrorText } from './product-sales-kit-parts'
import { KitFeatured, KitTile } from './product-sales-kit-tile'
import { KitUploadDialog } from './product-sales-kit-upload'
import { KitVideoDialog } from './product-sales-kit-video'

const NO_RIGHTS: KitCan = { view: false, add: false, edit: false, delete: false }

/** Saves bytes the person already has in the page as a file, through a link that is clicked and then forgotten. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

/**
 * The Sales Kit tab of a Product: the shelf a salesperson opens before a call. A person who may only look sees the entries and their actions; a person who may manage also sees
 * Add to Sales Kit (Upload files, Add link, From Document Library), can drop files on the page, and can edit or remove an entry. The first demo presentation is featured with its main
 * action; everything else is a quiet tile. `state` and the reads come from the Product page (`useSalesKit`), so the tab can show its count before it is opened.
 */
export function ProductSalesKit({ productId, state, onReload, onRetry, service = salesKitService }: {
  productId: number
  state: KitState
  /** Reads the shelf again after a change, keeping what is on screen until the new one arrives. */
  onReload: () => Promise<void>
  /** The Retry of a first read that failed. */
  onRetry: () => void
  service?: SalesKitApi
}) {
  const { confirm, confirmDialog } = useConfirm()
  const [filter, setFilter] = useState<KitFilter>('all')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [batch, setBatch] = useState<{ key: number; files: File[] } | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [editing, setEditing] = useState<KitItem | null>(null)
  const [previewing, setPreviewing] = useState<KitItem | null>(null)
  const [playing, setPlaying] = useState<KitItem | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const picker = useRef<HTMLInputElement>(null)
  const batches = useRef(0)

  const data = state.data
  const can = data?.can ?? NO_RIGHTS
  const fetcher = useCallback((itemId: number) => service.fetchFile(productId, itemId, { inline: true }), [service, productId])

  const startUpload = (files: File[]) => {
    if (files.length === 0 || !can.add) return
    setNotice(null)
    batches.current += 1
    setBatch({ key: batches.current, files })
  }

  const download = async (item: KitItem) => {
    setBusyId(item.id)
    setNotice(null)
    try {
      saveBlob(await service.fetchFile(productId, item.id), downloadName(item))
    } catch (cause) {
      setNotice({ tone: 'error', text: `"${item.title}" could not be downloaded. ${kitErrorText(cause, 'Try again in a moment.')}` })
    } finally {
      setBusyId(null)
    }
  }

  const run: KitRun = (action, item) => {
    if (action === 'download') void download(item)
    else if (action === 'preview') setPreviewing(item)
    else setPlaying(item)
  }

  const remove = async (item: KitItem) => {
    const ok = await confirm({
      title: `Remove "${item.title}"?`,
      description: item.source === 'link' ? 'The link comes out of the Sales Kit. The page it points to is not changed.' : 'It comes out of the Sales Kit. The file stays in the Document Library.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    setNotice(null)
    try {
      await service.remove(productId, item.id)
      setNotice({ tone: 'success', text: `Removed "${item.title}" from the Sales Kit.` })
      await onReload()
    } catch (cause) {
      setNotice({ tone: 'error', text: `"${item.title}" could not be removed. ${kitErrorText(cause, 'Try again in a moment.')}` })
    }
  }

  const saved = (text: string) => { setNotice({ tone: 'success', text }); void onReload() }

  // Dropping files on the page, for a person who may add. Only a drag that carries files is answered, so dragging a link or some text over the page does nothing.
  const drag = can.add
    ? {
      onDragEnter: (event: DragEvent) => { if (!carriesFiles(event)) return; event.preventDefault(); depth.current += 1; setDragging(true) },
      onDragOver: (event: DragEvent) => { if (!carriesFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy' },
      onDragLeave: (event: DragEvent) => { if (!carriesFiles(event)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false) },
      onDrop: (event: DragEvent) => { if (!carriesFiles(event)) return; event.preventDefault(); depth.current = 0; setDragging(false); startUpload(Array.from(event.dataTransfer.files)) },
    }
    : {}

  if (state.status === 'loading') {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Loading the Sales Kit</span>
        <Skeleton className="h-9 w-full motion-reduce:animate-none" />
        <Skeleton className="h-36 w-full rounded-xl motion-reduce:animate-none" />
        <div className="grid gap-3 @2xl:grid-cols-2">
          {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full motion-reduce:animate-none" />)}
        </div>
      </div>
    )
  }
  if (state.status === 'error' || !data) {
    return (
      <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm ${NOTICE_TONE.error}`}>
        <p className="min-w-0 flex-1">{state.error || 'The Sales Kit could not be loaded.'}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry</Button>
      </div>
    )
  }

  const chips = kitChips(data.counts)
  const shelf = shelfOf(data.items, filter)
  const total = data.items.length
  const words = emptyText({ filter, canAdd: can.add, total })
  const entry = (item: KitItem) => ({ item, can, fetcher, busy: busyId === item.id, onRun: run, onEdit: setEditing, onRemove: (target: KitItem) => void remove(target) })

  return (
    <div className="relative space-y-4" {...drag}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">Sales Kit</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">What to show a customer about {data.product.name}: demo presentations, documents, videos and images.</p>
        </div>
        {can.add && (
          <>
            <input
              ref={picker}
              type="file"
              multiple
              accept={acceptAttribute(data.limits.extensions)}
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose files to add to the Sales Kit"
              onChange={(event) => { startUpload(Array.from(event.target.files ?? [])); event.target.value = '' }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm"><Plus aria-hidden="true" />Add to Sales Kit<ChevronDown aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => picker.current?.click()}><Upload className="mr-2 size-4" aria-hidden="true" />Upload files</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLinkOpen(true)}><Link2 className="mr-2 size-4" aria-hidden="true" />Add link</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLibraryOpen(true)}><FolderOpen className="mr-2 size-4" aria-hidden="true" />From Document Library</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${NOTICE_TONE[notice.tone]}`}>{notice.text}</div>}
      {state.error && (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${NOTICE_TONE.error}`}>
          <p className="min-w-0 flex-1">The Sales Kit could not be refreshed. {state.error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void onReload()}><RefreshCw aria-hidden="true" />Retry</Button>
        </div>
      )}

      {total > 0 && (
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={filter === chip.id}
              onClick={() => setFilter(chip.id)}
              className={`rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === chip.id ? 'border-primary bg-card font-medium text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
            >
              {chip.label}<span className="ml-1.5 text-xs">{chip.count}</span>
            </button>
          ))}
        </div>
      )}

      {shelf.featured && <KitFeatured {...entry(shelf.featured)} />}
      {shelf.rest.length > 0 && (
        <ul className="grid gap-3 @2xl:grid-cols-2" aria-label={filter === 'all' ? 'Everything in the Sales Kit' : chips.find((chip) => chip.id === filter)?.label}>
          {shelf.rest.map((item) => <KitTile key={item.id} {...entry(item)} />)}
        </ul>
      )}
      {!shelf.featured && shelf.rest.length === 0 && (
        <EmptyState
          title={words.title}
          description={words.description}
          icon={<FolderOpen className="size-8" aria-hidden="true" />}
          action={can.add && total === 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => picker.current?.click()}><Upload aria-hidden="true" />Upload files</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setLinkOpen(true)}><Link2 aria-hidden="true" />Add link</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setLibraryOpen(true)}><FolderOpen aria-hidden="true" />From Document Library</Button>
            </div>
          ) : undefined}
        />
      )}

      {dragging && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/90 text-sm font-medium text-foreground">
          Drop files to add them to the Sales Kit
        </div>
      )}

      <KitUploadDialog batch={batch} limits={data.limits} productId={productId} service={service} onOpenChange={(open) => { if (!open) setBatch(null) }} onUploaded={(added) => saved(added === 1 ? 'Added 1 file to the Sales Kit.' : `Added ${added} files to the Sales Kit.`)} />
      <KitLinkDialog open={linkOpen} productId={productId} service={service} onOpenChange={setLinkOpen} onSaved={() => saved('Added the link to the Sales Kit.')} />
      <KitLibraryDialog open={libraryOpen} productId={productId} service={service} onOpenChange={setLibraryOpen} onSaved={() => saved('Added the document to the Sales Kit.')} />
      <KitEditDialog item={editing} productId={productId} service={service} onClose={() => setEditing(null)} onSaved={() => saved('Saved.')} />
      <DocumentViewer
        open={previewing !== null}
        onOpenChange={(open) => { if (!open) setPreviewing(null) }}
        documentId={previewing?.documentId ?? null}
        title={previewing?.title ?? ''}
        mimeType={previewing?.mimeType}
        fileName={previewing?.fileName}
      />
      <KitVideoDialog item={playing} fetcher={fetcher} onClose={() => setPlaying(null)} onDownload={(item) => void download(item)} />
      {confirmDialog}
    </div>
  )
}
