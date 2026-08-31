'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeaderBase } from '@/components/shell/gtg-header-base'
import { BreadcrumbItemsProvider } from '@/components/shell/gtg-breadcrumb'
import { resolveBreadcrumb, type ActiveNav } from '@/hooks/use-navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { BreadcrumbItem } from '@/lib/gtg-navigation'
import { cn } from '@/lib/utils'
import { consumeSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'

/** Organizational Management > Organization Setup > Organization Profile (tblmenumaster_g2g ids 1/7/12). */
const DEFAULT_ACTIVE: ActiveNav = {
  moduleId: '1',
  menuId: '7',
  submenuId: '12',
}

interface GtgPageShellProps {
  children: ReactNode
  initialActive?: ActiveNav
  breadcrumbItems?: BreadcrumbItem[]
}

export function GtgPageShell({ children, initialActive, breadcrumbItems }: GtgPageShellProps) {
  const router = useRouter()
  const { modules, getRoutePath } = useSidebarNavigation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const active = initialActive ?? DEFAULT_ACTIVE
  const items = breadcrumbItems ?? resolveBreadcrumb(active, modules)

  useEffect(() => {
    if (consumeSidebarFirstOpenExpansion()) {
      queueMicrotask(() => {
        setSidebarCollapsed(false)
      })
    }
  }, [])

  const handleNavSelect = useCallback((next: ActiveNav) => {
    const path = getRoutePath(next)

    // Nothing mapped means nothing to open. getRoutePath used to answer
    // '/dashboard' here, so an unresolvable selection quietly opened the
    // dashboard instead of revealing that the lookup had missed.
    if (!path) {
      return
    }

    if (path.startsWith('http')) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }
    router.push(path)
  }, [router, getRoutePath])

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full overflow-hidden bg-background">
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        modules={modules}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={cn(
          'flex h-screen w-full flex-col pl-0 transition-[padding-left] duration-200',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]',
        )}
      >
        <GtgHeaderBase onMenuClick={() => setMobileNavOpen(true)} />
        <BreadcrumbItemsProvider items={items}>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col min-h-0 overflow-hidden">
              <main className="g2g-page-scroll g2g-scrollbar flex-1 overflow-auto bg-background">
                <div className="min-h-full w-full p-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </BreadcrumbItemsProvider>
      </div>
    </div>
  )
}
