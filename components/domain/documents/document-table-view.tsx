'use client'

import { ClipboardPaste, Copy, Download, Eye, FolderInput, Loader2, Scissors, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FileTypeIcon } from '@/components/ui/file-icon'
import { FolderIcon3D } from '@/components/ui/folder-icon-3d'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DocumentFolderNode, DocumentSearchHit } from '@/services/account'
import { formatFileDate, formatFileSize } from './documents-ui'

/**
 * The Drive-style table list view (Name / Type / Size / Modified columns,
 * one row per folder then per document) - sibling to `DocumentCardGrid`,
 * same props shape, switched to by the existing grid/list toggle in
 * `document-library-view.tsx`.
 *
 * The leading checkbox column drives multi-select for bulk move/copy/
 * delete - the bulk ACTIONS themselves still go through the existing
 * single-item endpoints, one request per selected item (see
 * document-library-view.tsx's bulkMove/bulkCopy/bulkDelete), there is no
 * dedicated bulk-action endpoint and none is needed at this app's scale.
 * An "Owner" column is still skipped: search results carry `owner_id`,
 * never a resolved name, so a real name isn't available to show without a
 * backend change nobody asked for here.
 */

export interface DocumentTableViewProps {
  documents: DocumentSearchHit[]
  typeLabel: (key: string | null) => string | null
  downloadingId: number | null
  onOpen: (doc: DocumentSearchHit) => void
  onOpenDetails: (doc: DocumentSearchHit) => void
  onDownload: (doc: DocumentSearchHit) => void
  onDelete?: (doc: DocumentSearchHit) => void
  onMove?: (doc: DocumentSearchHit) => void
  canDelete: (doc: DocumentSearchHit) => boolean
  folders?: DocumentFolderNode[]
  onOpenFolder?: (folder: DocumentFolderNode) => void
  onDeleteFolder?: (folder: DocumentFolderNode) => void
  onMoveFolder?: (folder: DocumentFolderNode) => void
  canManageFolder?: (folder: DocumentFolderNode) => boolean

  /* ── cut/copy/paste, starring — same shape as DocumentCardGrid's own ────── */
  onToggleStar?: (doc: DocumentSearchHit) => void
  onCut?: (doc: DocumentSearchHit) => void
  onCopy?: (doc: DocumentSearchHit) => void
  onCutFolder?: (folder: DocumentFolderNode) => void
  onCopyFolder?: (folder: DocumentFolderNode) => void
  hasClipboard?: boolean
  onPasteIntoFolder?: (folder: DocumentFolderNode) => void

  /* ── multi-select, for bulk move/copy/delete — same keying as DocumentCardGrid's own (`doc-<id>` / `folder-<id>`) ── */
  selectedKeys?: Set<string>
  onToggleSelect?: (key: string) => void
  /** Header "select all" checkbox - checked when every visible row is selected, indeterminate when only some are. */
  onToggleSelectAll?: () => void
}

