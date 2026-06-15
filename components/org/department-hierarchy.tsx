'use client'

import { useState } from 'react'
import {
  ChevronRight,
  Building2,
  Users,
  GripVertical,
  Expand,
  Minimize2,
  ListTree,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionCard, StatusBadge, Badge, AccessDenied } from './gtg-ui'
import { DEPARTMENTS, buildHierarchy, type DeptNode } from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

function collectIds(nodes: DeptNode[], acc: string[] = []): string[] {
  nodes.forEach((n) => {
    acc.push(n.id)
    if (n.children.length) collectIds(n.children, acc)
  })
  return acc
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  canReorder,
}: {
  node: DeptNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  canReorder: boolean
}) {
  const hasChildren = node.children.length > 0
  const isOpen = expanded.has(node.id)

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors duration-200 hover:border-border hover:bg-surface-muted"
        style={{ marginLeft: depth * 24 }}
      >
        {canReorder && (
          <span
            className="cursor-grab text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            aria-hidden="true"
            title="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </span>
        )}

        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-label={hasChildren ? (isOpen ? 'Collapse' : 'Expand') : undefined}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            hasChildren ? 'hover:bg-secondary hover:text-foreground' : 'invisible',
          )}
        >
          <ChevronRight
            className={cn(
              'size-4 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            depth === 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground',
          )}
          aria-hidden="true"
        >
          <Building2 className="size-4" />
        </span>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {node.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {node.hod ? `HOD: ${node.hod}` : 'HOD unassigned'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Users className="size-3.5" aria-hidden="true" />
              {node.employees}
            </span>
            <StatusBadge status={node.status} />
          </div>
        </div>
      </div>

      {hasChildren && isOpen && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              canReorder={canReorder}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function DepartmentHierarchy({ role }: { role: Role }) {
  const access = getAccess('department-hierarchy', role)
  const tree = buildHierarchy(DEPARTMENTS)
  const allIds = collectIds(tree)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(allIds))

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  const canReorder = access === 'full'

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="navy">
            <ListTree className="size-3.5" aria-hidden="true" />
            {allIds.length} Nodes
          </Badge>
          {canReorder && <Badge tone="outline">Drag to Reorder</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(new Set(allIds))}
          >
            <Expand aria-hidden="true" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(new Set())}
          >
            <Minimize2 aria-hidden="true" />
            Collapse All
          </Button>
        </div>
      </div>

      <SectionCard
        title="Department Hierarchy"
        description={
          canReorder
            ? 'Visual reporting structure. Expand or collapse nodes, and drag to reorder the hierarchy.'
            : 'Visual reporting structure. Expand or collapse nodes to explore the organization.'
        }
      >
        <ul className="flex flex-col gap-0.5">
          {tree.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              canReorder={canReorder}
            />
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
