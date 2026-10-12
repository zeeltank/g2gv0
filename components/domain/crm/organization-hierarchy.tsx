'use client'

/**
 * Parent/child organization tree, rendered as a real nested list rather
 * than the legacy CRM's plain-text dash indentation - this app has no
 * existing tree-widget precedent, so this is a fresh, small component.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronRight, Loader2 } from 'lucide-react'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { OrganizationHierarchyNode } from '@/types/crm'

export function OrganizationHierarchy({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const context = useMemo(() => getLaravelContext(), [])

  const [ancestors, setAncestors] = useState<OrganizationHierarchyNode[]>([])
  const [current, setCurrent] = useState<OrganizationHierarchyNode | null>(null)
  const [descendants, setDescendants] = useState<OrganizationHierarchyNode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Deferred so the first setState lands after this render.
    queueMicrotask(() => {
      if (!active) return
      if (!isLaravelContextReady(context)) { setIsLoading(false); return }
      setIsLoading(true)
      crmService.getOrganizationHierarchy(context, organizationId)
        .then((response) => {
          if (!active) return
          setAncestors(response.data.ancestors)
          setCurrent(response.data.current)
          setDescendants(response.data.descendants)
        })
        .catch(() => { /* leave the tree empty - the detail page still works */ })
        .finally(() => { if (active) setIsLoading(false) })
    })
    return () => { active = false }
  }, [context, organizationId])

  const goTo = (id: string) => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${id}`)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading hierarchy…
      </div>
    )
  }

  if (!current) {
    return <p className="py-6 text-sm text-muted-foreground">No hierarchy information available.</p>
  }

  if (ancestors.length === 0 && descendants.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">This organization has no parent or child organizations.</p>
  }

  return (
    <div className="space-y-1 py-2">
      {ancestors.map((node, i) => (
        <button
          key={node.id}
          type="button"
          onClick={() => goTo(node.id)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          style={{ paddingLeft: `${i * 20}px` }}
        >
          <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
          {node.name}
        </button>
      ))}

      <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-sm font-semibold text-foreground" style={{ paddingLeft: `${ancestors.length * 20 + 8}px` }}>
        <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
        {current.name}
        <span className="text-xs font-normal text-muted-foreground">(this organization)</span>
      </div>

      {descendants.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => goTo(node.id)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          style={{ paddingLeft: `${(ancestors.length + (node.depth ?? 1)) * 20}px` }}
        >
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
          {node.name}
        </button>
      ))}
    </div>
  )
}