export function DocumentTableView({
  documents,
  typeLabel,
  downloadingId,
  onOpen,
  onOpenDetails,
  onDownload,
  onDelete,
  onMove,
  canDelete,
  folders = [],
  onOpenFolder,
  onDeleteFolder,
  onMoveFolder,
  canManageFolder,
  onToggleStar,
  onCut,
  onCopy,
  onCutFolder,
  onCopyFolder,
  hasClipboard,
  onPasteIntoFolder,
  selectedKeys,
  onToggleSelect,
  onToggleSelectAll,
}: DocumentTableViewProps) {
  const totalRows = folders.length + documents.length
  const selectedCount = selectedKeys?.size ?? 0
  const allSelected = totalRows > 0 && selectedCount >= totalRows
  const someSelected = selectedCount > 0 && !allSelected

  return (
    <div className="@container/docs overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {onToggleSelect && (
              <TableHead className="w-10">
                <Checkbox
                  size="sm"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={() => onToggleSelectAll?.()}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead className="hidden @lg/docs:table-cell">Type</TableHead>
            <TableHead className="hidden @md/docs:table-cell">Size</TableHead>
            <TableHead className="hidden @sm/docs:table-cell">Modified</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => {
            const folderKey = `folder-${folder.id}`
            return (
            <TableRow key={folderKey} className={cn('group', selectedKeys?.has(folderKey) && 'bg-primary/5')}>
              {onToggleSelect && (
                <TableCell>
                  <Checkbox
                    size="sm"
                    checked={selectedKeys?.has(folderKey) ?? false}
                    onCheckedChange={() => onToggleSelect(folderKey)}
                    aria-label={`Select ${folder.name}`}
                  />
                </TableCell>
              )}
              <TableCell>
                <button
                  type="button"
                  onClick={() => onOpenFolder?.(folder)}
                  className="flex min-w-0 items-center gap-3 text-left outline-none"
                >
                  <span className="relative h-[20px] w-[25px] shrink-0 overflow-visible">
                    <FolderIcon3D size={0.25} interactive={false} />
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">{folder.name}</span>
                </button>
              </TableCell>
              <TableCell className="hidden @lg/docs:table-cell text-sm text-muted-foreground">
                {folder.visibility === 'organization' ? 'Organisation folder' : folder.visibility === 'department' ? 'Department folder' : 'Private folder'}
              </TableCell>
              <TableCell className="hidden @md/docs:table-cell text-sm text-muted-foreground">
                {folder.children.length > 0 ? `${folder.children.length} subfolder${folder.children.length === 1 ? '' : 's'}` : '—'}
              </TableCell>
              <TableCell className="hidden @sm/docs:table-cell text-sm text-muted-foreground">—</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {hasClipboard && onPasteIntoFolder && canManageFolder?.(folder) && (
                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onPasteIntoFolder(folder)} aria-label={`Paste into ${folder.name}`}>
                      <ClipboardPaste className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {canManageFolder?.(folder) && onMoveFolder && (
                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onMoveFolder(folder)} aria-label={`Move folder ${folder.name}`}>
                      <FolderInput className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {canManageFolder?.(folder) && onCutFolder && (
                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onCutFolder(folder)} aria-label={`Cut folder ${folder.name}`}>
                      <Scissors className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {onCopyFolder && (
                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onCopyFolder(folder)} aria-label={`Copy folder ${folder.name}`}>
                      <Copy className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                  {canManageFolder?.(folder) && onDeleteFolder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDeleteFolder(folder)}
                      aria-label={`Remove folder ${folder.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </TableCell>
            </TableRow>
            )
          })}

          {documents.map((doc) => {
            const size = formatFileSize(doc.size)
            const date = formatFileDate(doc.document_date ?? doc.created_at)
            const label = typeLabel(doc.document_type)
            const pending = doc.processing_status !== 'done'
            const docKey = `doc-${doc.id}`

            return (
              <TableRow
                key={doc.id}
                data-document-id={doc.id}
                className={cn('group transition data-[highlight=true]:bg-primary/20 data-[highlight=true]:ring-2 data-[highlight=true]:ring-primary', selectedKeys?.has(docKey) && 'bg-primary/5')}
              >
                {onToggleSelect && (
                  <TableCell>
                    <Checkbox
                      size="sm"
                      checked={selectedKeys?.has(docKey) ?? false}
                      onCheckedChange={() => onToggleSelect(docKey)}
                      aria-label={`Select ${doc.title || 'document'}`}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <button type="button" onClick={() => onOpenDetails(doc)} className="flex min-w-0 items-center gap-3 text-left outline-none">
                    <span className="flex size-7 shrink-0 items-center justify-center">
                      <FileTypeIcon mimeType={doc.mime_type} fileName={doc.original_file_name} className="h-full w-full" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{doc.title || 'Untitled'}</span>
                      {pending && (
                        <Badge variant="muted" className="mt-0.5 text-[10px] uppercase tracking-wide">
                          {doc.processing_status === 'failed' ? 'Failed' : 'Processing'}
                        </Badge>
                      )}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="hidden @lg/docs:table-cell text-sm text-muted-foreground">{label ?? '—'}</TableCell>
                <TableCell className="hidden @md/docs:table-cell text-sm text-muted-foreground">{size ?? '—'}</TableCell>
                <TableCell className="hidden @sm/docs:table-cell text-sm text-muted-foreground">{date ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {onToggleStar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn('h-7 px-1.5', doc.starred && 'text-amber-500')}
                        onClick={() => onToggleStar(doc)}
                        aria-label={doc.starred ? `Unstar ${doc.title ?? 'document'}` : `Star ${doc.title ?? 'document'}`}
                      >
                        <Star className={cn('size-3.5', doc.starred && 'fill-current')} aria-hidden="true" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onOpen(doc)} aria-label={`View ${doc.title ?? 'document'}`}>
                      <Eye className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1.5"
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
                    {onMove && canDelete(doc) && (
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onMove(doc)} aria-label={`Move ${doc.title ?? 'document'}`}>
                        <FolderInput className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                    {onCut && canDelete(doc) && (
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onCut(doc)} aria-label={`Cut ${doc.title ?? 'document'}`}>
                        <Scissors className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                    {onCopy && (
                      <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => onCopy(doc)} aria-label={`Copy ${doc.title ?? 'document'}`}>
                        <Copy className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                    {onDelete && canDelete(doc) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(doc)}
                        aria-label={`Remove ${doc.title ?? 'document'}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
