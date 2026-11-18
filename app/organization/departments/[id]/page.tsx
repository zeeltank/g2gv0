'use client'

/**
 * A department's full-page detail view - /organization/departments/[id].
 *
 * Replaces the side drawer department-list.tsx used to open
 * (department-details-panel.tsx, now retired): a real, bookmarkable,
 * refreshable URL rather than a Sheet layered over the list. Modeled on
 * `app/ai/reports/[id]/page.tsx` (the closest existing authenticated
 * `[id]` page in this app) for the loading/error shape, and on
 * `app/ai/layout.tsx` for sitting this page inside `GtgPageShell` with an
 * explicit breadcrumb rather than the content-map's `GtgAppShell` - this
 * route is outside the content-map tree (there is no
 * `/organization/departments/[id]` entry in it), so nothing in the
 * sidebar should light up as active, same reasoning as that layout's.
 *
 * Fetches the FULL department list (the same call department-list.tsx
 * makes) rather than the single-record `GET /departments-management/{id}`
 * endpoint, for two reasons: it already carries every field the detail
 * page's tabs need (parent's resolved NAME, not just parent_id, which the
 * single-record endpoint does not resolve), and running the result through
 * the exact same `scopeDepartments()` the list uses means a scoped
 * department head cannot view a department outside their scope just by
 * typing its id in the address bar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { GtgPageShell } from '@/components/shell/gtg-page-shell'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { useAuth } from '@/components/auth/gtg-auth'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { getLaravelContext } from '@/lib/laravel-context'
import { DEPT_MANAGEMENT_ACCESS_LINK } from '@/lib/gtg-navigation'
import { getAccess, roleLabel } from '@/lib/gtg-roles'
import { organizationService } from '@/services/organization'
import { mapDepartments, scopeDepartments } from '@/domain/organization/department-management/department-list'
import { DepartmentDetailPage } from '@/domain/organization/department-management/department-detail-page'
import { AccessDenied } from '@/domain/organization/components'
import type { Department } from '@/lib/gtg-org-data'

export default function DepartmentDetailRoute() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const { user } = useAuth()
  const context = useMemo(() => getLaravelContext(user), [user])
  const access = useMemo(() => (user?.role ? getAccess('department-list', user.role) : 'none'), [user])
  const canManage = access !== 'none'

  const [department, setDepartment] = useState<Department | null>(null)
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [removed, setRemoved] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await organizationService.getDepartmentsManagement(context)
      const mapped = mapDepartments(response.main_departments, response.sub_departments)
      const scoped = scopeDepartments(mapped, access, user?.id)
      setAllDepartments(scoped)
      setDepartment(scoped.find((d) => d.id === id) ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load this department.')
    } finally {
      setIsLoading(false)
    }
  }, [context, id, access, user])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Organization' },
    { label: 'Departments', href: DEPT_MANAGEMENT_ACCESS_LINK },
    { label: department?.name ?? '...' },
  ]

  return (
    <ProtectedLayout>
      <GtgPageShell initialActive={{ moduleId: '', menuId: '', submenuId: '' }}>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <GtgBreadcrumbFromContext />

          {access === 'none' && !isLoading && (
            <AccessDenied role={user?.role ? roleLabel(user.role) : ''} />
          )}

          {access !== 'none' && isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Opening department...
            </div>
          )}

          {access !== 'none' && !isLoading && error && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-10 text-center text-sm text-destructive">
              <p>{error}</p>
              <BackToDepartmentsButton onClick={() => router.push(resolveAccessLink(DEPT_MANAGEMENT_ACCESS_LINK))} />
            </div>
          )}

          {access !== 'none' && !isLoading && !error && !department && !removed && (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <p>This department could not be found, or you do not have access to it.</p>
              <BackToDepartmentsButton onClick={() => router.push(resolveAccessLink(DEPT_MANAGEMENT_ACCESS_LINK))} />
            </div>
          )}

          {access !== 'none' && !isLoading && department && !removed && (
            <DepartmentDetailPage
              department={department}
              departments={allDepartments}
              canManage={canManage}
              context={context}
              onSaved={() => void load()}
              onRemoved={() => setRemoved(true)}
            />
          )}

          {removed && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <p>This department has been removed.</p>
              <BackToDepartmentsButton onClick={() => router.push(resolveAccessLink(DEPT_MANAGEMENT_ACCESS_LINK))} />
            </div>
          )}
        </BreadcrumbItemsProvider>
      </GtgPageShell>
    </ProtectedLayout>
  )
}

function BackToDepartmentsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <ArrowLeft className="mr-1.5 size-3.5" aria-hidden="true" />
      Back to Departments
    </Button>
  )
}
