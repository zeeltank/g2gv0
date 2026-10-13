'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolderNode } from '@/services/account'

/**
 * The left-rail folder browser — a recursive tree, same visual language as
 * `department-list.tsx`'s `HierarchyTree`/`HierarchyNode` (expand/collapse
 * chevron, `Folder`/`FolderOpen` icon swap on open state, depth-based
 * indentation). Deliberately simpler than that component in one respect:
 * there is no client-side tree-BUILDING here (no `buildSafeHierarchy()` to
 * port) — `GET /documents/folders/tree` already returns a nested structure,
 * built server-side the same `groupBy('parent_id')` + recursive-walk way,
 * so this component only has to RENDER a tree, not construct one from a
 * flat list.
 */
export interface DocumentFolderTreeProps {
  nodes: DocumentFolderNode[]
  selectedId: number | null
  onSelect: (id: number | null) => void
}

export function DocumentFolderTree({ nodes, selectedId, onSelect }: DocumentFolderTreeProps) {
  return (
    <ul className="space-y-0.5">
      <li>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold transition-colors',
            selectedId === null ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
          )}
        >
          <Folder className={cn('size-4 shrink-0', selectedId === null ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
          My Drive
        </button>
      </li>
      {nodes.map((node) => (
        <DocumentFolderTreeNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </ul>
  )
}

function DocumentFolderTreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: DocumentFolderNode
  depth: number
  selectedId: number | null
  onSelect: (id: number | null) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  // Auto-expand an ancestor of whatever's selected, so navigating deep via
  // breadcrumb or direct link doesn't leave the tree looking collapsed
  // around the very node it's pointing at.
  useEffect(() => {
    if (isSelected) setOpen(true)
  }, [isSelected])

  return (
    <li>
      <div
        className={cn(
          'flex h-8 items-center gap-1 rounded-md pr-2 text-sm transition-colors',
          isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
        )}
        style={{ paddingLeft: 4 + depth * 16 }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground',
            !hasChildren && 'invisible',
          )}
          aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
        >
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          {open && hasChildren ? (
            <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Folder className="size-4 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {hasChildren && open && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <DocumentFolderTreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  )
}
