'use client'

import {
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DocumentSearchHit } from '@/services/account'
import { HighlightedSnippet } from './highlighted-snippet'

function iconFor(mimeType: string | null, fileName: string | null) {
  const mime = (mimeType ?? '').toLowerCase()
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return { Icon: FileImage, tint: 'text-violet-500 bg-violet-500/10' }
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return { Icon: FileText, tint: 'text-rose-500 bg-rose-500/10' }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, tint: 'text-emerald-500 bg-emerald-500/10' }
  }
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return { Icon: FileText, tint: 'text-sky-500 bg-sky-500/10' }
  }

  return { Icon: File, tint: 'text-muted-foreground bg-muted' }
}

function formatSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export interface DocumentCardGridProps {
  documents: DocumentSearchHit[]
  typeLabel: (key: string | null) => string | null
  downloadingId: number | null
  /** The eye icon — a quick inline preview. */
  onOpen: (doc: DocumentSearchHit) => void
  /** Clicking the card body — the full detail panel (classification, versions, related, activity log). */
  onOpenDetails: (doc: DocumentSearchHit) => void
  onDownload: (doc: DocumentSearchHit) => void
  onDelete?: (doc: DocumentSearchHit) => void
  /** Only the owner (or an elevated caller, which the server already filtered for) may delete from here. */
  canDelete: (doc: DocumentSearchHit) => boolean
}

export function DocumentCardGrid({
  documents,
  typeLabel,
  downloadingId,
  onOpen,
  onOpenDetails,
  onDownload,
  onDelete,
  canDelete,
}: DocumentCardGridProps) {
  return (
    /*
     * Container queries, not viewport breakpoints - this grid sits inside
     * the app shell's content area, which narrows when the sidebar or an
     * agent panel is open, so `lg:`/`xl:` would lay three columns into the
     * space of one. Same reasoning as `course-card-grid.tsx`.
     */
    <div className="@container/docs">
      <ul className="grid grid-cols-1 gap-4 @lg/docs:grid-cols-2 @3xl/docs:grid-cols-3 @6xl/docs:grid-cols-4">
        {documents.map((doc) => {
          const { Icon, tint } = iconFor(doc.mime_type, doc.original_file_name)
          const size = formatSize(doc.size)
          const date = formatDate(doc.document_date ?? doc.created_at)
          const label = typeLabel(doc.document_type)
          const pending = doc.processing_status !== 'done'

          return (
            <li key={doc.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
                <button
                  type="button"
                  onClick={() => onOpenDetails(doc)}
                  className="flex flex-1 flex-col items-start gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tint)}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {pending && (
                      <Badge variant="muted" className="shrink-0 text-[10px] uppercase tracking-wide">
                        {doc.processing_status === 'failed' ? 'Failed' : 'Processing'}
                      </Badge>
                    )}
                  </span>

                  <div className="min-w-0 w-full">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                      {doc.title || 'Untitled'}
                    </h3>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {[label, size, date].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  {doc.snippet && (
                    <p className="line-clamp-3 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                      <HighlightedSnippet text={doc.snippet} />
                    </p>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {doc.source_system ? `from ${doc.source_system}` : doc.category === 'organization' ? 'Organisation' : 'Personal'}
                  </span>

                  <span className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-xs"
                      onClick={() => onOpen(doc)}
                      aria-label={`View ${doc.title ?? 'document'}`}
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-xs"
                      disabled={downloadingId !== null}
                      onClick={() => onDownload(doc)}
                      aria-label={`Download ${doc.title ?? 'document'}`}
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                    {onDelete && canDelete(doc) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(doc)}
                        aria-label={`Remove ${doc.title ?? 'document'}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
