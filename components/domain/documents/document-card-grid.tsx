'use client'

import { useState } from 'react'
import { Download, Eye, FolderInput, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { FileTypeIcon } from '@/components/ui/file-icon'
import { FolderIcon3D } from '@/components/ui/folder-icon-3d'
import { cn } from '@/lib/utils'
import type { DocumentFolderNode, DocumentSearchHit } from '@/services/account'
import { HighlightedSnippet } from './highlighted-snippet'

export type GridCardSize = 'xlarge' | 'large' | 'medium' | 'small'

/**
 * Every tile — folder or file — is forced to `aspect-square` so one
 * oversized folder can no longer stretch its whole grid row and leave the
 * file cards next to it half-empty (the bug the previous fixed-height
 * layout had). Each size preset controls three things together: how many
 * columns `auto-fill` packs into the row (via the `minmax` floor), how big
 * the icon reads, and how much text shows — `xlarge`/`large` are the only
 * presets roomy enough for the content snippet.
 */
const SIZE_CONFIG: Record<
  GridCardSize,
  {
    cols: string
    gap: string
    folderScale: number
    title: string
    meta: string
    showSnippet: boolean
  }
> = {
  xlarge: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]',
    gap: 'gap-3',
    folderScale: 1.3,
    title: 'text-lg',
    meta: 'text-sm',
    showSnippet: true,
  },
  large: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(190px,1fr))]',
    gap: 'gap-2.5',
    folderScale: 1.1,
    title: 'text-base',
    meta: 'text-xs',
    showSnippet: true,
  },
  medium: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(148px,1fr))]',
    gap: 'gap-2',
    folderScale: 0.8,
    title: 'text-sm',
    meta: 'text-[11px]',
    showSnippet: false,
  },
  small: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(114px,1fr))]',
    gap: 'gap-1.5',
    folderScale: 0.55,
    title: 'text-xs',
    meta: 'text-[11px]',
    showSnippet: false,
  },
}

export interface DocumentCardGridProps {
  documents: DocumentSearchHit[]
  typeLabel: (key: string | null) => string | null
  downloadingId: number | null
  /** Extra large / large / medium / small — purely a tile-density preset, see `SIZE_CONFIG`. */
  size?: GridCardSize
  /** The eye icon — a quick inline preview. */
  onOpen: (doc: DocumentSearchHit) => void
  /** Clicking the card body — the full detail panel (classification, versions, related, activity log). */
  onOpenDetails: (doc: DocumentSearchHit) => void
  onDownload: (doc: DocumentSearchHit) => void
  onDelete?: (doc: DocumentSearchHit) => void
  /** Opens a folder picker for this document. Gated by `canDelete` too — same owner-only reasoning, not a new permission. */
  onMove?: (doc: DocumentSearchHit) => void
  /** Double-click the name to rename. Gated by `canDelete` too — same owner-only reasoning as move/delete. */
  onRename?: (doc: DocumentSearchHit, title: string) => void
  /** Only the owner (or an elevated caller, which the server already filtered for) may delete from here. */
  canDelete: (doc: DocumentSearchHit) => boolean
  /** Subfolders of whatever's currently being browsed — rendered first, same card shape, Folder icon. Omit entirely outside a folder-aware view. */
  folders?: DocumentFolderNode[]
  onOpenFolder?: (folder: DocumentFolderNode) => void
  onDeleteFolder?: (folder: DocumentFolderNode) => void
  onMoveFolder?: (folder: DocumentFolderNode) => void
  /** Double-click the name to rename. Gated by `canManageFolder`. */
  onRenameFolder?: (folder: DocumentFolderNode, name: string) => void
  canManageFolder?: (folder: DocumentFolderNode) => boolean
}

