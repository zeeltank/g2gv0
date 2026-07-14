'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeaderBase } from '@/components/shell/gtg-header-base'
import { GtgBreadcrumb } from '@/components/shell/gtg-breadcrumb'
import { resolveBreadcrumb, type ActiveNav } from '@/hooks/use-navigation'
import type { BreadcrumbItem } from '@/lib/gtg-navigation'

const DEFAULT_ACTIVE: ActiveNav = {
  moduleId: 'm1',
  menuId: 'org-setup',
  submenuId: 'org-profile',
}

interface GtgPageShellProps {
  children: ReactNode
  initialActive?: ActiveNav
  breadcrumbItems?: BreadcrumbItem[]
}

export function GtgPageShell({ children, initialActive, breadcrumbItems }: GtgPageShellProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const active = initialActive ?? DEFAULT_ACTIVE
  const items = breadcrumbItems ?? resolveBreadcrumb(active)

  const handleNavSelect = useCallback((next: ActiveNav) => {
    router.push(`/module/${next.moduleId}/${next.menuId}/${next.submenuId}`)
  }, [router])

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full overflow-hidden bg-background">
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        role={user?.role || 'employee'}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex h-screen w-full flex-col pl-0 md:pl-[72px]">
        <GtgHeaderBase onMenuClick={() => setMobileNavOpen(true)} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
            <GtgBreadcrumb items={items} />
            <main className="g2g-page-scroll g2g-scrollbar flex-1 overflow-auto bg-background">
              <div className="min-h-full w-full p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