export function DocumentCardGrid({
  documents,
  downloadingId,
  size = 'large',
  onOpen,
  onOpenDetails,
  onDownload,
  onDelete,
  onMove,
  onRename,
  canDelete,
  folders = [],
  onOpenFolder,
  onDeleteFolder,
  onMoveFolder,
  onRenameFolder,
  canManageFolder,
}: DocumentCardGridProps) {
  const cfg = SIZE_CONFIG[size]
  // Which tile's name is being edited right now, `folder-<id>` or `doc-<id>` — local UI state, the actual save round-trips through `onRename`/`onRenameFolder`.
  const [renamingKey, setRenamingKey] = useState<string | null>(null)

  function commitRename(input: HTMLInputElement, save: (value: string) => void) {
    setRenamingKey(null)
    save(input.value)
  }
  // The folder graphic's unscaled footprint is a fixed 100x80 box (see
  // folder-icon-3d.tsx's own docblock) — `scale()` never changes that
  // layout box, so the wrapper is sized to the EXACT scaled footprint here.
  // This has to be an inline style, not a Tailwind class: the pixel value
  // is computed from `cfg.folderScale` at render time, and Tailwind can
  // only pick up class names that appear as literal strings in the source.
  const folderBoxStyle = { width: `${100 * cfg.folderScale}px`, height: `${80 * cfg.folderScale}px` }

  return (
    /*
     * Container queries, not viewport breakpoints - this grid sits inside
     * the app shell's content area, which narrows when the sidebar or an
     * agent panel is open, so `lg:`/`xl:` would lay three columns into the
     * space of one. `auto-fill` + a per-size `minmax` floor (instead of
     * fixed breakpoint column counts) packs however many square tiles of
     * that floor width actually fit, so resizing the panel changes the
     * column count smoothly instead of jumping at three hardcoded steps.
     */
    <div className="@container/docs">
      <ul className={cn('grid', cfg.cols, cfg.gap)}>
        {folders.map((folder) => {
          const canManage = canManageFolder?.(folder) ?? false
          const folderKey = `folder-${folder.id}`
          const isRenaming = renamingKey === folderKey
          return (
            <li key={folderKey} className="aspect-square">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenFolder?.(folder)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenFolder?.(folder)
                      }
                    }}
                    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="flex shrink-0 items-center justify-center overflow-visible" style={folderBoxStyle}>
                      <FolderIcon3D size={cfg.folderScale} interactive={false} />
                    </span>
                    <div className="min-w-0 w-full">
                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={folder.name}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={(e) => commitRename(e.currentTarget, (value) => onRenameFolder?.(folder, value))}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') {
                              e.currentTarget.value = folder.name
                              setRenamingKey(null)
                            }
                          }}
                          className={cn(
                            'w-full rounded border border-input bg-background px-1 text-center font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                            cfg.title,
                          )}
                        />
                      ) : (
                        <h3
                          className={cn('line-clamp-1 font-semibold leading-tight text-foreground', cfg.title, onRenameFolder && canManage && 'cursor-text')}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            if (!onRenameFolder || !canManage) return
                            e.stopPropagation()
                            setRenamingKey(folderKey)
                          }}
                        >
                          {folder.name}
                        </h3>
                      )}
                      <p className={cn('mt-0.5 truncate text-muted-foreground', cfg.meta)}>
                        {folder.visibility === 'organization' ? 'Organisation' : folder.visibility === 'department' ? 'Department' : 'Private'}
                      </p>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuItem onClick={() => onOpenFolder?.(folder)}>
                    <FolderOpen aria-hidden="true" />
                    Open
                  </ContextMenuItem>
                  {canManage && (onMoveFolder || onDeleteFolder) && <ContextMenuSeparator />}
                  {canManage && onMoveFolder && (
                    <ContextMenuItem onClick={() => onMoveFolder(folder)}>
                      <FolderInput aria-hidden="true" />
                      Move
                    </ContextMenuItem>
                  )}
                  {canManage && onDeleteFolder && (
                    <ContextMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onClick={() => onDeleteFolder(folder)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            </li>
          )
        })}

        {documents.map((doc) => {
          const source = doc.source_system ? `from ${doc.source_system}` : doc.category === 'organization' ? 'Organisation' : 'Personal'
          const pending = doc.processing_status !== 'done'
          const canModify = canDelete(doc)
          const docKey = `doc-${doc.id}`
          const isRenaming = renamingKey === docKey

          return (
            <li key={doc.id} className="relative aspect-square">
              {pending && (
                <Badge variant="muted" className="absolute right-2 top-2 z-10 text-[10px] uppercase tracking-wide">
                  {doc.processing_status === 'failed' ? 'Failed' : 'Processing'}
                </Badge>
              )}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenDetails(doc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenDetails(doc)
                      }
                    }}
                    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="flex shrink-0 items-center justify-center overflow-visible" style={folderBoxStyle}>
                      <FileTypeIcon mimeType={doc.mime_type} fileName={doc.original_file_name} className="h-full w-full" />
                    </span>

                    <div className="min-w-0 w-full">
                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={doc.title || ''}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.currentTarget.select()}
                          onBlur={(e) => commitRename(e.currentTarget, (value) => onRename?.(doc, value))}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') {
                              e.currentTarget.value = doc.title || ''
                              setRenamingKey(null)
                            }
                          }}
                          className={cn(
                            'w-full rounded border border-input bg-background px-1 text-center font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                            cfg.title,
                          )}
                        />
                      ) : (
                        <h3
                          className={cn('line-clamp-2 font-semibold leading-tight text-foreground', cfg.title, onRename && canModify && 'cursor-text')}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => {
                            if (!onRename || !canModify) return
                            e.stopPropagation()
                            setRenamingKey(docKey)
                          }}
                        >
                          {doc.title || 'Untitled'}
                        </h3>
                      )}
                      <p className={cn('mt-1 truncate text-muted-foreground', cfg.meta)}>{source}</p>
                    </div>

                    {cfg.showSnippet && doc.snippet && (
                      <p className="line-clamp-3 rounded-md bg-muted/50 px-2 py-1.5 text-left text-[11px] leading-snug text-muted-foreground">
                        <HighlightedSnippet text={doc.snippet} />
                      </p>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuItem onClick={() => onOpen(doc)}>
                    <Eye aria-hidden="true" />
                    View
                  </ContextMenuItem>
                  <ContextMenuItem disabled={downloadingId !== null} onClick={() => onDownload(doc)}>
                    {downloadingId === doc.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    Download
                  </ContextMenuItem>
                  {(onMove || onDelete) && canModify && <ContextMenuSeparator />}
                  {onMove && canModify && (
                    <ContextMenuItem onClick={() => onMove(doc)}>
                      <FolderInput aria-hidden="true" />
                      Move
                    </ContextMenuItem>
                  )}
                  {onDelete && canModify && (
                    <ContextMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onClick={() => onDelete(doc)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
